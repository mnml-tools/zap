#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::{Deserialize, Serialize};
use sqlx::{any::AnyPoolOptions, AnyPool};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
mod catalog;
mod connection_transfer;
mod credentials;
mod editor;
mod filters;
mod postgres_export;
mod queries;
mod relations;
mod releases;
mod sql_import;
mod sql_text;
mod ssh;
mod table_export;
mod window_size;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Connection {
    id: String,
    title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    environment: Option<ConnectionEnvironment>,
    driver: String,
    host: String,
    port: u16,
    authentication: String,
    user: String,
    #[serde(default, skip_serializing)]
    password: String,
    database: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ssh: Option<ssh::SshSettings>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ConnectionEnvironment {
    Local,
    Prod,
}

#[derive(Default)]
struct Store {
    pools: Mutex<HashMap<String, OpenConnection>>,
    files: Mutex<()>,
    credentials: credentials::CredentialCache,
}
struct OpenConnection {
    pool: AnyPool,
    tunnel: Option<std::sync::Arc<ssh::Tunnel>>,
}

fn active_connection(
    state: &Store,
    id: &str,
    connection: &mut Connection,
) -> Result<Option<std::sync::Arc<ssh::Tunnel>>, String> {
    let sessions = state.pools.lock().map_err(|error| error.to_string())?;
    let session = sessions.get(id).ok_or("Connection is closed")?;
    if let Some(tunnel) = &session.tunnel {
        connection.host = "127.0.0.1".into();
        connection.port = tunnel.port;
    }
    Ok(session.tunnel.clone())
}

async fn connect_session(connection: &Connection) -> Result<OpenConnection, String> {
    let mut endpoint = connection.clone();
    let tunnel = if let Some(settings) = connection
        .ssh
        .as_ref()
        .filter(|_| matches!(connection.driver.as_str(), "postgresql" | "mysql"))
    {
        let tunnel = ssh::Tunnel::open(settings, &connection.host, connection.port).await?;
        endpoint.host = "127.0.0.1".into();
        endpoint.port = tunnel.port;
        Some(std::sync::Arc::new(tunnel))
    } else {
        None
    };
    let pool = connect(&endpoint).await?;

    Ok(OpenConnection { pool, tunnel })
}

fn path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p.join("connections.json"))
}
fn read(app: &tauri::AppHandle) -> Result<Vec<Connection>, String> {
    let p = path(app)?;
    if !p.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&std::fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn write_connections(app: &tauri::AppHandle, all: &[Connection]) -> Result<(), String> {
    let p = path(app)?;
    let temp = p.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec_pretty(all).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temp, p).map_err(|e| e.to_string())
}
fn credential(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.zap.desktop", id).map_err(|e| e.to_string())
}
fn saved_password(state: &Store, id: &str) -> Result<String, String> {
    state
        .credentials
        .get_or_load(id, || match credential(id)?.get_password() {
            Ok(password) => Ok(password),
            Err(keyring::Error::NoEntry) => Ok(String::new()),
            Err(error) => Err(error.to_string()),
        })
}
fn connection_url(c: &Connection) -> Result<String, String> {
    let uri = if c.driver == "sqlite" {
        format!(
            "sqlite:{}?mode=rw",
            url::Url::from_file_path(&c.database)
                .map_err(|_| "Use an absolute SQLite file path")?
                .path()
        )
    } else {
        let scheme = match c.driver.as_str() {
            "postgresql" => "postgres",
            "mysql" => "mysql",
            _ => return Err("Unsupported driver".into()),
        };
        let mut u = url::Url::parse(&format!("{scheme}://localhost")).map_err(|e| e.to_string())?;
        u.set_host(Some(&c.host)).map_err(|e| e.to_string())?;
        u.set_port(Some(c.port)).map_err(|_| "Invalid port")?;
        u.set_username(&c.user).map_err(|_| "Invalid user")?;
        if c.authentication == "password" {
            u.set_password(Some(&c.password))
                .map_err(|_| "Invalid password")?;
        }
        u.set_path(&format!("/{}", c.database));
        u.to_string()
    };
    Ok(uri)
}
async fn connect(c: &Connection) -> Result<AnyPool, String> {
    let uri = connection_url(c)?;
    AnyPoolOptions::new()
        .max_connections(3)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&uri)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn list_connections(app: tauri::AppHandle) -> Result<Vec<Connection>, String> {
    read(&app)
}
#[tauri::command]
async fn test_connection(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    mut connection: Connection,
) -> Result<(), String> {
    // Reuse the existing secret without sending it back to the form.
    if connection.password.is_empty()
        && connection.authentication == "password"
        && connection.driver != "sqlite"
        && read(&app)?.iter().any(|saved| saved.id == connection.id)
    {
        connection.password = saved_password(&state, &connection.id)?;
    }
    let session = connect_session(&connection).await?;
    session.pool.close().await;
    Ok(())
}
#[tauri::command]
fn save_connection(
    app: tauri::AppHandle,
    state: State<Store>,
    connection: Connection,
) -> Result<(), String> {
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    if !connection.password.is_empty() {
        state
            .credentials
            .write(&connection.id, &connection.password, || {
                credential(&connection.id)?
                    .set_password(&connection.password)
                    .map_err(|e| e.to_string())
            })?;
    }
    let mut all = read(&app)?;
    if let Some(saved) = all.iter_mut().find(|c| c.id == connection.id) {
        *saved = connection;
    } else {
        all.push(connection);
    }
    write_connections(&app, &all)
}
#[tauri::command]
fn remove_connection(app: tauri::AppHandle, state: State<Store>, id: String) -> Result<(), String> {
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    let mut all = read(&app)?;
    if !all.iter().any(|c| c.id == id) {
        return Err("Connection not found".into());
    }
    state
        .credentials
        .remove(&id, || match credential(&id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Could not remove stored password: {e}")),
        })?;
    all.retain(|c| c.id != id);
    let p = path(&app)?;
    let temp = p.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec_pretty(&all).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temp, p).map_err(|e| e.to_string())
}
#[tauri::command]
async fn open_connection(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
) -> Result<(), String> {
    let mut c = read(&app)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    if c.authentication == "password" && c.driver != "sqlite" {
        c.password = saved_password(&state, &id)?;
    }
    let session = connect_session(&c).await?;
    state
        .pools
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, session);
    Ok(())
}
#[tauri::command]
async fn close_connection(state: State<'_, Store>, id: String) -> Result<(), String> {
    let pool = state.pools.lock().map_err(|e| e.to_string())?.remove(&id);
    if let Some(session) = pool {
        session.pool.close().await;
    }
    Ok(())
}

fn pool(state: &Store, id: &str) -> Result<AnyPool, String> {
    state
        .pools
        .lock()
        .map_err(|e| e.to_string())?
        .get(id)
        .map(|session| session.pool.clone())
        .ok_or("Connection is closed".into())
}
#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct Table {
    schema: String,
    name: String,
}
#[derive(Serialize)]
struct TableListing {
    schema: String,
    name: String,
    // "table", "view" or "materialized_view"; commands receiving a Table ignore it.
    kind: String,
}
#[tauri::command]
async fn list_tables(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
) -> Result<Vec<TableListing>, String> {
    let c = read(&app)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    table_listings(&pool(&state, &id)?, &c.driver).await
}
async fn table_listings(p: &AnyPool, driver: &str) -> Result<Vec<TableListing>, String> {
    let q = match driver {
        "postgresql" => {
            "SELECT CAST(table_schema AS TEXT) AS s, CAST(table_name AS TEXT) AS n,
                    CAST(CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS TEXT) AS k
             FROM information_schema.tables
             WHERE table_type IN ('BASE TABLE', 'VIEW') AND table_schema NOT IN ('pg_catalog', 'information_schema')
             UNION ALL
             SELECT CAST(n.nspname AS TEXT), CAST(c.relname AS TEXT), CAST('materialized_view' AS TEXT)
             FROM pg_catalog.pg_class c
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind = 'm' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
               AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
             ORDER BY 1, 2"
        }
        "mysql" => {
            "SELECT table_schema AS s, table_name AS n,
                    CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS k
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW')
             ORDER BY 2"
        }
        _ => {
            "SELECT '' AS s, name AS n, type AS k FROM sqlite_master
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
        }
    };
    sqlx::query(q)
        .fetch_all(p)
        .await
        .map_err(|e| e.to_string())?
        .iter()
        .map(|r| {
            Ok(TableListing {
                schema: sql_text::required(r, "s").map_err(|e| e.to_string())?,
                name: sql_text::required(r, "n").map_err(|e| e.to_string())?,
                kind: sql_text::required(r, "k").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}
#[tauri::command]
async fn save_table_structure(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
    name: Option<String>,
    changes: Vec<catalog::ColumnChange>,
    additions: Option<Vec<catalog::NewColumn>>,
) -> Result<(), String> {
    let connection = read(&app)?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;

    catalog::save_structure(
        &pool(&state, &id)?,
        &connection.driver,
        &table,
        name,
        changes,
        additions.unwrap_or_default(),
    )
    .await
}

#[tauri::command]
async fn table_columns(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
) -> Result<Vec<[Option<String>; 5]>, String> {
    let connection = read(&app)?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;

    catalog::columns(&pool(&state, &id)?, &connection.driver, &table).await
}

#[tauri::command]
async fn table_indexes(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
) -> Result<Vec<[String; 4]>, String> {
    let connection = read(&app)?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;

    catalog::indexes(&pool(&state, &id)?, &connection.driver, &table).await
}

#[tauri::command]
async fn table_page(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
    page: u32,
    page_size: Option<u32>,
    filters: Option<Vec<filters::TableFilter>>,
    sort: Option<editor::TableSort>,
) -> Result<editor::Page, String> {
    let c = read(&app)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    editor::page_sorted(
        &pool(&state, &id)?,
        &c.driver,
        &table,
        page,
        &filters.unwrap_or_default(),
        sort.as_ref(),
        page_size.unwrap_or(100),
    )
    .await
}
#[tauri::command]
async fn save_table_changes(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
    columns: Vec<String>,
    edits: Vec<editor::RowChange>,
) -> Result<(), String> {
    let c = read(&app)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    editor::save(&pool(&state, &id)?, &c.driver, &table, &columns, &edits).await
}

#[tauri::command]
async fn pick_sqlite_file(window: tauri::Window) -> Result<Option<String>, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Choose a SQLite database")
        .pick_file(move |file| {
            let _ = send.send(file);
        });

    receive
        .await
        .map_err(|error| error.to_string())?
        .map(|file| {
            file.into_path()
                .map_err(|error| error.to_string())?
                .into_os_string()
                .into_string()
                .map_err(|_| "This file path contains unsupported characters.".into())
        })
        .transpose()
}

#[tauri::command]
async fn export_table(
    window: tauri::Window,
    state: State<'_, Store>,
    id: String,
    table: Table,
) -> Result<(), String> {
    let filename = table.name.replace(['/', '\\', ':'], "_");
    save_sql_export(window, &state, id, vec![table], true, filename).await
}

#[tauri::command]
async fn export_tables(
    window: tauri::Window,
    state: State<'_, Store>,
    id: String,
    tables: Vec<Table>,
    include_data: bool,
) -> Result<(), String> {
    save_sql_export(window, &state, id, tables, include_data, "tables".into()).await
}

async fn save_sql_export(
    window: tauri::Window,
    state: &Store,
    id: String,
    tables: Vec<Table>,
    include_data: bool,
    filename: String,
) -> Result<(), String> {
    if tables.is_empty() {
        return Err("Select at least one table to export.".into());
    }
    let mut connection = read(window.app_handle())?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;
    let pool = pool(state, &id)?;
    if connection.driver != "sqlite" && connection.authentication == "password" {
        connection.password = saved_password(state, &id)?;
    }

    let _tunnel = active_connection(state, &id, &mut connection)?;
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Export SQL")
        .set_file_name(format!("{filename}.sql"))
        .add_filter("SQL file", &["sql"])
        .save_file(move |path| {
            let _ = send.send(path);
        });

    if let Some(path) = receive.await.map_err(|error| error.to_string())? {
        let path = path.into_path().map_err(|error| error.to_string())?;
        table_export::export(&pool, connection, tables, include_data, &path).await?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_table(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    table: Table,
) -> Result<(), String> {
    let connection = read(&app)?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;
    let pool = pool(&state, &id)?;
    if connection.driver == "sqlite" {
        let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
        // SQLite DROP TABLE can cascade deletes through foreign keys.
        let dependent: Option<String> = sqlx::query_scalar(
            r#"SELECT s.name FROM main.sqlite_schema s
               CROSS JOIN pragma_foreign_key_list(s.name, 'main') fk
               WHERE s.type = 'table' AND s.name <> ?1 COLLATE NOCASE
                 AND fk."table" = ?1 COLLATE NOCASE LIMIT 1"#,
        )
        .bind(&table.name)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        if let Some(dependent) = dependent {
            return Err(format!(
                "Table {dependent} has a foreign key referencing this table."
            ));
        }

        let target = editor::quote("sqlite", &table.name);
        sqlx::query(&format!("DROP TABLE main.{target}"))
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;
    } else {
        let target = editor::qualified(&connection.driver, &table);
        sqlx::query(&format!("DROP TABLE {target}"))
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn pick_sql_file(window: tauri::Window) -> Result<Option<String>, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Choose an SQL file to import")
        .add_filter("SQL file", &["sql"])
        .pick_file(move |file| {
            let _ = send.send(file);
        });

    receive
        .await
        .map_err(|error| error.to_string())?
        .map(|file| {
            file.into_path()
                .map_err(|error| error.to_string())?
                .into_os_string()
                .into_string()
                .map_err(|_| "This file path contains unsupported characters.".into())
        })
        .transpose()
}

#[tauri::command]
async fn import_sql_file(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    path: String,
) -> Result<(), String> {
    let mut connection = read(&app)?
        .into_iter()
        .find(|connection| connection.id == id)
        .ok_or("Connection not found")?;
    let _tunnel = active_connection(&state, &id, &mut connection)?;
    if connection.driver != "sqlite" && connection.authentication == "password" {
        connection.password = saved_password(&state, &id)?;
    }

    sql_import::import(connection, path.into()).await
}

fn main() {
    sqlx::any::install_default_drivers();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Store::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window_size::restore_and_track(window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            releases::open_latest_release,
            releases::open_project_page,
            pick_sqlite_file,
            pick_sql_file,
            import_sql_file,
            list_connections,
            connection_transfer::import_connections,
            connection_transfer::export_connections,
            test_connection,
            save_connection,
            remove_connection,
            open_connection,
            close_connection,
            list_tables,
            export_table,
            export_tables,
            delete_table,
            table_page,
            table_columns,
            save_table_structure,
            table_indexes,
            save_table_changes,
            queries::list_queries,
            queries::save_query,
            queries::remove_query,
            queries::run_query
        ])
        .build(tauri::generate_context!())
        .expect("Failed to build Zap")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Ok(mut sessions) = app.state::<Store>().pools.lock() {
                    sessions.clear();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(database: String) -> Connection {
        Connection {
            id: "test".into(),
            title: "Test".into(),
            environment: None,
            driver: "sqlite".into(),
            host: "localhost".into(),
            port: 5432,
            authentication: "password".into(),
            user: String::new(),
            password: "never-write-this".into(),
            database,
            ssh: None,
        }
    }
    #[test]
    fn saved_metadata_excludes_password() {
        let value = serde_json::to_string(&config("/tmp/example.sqlite".into())).unwrap();
        assert!(!value.contains("never-write-this"));
        assert!(!value.contains("password\":"));
    }
    #[test]
    fn connection_environment_is_optional_and_persists() {
        let legacy = serde_json::to_value(config("/tmp/example.sqlite".into())).unwrap();
        let connection: Connection = serde_json::from_value(legacy.clone()).unwrap();
        assert!(connection.environment.is_none());

        for environment in ["local", "prod"] {
            let mut value = legacy.clone();
            value["environment"] = serde_json::json!(environment);
            let connection: Connection = serde_json::from_value(value).unwrap();
            let saved = serde_json::to_value(connection).unwrap();
            assert_eq!(saved["environment"], environment);
            assert!(saved.get("password").is_none());
        }

        let mut invalid = legacy;
        invalid["environment"] = serde_json::json!("unknown");
        assert!(serde_json::from_value::<Connection>(invalid).is_err());
    }

    #[tokio::test]
    async fn sqlite_existing_file_and_read_write() {
        sqlx::any::install_default_drivers();
        let file = std::env::temp_dir().join(format!("zap test {}.sqlite", std::process::id()));
        let setup = sqlx::SqlitePool::connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&file)
                .create_if_missing(true),
        )
        .await
        .unwrap();
        sqlx::query("CREATE TABLE IF NOT EXISTS sample (id INTEGER, value TEXT)")
            .execute(&setup)
            .await
            .unwrap();
        setup.close().await;
        let p = connect(&config(file.to_string_lossy().to_string()))
            .await
            .unwrap();
        assert!(sqlx::query("SELECT * FROM sample")
            .fetch_all(&p)
            .await
            .is_ok());
        assert!(sqlx::query("INSERT INTO sample VALUES (1, NULL)")
            .execute(&p)
            .await
            .is_ok());
        p.close().await;
        std::fs::remove_file(file).unwrap();
        assert!(connect(&config("/does/not/exist/zap.sqlite".into()))
            .await
            .is_err());
    }

    #[tokio::test]
    async fn sqlite_listing_includes_views_with_their_kind() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for sql in [
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, total INTEGER)",
            "CREATE INDEX orders_total ON orders (total)",
            r#"CREATE VIEW "big orders" AS SELECT * FROM orders WHERE total > 100"#,
        ] {
            sqlx::query(sql).execute(&pool).await.unwrap();
        }

        let listed = table_listings(&pool, "sqlite").await.unwrap();
        assert_eq!(
            listed
                .iter()
                .map(|t| (t.name.as_str(), t.kind.as_str()))
                .collect::<Vec<_>>(),
            [("big orders", "view"), ("orders", "table")]
        );
    }
}

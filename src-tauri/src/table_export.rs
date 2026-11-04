use crate::{editor::quote, Connection, Table};
use futures_util::TryStreamExt;
use sqlx::{AnyPool, Row};
use std::{
    fs::{File, OpenOptions},
    io::{BufWriter, Write},
    path::Path,
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
};

static EXPORT_ID: AtomicU64 = AtomicU64::new(0);

pub async fn export(
    pool: &AnyPool,
    connection: Connection,
    tables: Vec<Table>,
    include_data: bool,
    path: &Path,
) -> Result<(), String> {
    if connection.driver == "sqlite"
        && path.exists()
        && path.canonicalize().map_err(|e| e.to_string())?
            == Path::new(&connection.database)
                .canonicalize()
                .map_err(|e| e.to_string())?
    {
        return Err("Choose a different file from the open SQLite database.".into());
    }

    let temporary = path.with_file_name(format!(
        ".zap-export-{}-{}.tmp",
        std::process::id(),
        EXPORT_ID.fetch_add(1, Ordering::Relaxed)
    ));
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|e| e.to_string())?;

    let result = if connection.driver == "sqlite" {
        sqlite_dump(pool, &tables, include_data, file).await
    } else {
        let (result, tables) = tokio::task::spawn_blocking(move || {
            (server_dump(connection, &tables, include_data, file), tables)
        })
        .await
        .unwrap_or_else(|error| (Err(error.to_string()), Vec::new()));

        match result {
            Ok(true) => Ok(()),
            Ok(false) => match File::create(&temporary) {
                Ok(file) => crate::postgres_export::dump(pool, &tables, include_data, file).await,
                Err(error) => Err(error.to_string()),
            },
            Err(error) => Err(error),
        }
    };

    let result = result.and_then(|()| std::fs::rename(&temporary, path).map_err(|e| e.to_string()));
    if result.is_err() {
        let _ = std::fs::remove_file(temporary);
    }
    result
}

fn server_dump(
    connection: Connection,
    tables: &[Table],
    include_data: bool,
    file: File,
) -> Result<bool, String> {
    let (program, mut command) = if connection.driver == "postgresql" {
        let program = "pg_dump";
        let mut database = url::Url::parse(&crate::connection_url(&connection)?)
            .map_err(|_| "Invalid PostgreSQL connection URL.")?;
        database
            .set_password(None)
            .map_err(|_| "Invalid PostgreSQL connection URL.")?;
        let mut command = client_command(program);
        command
            .args([
                "--no-password",
                "--strict-names",
                "--inserts",
                "--no-owner",
                "--no-privileges",
            ])
            .arg(format!("--dbname={database}"))
            .env("PGPASSWORD", connection.password);
        if !include_data {
            command.arg("--schema-only");
        }
        for table in tables {
            command.arg(format!(
                "--table={}",
                crate::editor::qualified("postgresql", table)
            ));
        }
        (program, command)
    } else if connection.driver == "mysql" {
        let program = "mysqldump";
        let mut command = client_command(program);
        command
            .args([
                "--no-defaults",
                "--protocol=TCP",
                "--single-transaction",
                "--quick",
                "--hex-blob",
                "--no-tablespaces",
                "--skip-add-drop-table",
            ])
            .arg(format!("--host={}", connection.host))
            .arg(format!("--port={}", connection.port))
            .arg(format!("--user={}", connection.user))
            .env("MYSQL_PWD", connection.password);
        if tables
            .iter()
            .any(|table| table.schema != connection.database)
        {
            return Err("Select tables from the current MySQL database.".into());
        }
        if !include_data {
            command.arg("--no-data");
        }
        command
            .args(["--", &connection.database])
            .args(tables.iter().map(|table| &table.name));
        (program, command)
    } else {
        return Err("Unsupported database driver.".into());
    };

    let output = match command
        .stdin(Stdio::null())
        .stdout(file)
        .stderr(Stdio::piped())
        .output()
    {
        Ok(output) => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && program == "pg_dump" => {
            return Ok(false)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(format!(
                "Install {program} and make it available on PATH to export this table."
            ));
        }
        Err(error) => return Err(error.to_string()),
    };

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr);
        return Err(format!("{program} failed: {}", message.trim()));
    }
    Ok(true)
}

fn client_command(program: &str) -> Command {
    if cfg!(target_os = "macos") {
        for directory in ["/opt/homebrew/bin", "/usr/local/bin"] {
            let executable = Path::new(directory).join(program);
            if executable.is_file() {
                return Command::new(executable);
            }
        }
    }
    Command::new(program)
}

async fn sqlite_dump(
    pool: &AnyPool,
    tables: &[Table],
    include_data: bool,
    file: File,
) -> Result<(), String> {
    let mut transaction = pool.begin().await.map_err(|e| e.to_string())?;
    let mut output = BufWriter::new(file);
    let encoding: String = sqlx::query_scalar("PRAGMA encoding")
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    writeln!(
        output,
        "PRAGMA encoding='{encoding}';\nPRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;"
    )
    .map_err(|e| e.to_string())?;
    for table in tables {
        let definition: String = sqlx::query_scalar(
            "SELECT sql FROM main.sqlite_schema WHERE type = 'table' AND name = ?",
        )
        .bind(&table.name)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
        writeln!(output, "{definition};").map_err(|e| e.to_string())?;
        if !include_data {
            continue;
        }
        let columns: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM pragma_table_xinfo(?, 'main') WHERE hidden = 0 ORDER BY cid",
        )
        .bind(&table.name)
        .fetch_all(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
        let target = quote("sqlite", &table.name);
        let columns: Vec<String> = columns.iter().map(|name| quote("sqlite", name)).collect();
        let expressions = columns.iter().map(|column| {
        format!("CASE typeof({column}) WHEN 'text' THEN 'CAST(X''' || hex({column}) || ''' AS TEXT)' ELSE quote({column}) END")
    }).collect::<Vec<_>>();

        {
            let column_list = columns.join(", ");
            let values = expressions.join(" || ', ' || ");
            let query = format!("SELECT {values} FROM main.{target}");
            let mut rows = sqlx::query(&query).fetch(&mut *transaction);
            while let Some(row) = rows.try_next().await.map_err(|e| e.to_string())? {
                let values: String = row.try_get(0).map_err(|e| e.to_string())?;
                writeln!(
                    output,
                    "INSERT INTO {target} ({column_list}) VALUES ({values});"
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    for table in tables {
        let objects: Vec<String> = sqlx::query_scalar("SELECT sql FROM main.sqlite_schema WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type")
        .bind(&table.name)
        .fetch_all(&mut *transaction).await.map_err(|e| e.to_string())?;
        for definition in objects {
            writeln!(output, "{definition};").map_err(|e| e.to_string())?;
        }
    }

    writeln!(output, "COMMIT;").map_err(|e| e.to_string())?;
    output.flush().map_err(|e| e.to_string())?;
    transaction.commit().await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sqlite_dump_restores_binary_and_text_with_nul() {
        sqlx::any::install_default_drivers();
        let source = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(
            "CREATE TABLE example (data BLOB, label TEXT, label_length AS (length(label)));
             INSERT INTO example (data, label) VALUES (X'FF00', CAST(X'610062' AS TEXT));
             CREATE INDEX example_label ON example(label);",
        )
        .execute(&source)
        .await
        .unwrap();

        let path = std::env::temp_dir().join(format!("zap-export-test-{}.sql", std::process::id()));
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        let table = Table {
            schema: String::new(),
            name: "example".into(),
        };
        let result = sqlite_dump(&source, std::slice::from_ref(&table), true, file).await;
        let script = std::fs::read_to_string(&path);
        std::fs::remove_file(&path).unwrap();
        result.unwrap();

        sqlx::raw_sql("CREATE TABLE second (id INT); INSERT INTO second VALUES (42); CREATE TABLE omitted (id INT);")
            .execute(&source)
            .await
            .unwrap();
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        let second = Table {
            schema: String::new(),
            name: "second".into(),
        };
        let selected = [
            Table {
                schema: String::new(),
                name: table.name.clone(),
            },
            second,
        ];
        let result = sqlite_dump(&source, &selected, false, file).await;
        let schema = std::fs::read_to_string(&path);
        std::fs::remove_file(&path).unwrap();
        result.unwrap();
        let schema = schema.unwrap();
        assert!(schema.contains("CREATE TABLE example"));
        assert!(schema.contains("CREATE TABLE second"));
        assert!(!schema.contains("omitted"));
        assert!(!schema.contains("INSERT INTO"));

        let restored = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(&script.unwrap())
            .execute(&restored)
            .await
            .unwrap();

        let row = sqlx::query("SELECT hex(data), hex(label) FROM example")
            .fetch_one(&restored)
            .await
            .unwrap();
        assert_eq!(row.get::<String, _>(0), "FF00");
        assert_eq!(row.get::<String, _>(1), "610062");
        assert_eq!(
            crate::catalog::indexes(&restored, "sqlite", &table)
                .await
                .unwrap()[0][0],
            "example_label"
        );
    }
}

use crate::Store;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use sqlx::{Column, Connection as _, Row};
use std::{
    path::Path,
    time::{Duration, Instant},
};
use tauri::State;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedQuery {
    id: String,
    connection_id: String,
    title: String,
    sql: String,
}
fn read_file(path: &Path) -> Result<Vec<SavedQuery>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}
fn write_file(path: &Path, queries: &[SavedQuery]) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec_pretty(queries).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temp, path).map_err(|e| e.to_string())
}
fn upsert(path: &Path, mut query: SavedQuery) -> Result<SavedQuery, String> {
    query.title = query.title.trim().to_owned();
    if query.id.is_empty() || query.title.is_empty() || query.sql.trim().is_empty() {
        return Err("Give the query a title and SQL code.".into());
    }
    let mut all = read_file(path)?;
    if let Some(existing) = all
        .iter_mut()
        .find(|q| q.id == query.id && q.connection_id == query.connection_id)
    {
        *existing = query.clone()
    } else {
        all.push(query.clone())
    }
    write_file(path, &all)?;
    Ok(query)
}
#[tauri::command]
pub fn list_queries(
    app: tauri::AppHandle,
    state: State<Store>,
    id: String,
) -> Result<Vec<SavedQuery>, String> {
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    Ok(
        read_file(&crate::path(&app)?.with_file_name("queries.json"))?
            .into_iter()
            .filter(|q| q.connection_id == id)
            .collect(),
    )
}
#[tauri::command]
pub fn save_query(
    app: tauri::AppHandle,
    state: State<Store>,
    query: SavedQuery,
) -> Result<SavedQuery, String> {
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    if !crate::read(&app)?
        .iter()
        .any(|c| c.id == query.connection_id)
    {
        return Err("Connection not found".into());
    }
    upsert(&crate::path(&app)?.with_file_name("queries.json"), query)
}
#[tauri::command]
pub fn remove_query(
    app: tauri::AppHandle,
    state: State<Store>,
    id: String,
    query_id: String,
) -> Result<(), String> {
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    let path = crate::path(&app)?.with_file_name("queries.json");
    let mut all = read_file(&path)?;
    all.retain(|q| !(q.id == query_id && q.connection_id == id));
    write_file(&path, &all)
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultSet {
    columns: Vec<String>,
    rows: Vec<Vec<Option<String>>>,
    rows_affected: u64,
    row_count: u64,
    truncated: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    results: Vec<ResultSet>,
    duration_ms: u128,
}
fn hex(bytes: Vec<u8>) -> String {
    use std::fmt::Write;
    let mut text = String::from("0x");
    for byte in bytes {
        let _ = write!(&mut text, "{byte:02x}");
    }
    text
}

async fn execute(driver: &str, url: &str, sql: &str) -> Result<QueryResult, String> {
    let started = Instant::now();
    // Simple (unprepared) PostgreSQL/MySQL queries return text values. This
    // handles UUID, numeric, dates, JSON, enums, etc. without Any's type mapping.
    macro_rules! fetch {
        ($connection:ty) => {{
            let mut connection =
                tokio::time::timeout(Duration::from_secs(10), <$connection>::connect(url))
                    .await
                    .map_err(|_| "Connection timed out")?
                    .map_err(|e| e.to_string())?;
            let mut results = vec![];
            let mut result = ResultSet::default();
            {
                let mut stream = sqlx::raw_sql(sql).fetch_many(&mut connection);
                while let Some(item) = stream.try_next().await.map_err(|e| e.to_string())? {
                    match item {
                        sqlx::Either::Right(row) => {
                            if result.columns.is_empty() {
                                result.columns =
                                    row.columns().iter().map(|c| c.name().to_owned()).collect()
                            }
                            result.row_count += 1;
                            if result.rows.len() < 1000 && results.len() < 100 {
                                let mut values = vec![];
                                for i in 0..row.len() {
                                    let value = row
                                        .try_get_unchecked::<Option<String>, _>(i)
                                        .or_else(|_| {
                                            row.try_get_unchecked::<Option<Vec<u8>>, _>(i)
                                                .map(|v| v.map(hex))
                                        })
                                        .map_err(|e| e.to_string())?;
                                    values.push(value);
                                }
                                result.rows.push(values);
                            } else {
                                result.truncated = true
                            }
                        }
                        sqlx::Either::Left(done) => {
                            result.rows_affected = done.rows_affected();
                            if results.len() >= 100 {
                                return Err(
                                    "Too many result sets. Run fewer statements at once.".into()
                                );
                            }
                            results.push(std::mem::take(&mut result));
                        }
                    }
                }
            }
            connection.close().await.map_err(|e| e.to_string())?;
            Ok(QueryResult {
                results,
                duration_ms: started.elapsed().as_millis(),
            })
        }};
    }
    match driver {
        "postgresql" => fetch!(sqlx::PgConnection),
        "mysql" => fetch!(sqlx::MySqlConnection),
        "sqlite" => fetch!(sqlx::SqliteConnection),
        _ => Err("Unsupported driver".into()),
    }
}
#[tauri::command]
pub async fn run_query(
    app: tauri::AppHandle,
    state: State<'_, Store>,
    id: String,
    sql: String,
) -> Result<QueryResult, String> {
    if sql.trim().is_empty() {
        return Err("Enter SQL to run.".into());
    }
    let mut connection = crate::read(&app)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    if connection.authentication == "password" && connection.driver != "sqlite" {
        connection.password = crate::saved_password(&state, &id)?;
    }
    let _tunnel = crate::active_connection(&state, &id, &mut connection)?;
    let url = crate::connection_url(&connection)?;
    tokio::time::timeout(Duration::from_secs(60),execute(&connection.driver,&url,&sql)).await.map_err(|_|"Query timed out after 60 seconds. Check the database before retrying writes; earlier statements may have committed.".to_owned())?
        .map_err(|error|format!("{error}\nIf running multiple statements, earlier statements may have committed."))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saved_queries_persist_and_update_without_crossing_connections() {
        let path = std::env::temp_dir().join(format!("zap-queries-{}.json", std::process::id()));
        let make = |connection: &str, title: &str| SavedQuery {
            id: "same-id".into(),
            connection_id: connection.into(),
            title: title.into(),
            sql: "SELECT 1".into(),
        };
        upsert(&path, make("one", "First")).unwrap();
        upsert(&path, make("two", "Other")).unwrap();
        upsert(&path, make("one", "Updated")).unwrap();
        let all = read_file(&path).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].title, "Updated");
        assert_eq!(all[1].title, "Other");
        assert!(upsert(&path, make("one", " ")).is_err());
        std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn executes_sqlite_scripts_with_values_nulls_and_affected_counts() {
        let result=execute("sqlite","sqlite::memory:","CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO test VALUES (1, 'hello'), (2, NULL); SELECT id, value, 1.5 AS decimal_value FROM test ORDER BY id;").await.unwrap();
        let data = result
            .results
            .iter()
            .find(|r| !r.columns.is_empty())
            .unwrap();
        assert_eq!(data.columns, vec!["id", "value", "decimal_value"]);
        assert_eq!(data.rows[0][0].as_deref(), Some("1"));
        assert!(data.rows[1][1].is_none());
        assert_eq!(data.rows[0][2].as_deref(), Some("1.5"));
        assert!(result.results.iter().any(|r| r.rows_affected == 2));
    }
    #[tokio::test]
    async fn caps_result_rows_and_reports_sql_errors() {
        let result=execute("sqlite","sqlite::memory:","WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1005) SELECT x FROM n").await.unwrap();
        assert_eq!(result.results[0].rows.len(), 1000);
        assert_eq!(result.results[0].row_count, 1005);
        assert!(result.results[0].truncated);
        assert!(
            execute("sqlite", "sqlite::memory:", "SELECT * FROM missing")
                .await
                .is_err()
        );
    }
}

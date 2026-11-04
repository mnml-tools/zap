use crate::Connection;
use futures_util::TryStreamExt;
use sqlx::Connection as _;
use std::{path::PathBuf, time::Duration};

pub async fn import(connection: Connection, path: PathBuf) -> Result<(), String> {
    let sql = tokio::task::spawn_blocking(move || std::fs::read_to_string(path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;
    let sql = sql.strip_prefix('\u{feff}').unwrap_or(&sql);
    if connection.driver != "sqlite" && starts_with_sqlite_pragma(sql) {
        return Err("This file starts with a SQLite PRAGMA. Choose a SQLite connection to import it. No statements were run.".into());
    }
    let url = crate::connection_url(&connection)?;

    // Each import uses a dedicated connection so script settings and open
    // transactions cannot leak into the workspace pool.
    macro_rules! execute_script {
        ($driver:ty, $script:expr, $map_error:expr) => {{
            let mut database =
                tokio::time::timeout(Duration::from_secs(10), <$driver>::connect(&url))
                    .await
                    .map_err(|_| "Connection timed out")?
                    .map_err(|error| error.to_string())?;
            let mut results = sqlx::raw_sql($script).fetch_many(&mut database);
            while results
                .try_next()
                .await
                .map_err(|error| {
                    let detail = ($map_error)(error);
                    format!("The import failed. Earlier statements may have been applied. {detail}")
                })?
                .is_some()
            {}
        }};
    }

    match connection.driver.as_str() {
        "postgresql" => {
            let sql = postgres_script(sql);
            execute_script!(sqlx::PgConnection, sql.as_ref(), |error: sqlx::Error| {
                let message = error.to_string();
                if message.contains("CopyInResponse") {
                    return "This file uses PostgreSQL COPY FROM STDIN. Import a dump generated with INSERT statements instead.".into();
                }
                message
            });
        }
        "mysql" => execute_script!(sqlx::MySqlConnection, sql, |error: sqlx::Error| error
            .to_string()),
        "sqlite" => execute_script!(sqlx::SqliteConnection, sql, |error: sqlx::Error| error
            .to_string()),
        _ => return Err("Unsupported database driver.".into()),
    }

    Ok(())
}

fn starts_with_sqlite_pragma(mut sql: &str) -> bool {
    loop {
        sql = sql.trim_start();
        if sql.starts_with("--") {
            let Some((_, rest)) = sql.split_once('\n') else {
                return false;
            };
            sql = rest;
        } else if let Some(comment) = sql.strip_prefix("/*") {
            let Some((_, rest)) = comment.split_once("*/") else {
                return false;
            };
            sql = rest;
        } else {
            return sql
                .split(|character: char| !(character.is_ascii_alphanumeric() || character == '_'))
                .next()
                .is_some_and(|word| word.eq_ignore_ascii_case("pragma"));
        }
    }
}

fn postgres_script(sql: &str) -> std::borrow::Cow<'_, str> {
    // pg_dump brackets its plain-text SQL with matching psql guard commands.
    // Strip only the outer pair and pass the SQL body unchanged.
    let mut lines = sql.split_inclusive('\n').filter(|line| {
        let line = line.trim();
        !line.is_empty() && !line.starts_with("--")
    });
    let Some(first) = lines.next() else {
        return sql.into();
    };
    let Some(last) = lines.last() else {
        return sql.into();
    };
    let Some(key) = first.trim().strip_prefix("\\restrict ") else {
        return sql.into();
    };
    if key.is_empty()
        || !key.bytes().all(|byte| byte.is_ascii_alphanumeric())
        || last.trim().strip_prefix("\\unrestrict ") != Some(key)
    {
        return sql.into();
    }

    let start = first.as_ptr() as usize - sql.as_ptr() as usize;
    let end = last.as_ptr() as usize - sql.as_ptr() as usize;
    format!(
        "{}{}{}",
        &sql[..start],
        &sql[start + first.len()..end],
        &sql[end + last.len()..]
    )
    .into()
}

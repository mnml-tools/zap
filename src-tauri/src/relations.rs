use crate::Table;
use serde::Serialize;
use sqlx::{any::AnyRow, AnyPool, Row};

/// An outgoing foreign key, with source columns as indexes into the page columns.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKey {
    pub columns: Vec<usize>,
    pub target: Table,
    pub target_columns: Vec<String>,
}

struct Reference {
    name: String,
    column: String,
    target_schema: String,
    target_table: String,
    target_column: Option<String>,
}

// Catalog text can use MySQL's BLOB protocol type, which Any cannot decode as String.
fn text(row: &AnyRow, index: usize) -> Result<Option<String>, String> {
    match row.try_get::<Option<String>, _>(index) {
        Ok(value) => Ok(value),
        Err(error) => row
            .try_get::<Option<Vec<u8>>, _>(index)
            .map_err(|_| error.to_string())?
            .map(String::from_utf8)
            .transpose()
            .map_err(|e| e.to_string()),
    }
}

async fn references(pool: &AnyPool, driver: &str, table: &Table) -> Result<Vec<Reference>, String> {
    let query = match driver {
        "postgresql" => {
            "SELECT con.conname::text, a.attname::text, tn.nspname::text, tc.relname::text, ta.attname::text
             FROM pg_catalog.pg_constraint con
             JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_catalog.pg_class tc ON tc.oid = con.confrelid
             JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
             CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(attnum, target_attnum, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
             JOIN pg_catalog.pg_attribute ta ON ta.attrelid = con.confrelid AND ta.attnum = k.target_attnum
             WHERE con.contype = 'f' AND n.nspname = $1 AND c.relname = $2
             ORDER BY con.conname, k.ord"
        }
        "mysql" => {
            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
             ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION"
        }
        "sqlite" => {
            r#"SELECT CAST(fk.id AS TEXT), fk."from", '', fk."table", fk."to"
               FROM pragma_foreign_key_list(?1, 'main') fk
               ORDER BY fk.id, fk.seq"#
        }
        _ => return Err("Unsupported driver".into()),
    };
    let rows = if driver == "sqlite" {
        sqlx::query(query).bind(&table.name)
    } else {
        sqlx::query(query).bind(&table.schema).bind(&table.name)
    }
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|row| {
            let required =
                |index| text(row, index)?.ok_or("Incomplete foreign key metadata.".to_string());
            Ok(Reference {
                name: required(0)?,
                column: required(1)?,
                target_schema: text(row, 2)?.unwrap_or_default(),
                target_table: required(3)?,
                target_column: text(row, 4)?,
            })
        })
        .collect()
}

// SQLite foreign keys may omit the parent columns, which then mean the parent's primary key.
async fn sqlite_primary_key(pool: &AnyPool, table: &str) -> Result<Vec<String>, String> {
    sqlx::query("SELECT name FROM pragma_table_info(?1, 'main') WHERE pk > 0 ORDER BY pk")
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
        .iter()
        .map(|row| text(row, 0)?.ok_or("Incomplete primary key metadata.".to_string()))
        .collect()
}

/// Foreign keys whose source columns are all present in `columns`.
pub async fn outgoing(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
    columns: &[String],
) -> Result<Vec<ForeignKey>, String> {
    let mut keys: Vec<(String, ForeignKey, bool)> = Vec::new();
    for reference in references(pool, driver, table).await? {
        let index = columns
            .iter()
            .position(|column| *column == reference.column);
        let same = keys
            .last()
            .is_some_and(|(name, _, _)| *name == reference.name);
        if !same {
            keys.push((
                reference.name.clone(),
                ForeignKey {
                    columns: vec![],
                    target: Table {
                        schema: reference.target_schema,
                        name: reference.target_table,
                    },
                    target_columns: vec![],
                },
                true,
            ));
        }
        let (_, key, complete) = keys.last_mut().unwrap();
        match index {
            Some(index) => key.columns.push(index),
            None => *complete = false,
        }
        match reference.target_column {
            Some(column) => key.target_columns.push(column),
            None if driver == "sqlite" => {}
            None => *complete = false,
        }
    }

    let mut result = Vec::new();
    for (_, mut key, complete) in keys {
        if driver == "sqlite" && key.target_columns.is_empty() {
            key.target_columns = sqlite_primary_key(pool, &key.target.name).await?;
        }
        if complete && !key.columns.is_empty() && key.columns.len() == key.target_columns.len() {
            result.push(key);
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sqlite_lists_single_composite_and_implicit_primary_key_references() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(
            r#"CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT UNIQUE);
               CREATE TABLE "order lines" (tenant INTEGER, number INTEGER, PRIMARY KEY (tenant, number));
               CREATE TABLE notes (
                   id INTEGER PRIMARY KEY,
                   author INTEGER REFERENCES customers,
                   author_email TEXT REFERENCES customers (email),
                   tenant INTEGER,
                   line INTEGER,
                   body TEXT,
                   FOREIGN KEY (tenant, line) REFERENCES "order lines" (tenant, number)
               );"#,
        )
        .execute(&pool)
        .await
        .unwrap();
        let table = Table {
            schema: String::new(),
            name: "notes".into(),
        };
        let columns = ["id", "author", "author_email", "tenant", "line", "body"].map(String::from);

        let mut keys = outgoing(&pool, "sqlite", &table, &columns).await.unwrap();
        keys.sort_by_key(|key| key.columns.clone());
        let target = |name: &str| Table {
            schema: String::new(),
            name: name.into(),
        };
        assert_eq!(
            keys,
            vec![
                ForeignKey {
                    columns: vec![1],
                    target: target("customers"),
                    target_columns: vec!["id".into()]
                },
                ForeignKey {
                    columns: vec![2],
                    target: target("customers"),
                    target_columns: vec!["email".into()]
                },
                ForeignKey {
                    columns: vec![3, 4],
                    target: target("order lines"),
                    target_columns: vec!["tenant".into(), "number".into()]
                },
            ]
        );

        // A key is omitted when one of its columns is not part of the page.
        let partial = ["id", "author", "author_email", "tenant", "body"].map(String::from);
        assert_eq!(
            outgoing(&pool, "sqlite", &table, &partial)
                .await
                .unwrap()
                .len(),
            2
        );
        assert!(outgoing(
            &pool,
            "sqlite",
            &Table {
                schema: String::new(),
                name: "customers".into()
            },
            &["id".into(), "email".into()]
        )
        .await
        .unwrap()
        .is_empty());
    }
}

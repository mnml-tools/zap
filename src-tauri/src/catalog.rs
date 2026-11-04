use crate::Table;
use sqlx::{AnyPool, Row};

pub async fn columns(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
) -> Result<Vec<[Option<String>; 5]>, String> {
    let query = match driver {
        "postgresql" => {
            // Read optional catalog fields by key so older PostgreSQL servers can parse the query.
            "
            SELECT a.attname::text,
                   pg_catalog.format_type(a.atttypid, a.atttypmod),
                   CASE WHEN a.attnotnull OR t.typnotnull THEN 'No' ELSE 'Yes' END,
                   CASE WHEN COALESCE(pg_catalog.row_to_json(a)->>'attgenerated', '') = '' THEN pg_catalog.pg_get_expr(d.adbin, d.adrelid) END,
                   pg_catalog.col_description(c.oid, a.attnum::integer)
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
            WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attnum"
        }
        "mysql" => {
            "
            SELECT COLUMN_NAME, COLUMN_TYPE,
                   CASE WHEN IS_NULLABLE = 'YES' THEN 'Yes' ELSE 'No' END,
                   CAST(COLUMN_DEFAULT AS CHAR), COLUMN_COMMENT
            FROM information_schema.columns
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION"
        }
        "sqlite" => {
            r#"
            SELECT x.name, COALESCE(NULLIF(x.type, ''), 'No declared type'),
                   CASE WHEN x."notnull" = 1 OR (
                       x.pk > 0 AND (
                           t.wr = 1 OR t.strict = 1 OR (
                               x.type COLLATE NOCASE = 'INTEGER' AND NOT EXISTS (
                                   SELECT 1 FROM pragma_index_list(?1, 'main') WHERE origin = 'pk'
                               )
                           )
                       )
                   ) THEN 'No' ELSE 'Yes' END,
                   x.dflt_value, CAST(NULL AS TEXT)
            FROM pragma_table_xinfo(?1, 'main') x
            JOIN pragma_table_list(?1) t ON t.schema = 'main'
            WHERE x.hidden <> 1
            ORDER BY x.cid"#
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
    .map_err(|error| error.to_string())?;

    if rows.is_empty() {
        return Err("Table no longer exists or its columns are inaccessible.".into());
    }

    rows.iter()
        .map(|row| {
            Ok([
                row.try_get(0)?,
                row.try_get(1)?,
                row.try_get(2)?,
                row.try_get(3)?,
                row.try_get(4)?,
            ])
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(|error| error.to_string())
}

pub async fn indexes(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
) -> Result<Vec<[String; 4]>, String> {
    let query = match driver {
        "postgresql" => "
            SELECT idx.relname::text,
                   CASE WHEN i.indisprimary THEN 'Primary' WHEN i.indisunique THEN 'Unique' ELSE 'Index' END,
                   part.number::text,
                   pg_catalog.pg_get_indexdef(i.indexrelid, part.number, false)
            FROM pg_catalog.pg_index i
            JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
            JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN LATERAL pg_catalog.generate_series(1, i.indnatts) AS part(number)
            WHERE n.nspname = $1 AND c.relname = $2
            ORDER BY idx.relname, part.number",
        "mysql" => "
            SELECT INDEX_NAME,
                   CASE WHEN INDEX_NAME = 'PRIMARY' THEN 'Primary' WHEN NON_UNIQUE = 0 THEN 'Unique' ELSE 'Index' END,
                   CAST(SEQ_IN_INDEX AS CHAR),
                   CAST(CONCAT(COALESCE(COLUMN_NAME, '(expression)'),
                               IF(SUB_PART IS NULL, '', CONCAT('(', SUB_PART, ')')),
                               IF(COLLATION = 'D', ' DESC', '')) AS CHAR)
            FROM information_schema.statistics
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY INDEX_NAME, SEQ_IN_INDEX",
        "sqlite" => r#"
            SELECT i.name,
                   CASE WHEN i.origin = 'pk' THEN 'Primary' WHEN i."unique" = 1 THEN 'Unique' ELSE 'Index' END,
                   CAST(k.seqno + 1 AS TEXT),
                   COALESCE(k.name, CASE WHEN k.cid = -1 THEN '(rowid)' ELSE '(expression)' END)
                       || CASE WHEN k."desc" = 1 THEN ' DESC' ELSE '' END
            FROM pragma_index_list(?, 'main') i
            CROSS JOIN pragma_index_xinfo(i.name, 'main') k
            WHERE k."key" = 1
            ORDER BY i.name, k.seqno"#,
        _ => return Err("Unsupported driver".into()),
    };
    let rows = if driver == "sqlite" {
        sqlx::query(query).bind(&table.name)
    } else {
        sqlx::query(query).bind(&table.schema).bind(&table.name)
    }
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    rows.iter()
        .map(|row| {
            Ok([
                row.try_get(0)?,
                row.try_get(1)?,
                row.try_get(2)?,
                row.try_get(3)?,
            ])
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sqlite_catalog_lists_declared_types_and_ordered_index_keys() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        let table = Table {
            schema: String::new(),
            name: "sample table".into(),
        };

        sqlx::query(
            r#"CREATE TABLE "sample table" (id INTEGER PRIMARY KEY, label VARCHAR(50) NOT NULL DEFAULT 'sample', extra DEFAULT NULL)"#,
        )
        .execute(&pool)
        .await
        .unwrap();

        assert!(indexes(&pool, "sqlite", &table).await.unwrap().is_empty());

        sqlx::query(
            r#"CREATE UNIQUE INDEX sample_idx ON "sample table" (label DESC, lower(extra))"#,
        )
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(
            columns(&pool, "sqlite", &table).await.unwrap(),
            [
                [Some("id"), Some("INTEGER"), Some("No"), None, None],
                [
                    Some("label"),
                    Some("VARCHAR(50)"),
                    Some("No"),
                    Some("'sample'"),
                    None
                ],
                [
                    Some("extra"),
                    Some("No declared type"),
                    Some("Yes"),
                    Some("NULL"),
                    None
                ],
            ]
            .map(|row| row.map(|value| value.map(str::to_owned)))
        );
        assert_eq!(
            indexes(&pool, "sqlite", &table).await.unwrap(),
            [
                ["sample_idx", "Unique", "1", "label DESC"],
                ["sample_idx", "Unique", "2", "(expression)"]
            ]
        );
    }

    #[tokio::test]
    async fn sqlite_structure_renames_preserve_data_and_roll_back_on_conflict() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        let table = Table {
            schema: String::new(),
            name: "original".into(),
        };

        sqlx::query("CREATE TABLE original (label TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO original VALUES ('retained')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE occupied (id INTEGER)")
            .execute(&pool)
            .await
            .unwrap();

        let changes = || {
            vec![ColumnChange {
                column: "label".into(),
                field: 0,
                value: Some("new label".into()),
            }]
        };

        let additions = || {
            vec![NewColumn {
                name: "enabled".into(),
                kind: "INT".into(),
                nullable: "No".into(),
                default: Some("1".into()),
                comment: None,
            }]
        };

        assert!(save_structure(
            &pool,
            "sqlite",
            &table,
            Some("occupied".into()),
            changes(),
            additions()
        )
        .await
        .is_err());
        assert_eq!(
            columns(&pool, "sqlite", &table).await.unwrap()[0][0].as_deref(),
            Some("label")
        );

        save_structure(
            &pool,
            "sqlite",
            &table,
            Some("new table".into()),
            changes(),
            additions(),
        )
        .await
        .unwrap();
        let value: String = sqlx::query_scalar(r#"SELECT "new label" FROM "new table""#)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(value, "retained");
        let enabled: i64 = sqlx::query_scalar(r#"SELECT enabled FROM "new table""#)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(enabled, 1);
    }
}

#[derive(serde::Deserialize)]
pub struct ColumnChange {
    column: String,
    field: usize,
    value: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct NewColumn {
    name: String,
    kind: String,
    nullable: String,
    default: Option<String>,
    comment: Option<String>,
}

pub async fn save_structure(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
    name: Option<String>,
    changes: Vec<ColumnChange>,
    additions: Vec<NewColumn>,
) -> Result<(), String> {
    use crate::editor::{qualified, quote};

    fn identifier(driver: &str, value: &str) -> Result<String, String> {
        if value.trim().is_empty() || value.contains('\0') {
            return Err("Enter a valid, non-empty name.".into());
        }
        if driver == "postgresql" && value.len() > 63 {
            return Err("PostgreSQL names must fit within 63 bytes.".into());
        }

        Ok(quote(driver, value))
    }

    let target = qualified(driver, table);
    let mut alterations = Vec::new();
    let mut renames = Vec::new();
    for change in changes {
        let column = identifier(driver, &change.column)?;
        let value = change.value.as_deref();
        let required = || {
            value
                .filter(|s| !s.trim().is_empty())
                .ok_or("Enter a value.")
        };
        let fragment = || {
            let sql = required()?;
            if sql.contains('\0') {
                return Err("Use a valid SQL type or expression.");
            }
            Ok(sql)
        };

        if change.field == 0 {
            renames.push(format!(
                "RENAME COLUMN {column} TO {}",
                identifier(driver, required()?)?
            ));
            continue;
        }

        if driver != "postgresql" {
            return Err("This database supports table and column renaming in Structure.".into());
        }

        let sql = match change.field {
            1 => format!(
                "ALTER TABLE {target} ALTER COLUMN {column} TYPE {}",
                fragment()?
            ),
            2 => {
                let action = match value {
                    Some("Yes") => "DROP NOT NULL",
                    Some("No") => "SET NOT NULL",
                    _ => return Err("Nullable must be Yes or No.".into()),
                };
                format!("ALTER TABLE {target} ALTER COLUMN {column} {action}")
            }
            3 => {
                let action = if value.is_some() {
                    format!("SET DEFAULT {}", fragment()?)
                } else {
                    "DROP DEFAULT".into()
                };
                format!("ALTER TABLE {target} ALTER COLUMN {column} {action}")
            }
            4 => {
                let comment = match value {
                    Some(value) => {
                        format!("E'{}'", value.replace('\\', "\\\\").replace('\'', "''"))
                    }
                    None => "NULL".into(),
                };
                format!("COMMENT ON COLUMN {target}.{column} IS {comment}")
            }
            _ => return Err("Unknown column property.".into()),
        };
        alterations.push(sql);
    }

    let mut comments = Vec::new();
    for addition in additions {
        let column = identifier(driver, &addition.name)?;
        let kind = addition.kind.trim();
        if kind.is_empty() || kind.contains([';', '\0']) {
            return Err("Enter a valid SQL data type.".into());
        }
        let mut clause = format!("ADD COLUMN {column} {kind}");
        match addition.nullable.as_str() {
            "Yes" => {}
            "No" => clause.push_str(" NOT NULL"),
            _ => return Err("Nullable must be Yes or No.".into()),
        }
        if let Some(default) = addition.default {
            let default = default.trim();
            if default.is_empty() || default.contains([';', '\0']) {
                return Err("Enter a valid SQL default expression.".into());
            }
            clause.push_str(&format!(" DEFAULT {default}"));
        }
        renames.push(clause);

        if let Some(comment) = addition.comment {
            if driver != "postgresql" {
                return Err("Comments on new fields are supported for PostgreSQL.".into());
            }
            let comment = comment.replace('\\', "\\\\").replace('\'', "''");
            comments.push(format!(
                "COMMENT ON COLUMN {target}.{column} IS E'{comment}'"
            ));
        }
    }

    let table_rename = if let Some(name) = name {
        let name = identifier(driver, &name)?;
        let destination = if driver == "mysql" && !table.schema.is_empty() {
            format!("{}.{name}", quote(driver, &table.schema))
        } else {
            name
        };
        Some(format!("RENAME TO {destination}"))
    } else {
        None
    };

    if driver == "mysql" {
        renames.extend(table_rename);
        if !renames.is_empty() {
            sqlx::query(&format!("ALTER TABLE {target} {}", renames.join(", ")))
                .execute(pool)
                .await
                .map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    alterations.extend(
        renames
            .into_iter()
            .map(|rename| format!("ALTER TABLE {target} {rename}")),
    );
    alterations.extend(comments);
    alterations.extend(table_rename.map(|rename| format!("ALTER TABLE {target} {rename}")));
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    for sql in alterations {
        sqlx::query(&sql)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())
}

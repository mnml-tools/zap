use crate::Table;
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, Row};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub total: i64,
    pub primary_keys: Vec<usize>,
    pub editable: Vec<bool>,
    pub read_only_reason: Option<String>,
}
struct Column {
    name: String,
    kind: String,
    writable: bool,
    primary: i64,
}
struct Metadata {
    columns: Vec<Column>,
    reason: Option<String>,
}
pub(crate) fn quote(driver: &str, name: &str) -> String {
    if driver == "mysql" {
        format!("`{}`", name.replace('`', "``"))
    } else {
        format!("\"{}\"", name.replace('"', "\"\""))
    }
}
pub(crate) fn qualified(driver: &str, table: &Table) -> String {
    if table.schema.is_empty() {
        quote(driver, &table.name)
    } else {
        format!(
            "{}.{}",
            quote(driver, &table.schema),
            quote(driver, &table.name)
        )
    }
}
fn text(driver: &str, field: &str) -> String {
    format!(
        "CAST({field} AS {})",
        if driver == "mysql" { "CHAR" } else { "TEXT" }
    )
}
async fn metadata(pool: &AnyPool, driver: &str, table: &Table) -> Result<Metadata, String> {
    let columns = match driver {
        "postgresql" => {
            // Read optional catalog fields by key so older PostgreSQL servers can parse the query.
            let rows = sqlx::query("SELECT a.attname::text AS name, pg_catalog.format_type(a.atttypid,NULL)::text AS kind, CASE WHEN COALESCE(pg_catalog.row_to_json(a)->>'attgenerated', '')='' AND COALESCE(pg_catalog.row_to_json(a)->>'attidentity', '')<>'a' THEN 1::bigint ELSE 0::bigint END AS writable, CASE WHEN a.attnum=ANY(i.indkey) THEN 1::bigint ELSE 0::bigint END AS pk FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_index i ON i.indrelid=c.oid AND i.indisprimary WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum")
                .bind(&table.schema).bind(&table.name).fetch_all(pool).await.map_err(|e|e.to_string())?;
            rows.iter()
                .map(|r| {
                    Ok(Column {
                        name: r.try_get("name").map_err(|e| e.to_string())?,
                        kind: r.try_get("kind").map_err(|e| e.to_string())?,
                        writable: r.try_get::<i64, _>("writable").map_err(|e| e.to_string())? == 1,
                        primary: r.try_get("pk").map_err(|e| e.to_string())?,
                    })
                })
                .collect::<Result<Vec<_>, String>>()?
        }
        "mysql" => {
            let rows=sqlx::query("SELECT COLUMN_NAME AS name, DATA_TYPE AS kind, EXTRA AS extra, COLUMN_KEY AS key_kind FROM information_schema.columns WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION")
                .bind(&table.schema).bind(&table.name).fetch_all(pool).await.map_err(|e|e.to_string())?;
            rows.iter()
                .map(|r| {
                    let kind: String = r.try_get("kind").map_err(|e| e.to_string())?;
                    let extra: String = r.try_get("extra").map_err(|e| e.to_string())?;
                    let key: String = r.try_get("key_kind").map_err(|e| e.to_string())?;
                    Ok(Column {
                        name: r.try_get("name").map_err(|e| e.to_string())?,
                        writable: !extra.contains("VIRTUAL GENERATED")
                            && !extra.contains("STORED GENERATED")
                            && ![
                                "binary",
                                "varbinary",
                                "tinyblob",
                                "blob",
                                "mediumblob",
                                "longblob",
                                "bit",
                                "geometry",
                                "point",
                                "polygon",
                                "linestring",
                            ]
                            .contains(&kind.as_str()),
                        kind,
                        primary: if key == "PRI" { 1 } else { 0 },
                    })
                })
                .collect::<Result<Vec<_>, String>>()?
        }
        "sqlite" => {
            let rows=sqlx::query("SELECT name, type AS kind, CAST(pk AS INTEGER) AS pk, CAST(hidden AS INTEGER) AS hidden FROM pragma_table_xinfo(?)").bind(&table.name).fetch_all(pool).await.map_err(|e|e.to_string())?;
            let mut columns = Vec::new();
            for row in rows {
                let hidden: i64 = row.try_get("hidden").map_err(|e| e.to_string())?;
                if hidden == 1 {
                    continue;
                }
                let kind: String = row.try_get("kind").map_err(|e| e.to_string())?;
                columns.push(Column {
                    name: row.try_get("name").map_err(|e| e.to_string())?,
                    writable: hidden == 0 && !kind.to_uppercase().contains("BLOB"),
                    kind,
                    primary: row.try_get("pk").map_err(|e| e.to_string())?,
                });
            }
            columns
        }
        _ => return Err("Unsupported driver".into()),
    };
    if columns.is_empty() {
        return Err("Table no longer exists or its columns are inaccessible.".into());
    }
    let mut reason = if columns.iter().any(|c| c.primary > 0) {
        None
    } else {
        Some("This table has no primary key. Cells are read-only.".into())
    };
    if driver == "mysql" {
        let row=sqlx::query("SELECT ENGINE AS engine FROM information_schema.tables WHERE TABLE_SCHEMA=? AND TABLE_NAME=?").bind(&table.schema).bind(&table.name).fetch_one(pool).await.map_err(|e|e.to_string())?;
        let engine: Option<String> = row.try_get("engine").map_err(|e| e.to_string())?;
        if !engine.is_some_and(|e| e.eq_ignore_ascii_case("InnoDB")) {
            reason = Some("Editing requires a transactional InnoDB table.".into());
        }
    }
    Ok(Metadata { columns, reason })
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}
#[derive(Deserialize)]
pub struct TableSort {
    pub column: String,
    pub direction: SortDirection,
}

#[cfg(test)]
pub async fn page(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
    page: u32,
    filters: &[crate::filters::TableFilter],
) -> Result<Page, String> {
    page_sorted(pool, driver, table, page, filters, None).await
}
pub async fn page_sorted(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
    page: u32,
    filters: &[crate::filters::TableFilter],
    sort: Option<&TableSort>,
) -> Result<Page, String> {
    let meta = metadata(pool, driver, table).await?;
    let name = qualified(driver, table);
    let filter_columns = meta
        .columns
        .iter()
        .map(|c| (c.name.clone(), c.kind.clone()))
        .collect::<Vec<_>>();
    let (where_sql, values) = crate::filters::build(driver, &filter_columns, filters)?;
    let columns = meta
        .columns
        .iter()
        .map(|c| c.name.clone())
        .collect::<Vec<_>>();
    let primary_keys = meta
        .columns
        .iter()
        .enumerate()
        .filter(|(_, c)| c.primary > 0)
        .map(|(i, _)| i)
        .collect::<Vec<_>>();
    let fields = columns
        .iter()
        .map(|c| {
            format!(
                "{} AS {}",
                text(driver, &format!("zap_row.{}", quote(driver, c))),
                quote(driver, c)
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    let count_sql = format!(
        "SELECT {} FROM {name} AS zap_row{where_sql}",
        if driver == "mysql" {
            "CAST(COUNT(*) AS SIGNED)"
        } else {
            "COUNT(*)"
        }
    );
    let mut count_query = sqlx::query(&count_sql);
    for value in &values {
        count_query = count_query.bind(value);
    }
    let total: i64 = count_query
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .try_get(0)
        .map_err(|e| e.to_string())?;
    let mut order_fields = Vec::new();
    if let Some(sort) = sort {
        if !columns.contains(&sort.column) {
            return Err("Sort column no longer exists.".into());
        }
        let direction = match sort.direction {
            SortDirection::Asc => "ASC",
            SortDirection::Desc => "DESC",
        };
        order_fields.push(format!(
            "zap_row.{} {direction}",
            quote(driver, &sort.column)
        ));
    }
    // Primary-key tie breakers keep equal values in a stable order across pages.
    for index in &primary_keys {
        if sort.is_none_or(|s| s.column != columns[*index]) {
            order_fields.push(format!("zap_row.{} ASC", quote(driver, &columns[*index])));
        }
    }
    let order = if order_fields.is_empty() {
        String::new()
    } else {
        format!(" ORDER BY {}", order_fields.join(","))
    };
    let row_sql = format!(
        "SELECT {fields} FROM {name} AS zap_row{where_sql}{order} LIMIT 100 OFFSET {}",
        u64::from(page) * 100
    );
    let mut row_query = sqlx::query(&row_sql);
    for value in &values {
        row_query = row_query.bind(value);
    }
    let results = row_query.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let rows = results
        .iter()
        .map(|r| {
            (0..columns.len())
                .map(|i| r.try_get::<Option<String>, _>(i).map_err(|e| e.to_string()))
                .collect()
        })
        .collect::<Result<Vec<_>, _>>()?;
    let editable = meta
        .columns
        .iter()
        .map(|c| c.writable && meta.reason.is_none())
        .collect();
    Ok(Page {
        columns,
        rows,
        total,
        primary_keys,
        editable,
        read_only_reason: meta.reason,
    })
}
#[derive(Deserialize)]
pub struct CellChange {
    pub column: String,
    pub value: Option<String>,
}
#[derive(Deserialize)]
pub struct RowChange {
    pub original: Vec<Option<String>>,
    pub changes: Vec<CellChange>,
}

pub async fn save(
    pool: &AnyPool,
    driver: &str,
    table: &Table,
    columns: &[String],
    edits: &[RowChange],
) -> Result<(), String> {
    if edits.is_empty() {
        return Ok(());
    }
    let meta = metadata(pool, driver, table).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let result:Result<(),String>=async {
        if let Some(reason)=meta.reason{return Err(reason)}
        if columns!=meta.columns.iter().map(|c|c.name.clone()).collect::<Vec<_>>(){return Err("Table structure changed. Reload the table before editing.".into())}
        let name=qualified(driver,table);
        for edit in edits {
            if edit.original.len()!=columns.len()||edit.changes.is_empty(){return Err("Invalid row change".into())}
            if meta.columns.iter().enumerate().any(|(i,c)|c.primary>0 && edit.original[i].is_none()){return Err("Rows with a NULL primary key cannot be edited.".into())}
            let mut bindings:Vec<Option<String>>=vec![];
            let mut assignments=vec![];
            let mut seen=std::collections::HashSet::new();
            for change in &edit.changes {
                let col=meta.columns.iter().find(|c|c.name==change.column).ok_or("Unknown column")?;
                if !col.writable || !seen.insert(&col.name){return Err("Column is not editable or appears twice.".into())}
                bindings.push(change.value.clone());
                let value=if driver=="postgresql"{format!("CAST(CAST(${} AS TEXT) AS {})",bindings.len(),col.kind)}else{"?".into()};
                assignments.push(format!("{} = {value}",quote(driver,&col.name)));
            }
            // Match the original snapshot as well as its primary key. A stale or
            // deleted row fails the entire transaction rather than overwriting it.
            let mut predicates=vec![];
            for (i,column) in columns.iter().enumerate() {
                let field=text(driver,&quote(driver,column));
                if let Some(value)=&edit.original[i] {
                    bindings.push(Some(value.clone()));
                    let parameter=if driver=="postgresql"{format!("${}",bindings.len())}else{"?".into()};
                    predicates.push(if driver=="mysql"{format!("BINARY {field} = BINARY {parameter}")}else if driver=="sqlite"{format!("{field} COLLATE BINARY = {parameter}")}else{format!("{field} = {parameter}")});
                }else{predicates.push(format!("{field} IS NULL"))}
            }
            let sql=format!("UPDATE {name} SET {} WHERE {}",assignments.join(","),predicates.join(" AND "));
            let mut query=sqlx::query(&sql);
            for value in bindings {query=query.bind(value);}
            let affected=query.execute(&mut *tx).await.map_err(|e|e.to_string())?.rows_affected();
            if affected!=1{return Err("A row changed or was deleted since it was loaded. No changes were saved. Discard and refresh before trying again.".into())}
        }
        Ok(())
    }.await;
    match result {
        Ok(()) => tx.commit().await.map_err(|e| e.to_string()),
        Err(error) => {
            tx.rollback().await.map_err(|e| e.to_string())?;
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    async fn fixture() -> (AnyPool, Table) {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE \"order details\" (tenant INTEGER, id INTEGER, value TEXT, amount INTEGER CHECK(amount >= 0), label TEXT GENERATED ALWAYS AS (value || '!') VIRTUAL, PRIMARY KEY(tenant,id))").execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO \"order details\" (tenant,id,value,amount) VALUES (1,1,'first',10),(1,2,NULL,20)").execute(&pool).await.unwrap();
        (
            pool,
            Table {
                schema: String::new(),
                name: "order details".into(),
            },
        )
    }
    fn change(original: &[Option<String>], column: &str, value: Option<&str>) -> RowChange {
        RowChange {
            original: original.to_vec(),
            changes: vec![CellChange {
                column: column.into(),
                value: value.map(str::to_owned),
            }],
        }
    }
    #[tokio::test]
    async fn edits_target_composite_key_and_preserve_literal_values_and_nulls() {
        let (pool, table) = fixture().await;
        let before = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        assert_eq!(before.primary_keys, vec![0, 1]);
        assert!(!before.editable[4]);
        let literal = "O'Reilly'); DROP TABLE x; --";
        save(
            &pool,
            "sqlite",
            &table,
            &before.columns,
            &[
                change(&before.rows[0], "value", Some(literal)),
                change(&before.rows[1], "value", Some("")),
            ],
        )
        .await
        .unwrap();
        let after = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        assert_eq!(after.rows[0][2].as_deref(), Some(literal));
        assert_eq!(after.rows[1][2].as_deref(), Some(""));
        assert_eq!(
            after.rows[0][4].as_deref(),
            Some(format!("{literal}!").as_str())
        );
        save(
            &pool,
            "sqlite",
            &table,
            &after.columns,
            &[change(&after.rows[0], "value", None)],
        )
        .await
        .unwrap();
        assert!(page(&pool, "sqlite", &table, 0, &[]).await.unwrap().rows[0][2].is_none());
    }
    #[tokio::test]
    async fn stale_row_rolls_back_whole_batch() {
        let (pool, table) = fixture().await;
        let before = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        sqlx::query("UPDATE \"order details\" SET amount=21 WHERE id=2")
            .execute(&pool)
            .await
            .unwrap();
        let error = save(
            &pool,
            "sqlite",
            &table,
            &before.columns,
            &[
                change(&before.rows[0], "value", Some("local")),
                change(&before.rows[1], "value", Some("stale")),
            ],
        )
        .await
        .unwrap_err();
        assert!(error.contains("No changes were saved"));
        let after = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        assert_eq!(after.rows[0][2].as_deref(), Some("first"));
        assert_eq!(after.rows[1][3].as_deref(), Some("21"));
    }
    #[tokio::test]
    async fn constraint_failure_rolls_back_and_generated_columns_are_rejected() {
        let (pool, table) = fixture().await;
        let before = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        assert!(save(
            &pool,
            "sqlite",
            &table,
            &before.columns,
            &[
                change(&before.rows[0], "value", Some("local")),
                change(&before.rows[1], "amount", Some("-1"))
            ]
        )
        .await
        .is_err());
        assert_eq!(
            page(&pool, "sqlite", &table, 0, &[]).await.unwrap().rows[0][2].as_deref(),
            Some("first")
        );
        assert!(save(
            &pool,
            "sqlite",
            &table,
            &before.columns,
            &[change(&before.rows[0], "label", Some("override"))]
        )
        .await
        .is_err());
    }
    #[tokio::test]
    async fn no_primary_key_and_changed_schema_are_rejected() {
        let (pool, table) = fixture().await;
        let before = page(&pool, "sqlite", &table, 0, &[]).await.unwrap();
        sqlx::query("ALTER TABLE \"order details\" ADD COLUMN new_column TEXT")
            .execute(&pool)
            .await
            .unwrap();
        assert!(save(
            &pool,
            "sqlite",
            &table,
            &before.columns,
            &[change(&before.rows[0], "value", Some("x"))]
        )
        .await
        .unwrap_err()
        .contains("structure changed"));
        sqlx::query("CREATE TABLE duplicates (value TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO duplicates VALUES ('same'),('same')")
            .execute(&pool)
            .await
            .unwrap();
        let no_key = Table {
            schema: String::new(),
            name: "duplicates".into(),
        };
        let snapshot = page(&pool, "sqlite", &no_key, 0, &[]).await.unwrap();
        assert!(snapshot.read_only_reason.is_some());
        assert!(snapshot.editable.iter().all(|x| !*x));
        assert!(save(
            &pool,
            "sqlite",
            &no_key,
            &snapshot.columns,
            &[change(&snapshot.rows[0], "value", Some("x"))]
        )
        .await
        .is_err());
    }
    #[tokio::test]
    async fn filters_apply_before_pagination_and_count_matches() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE items(id INTEGER PRIMARY KEY, label TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<250) INSERT INTO items SELECT x, 'item ' || x FROM n").execute(&pool).await.unwrap();
        let table = Table {
            schema: String::new(),
            name: "items".into(),
        };
        let filter = |column: &str, operator: &str, value: &str| crate::filters::TableFilter {
            column: column.into(),
            operator: operator.into(),
            value: value.into(),
            enabled: true,
        };
        let filtered = page(&pool, "sqlite", &table, 0, &[filter("id", "gte", "100")])
            .await
            .unwrap();
        assert_eq!(filtered.total, 151);
        assert_eq!(filtered.rows.len(), 100);
        assert_eq!(filtered.rows[0][0].as_deref(), Some("100"));
        let second = page(&pool, "sqlite", &table, 1, &[filter("id", "gte", "100")])
            .await
            .unwrap();
        assert_eq!(second.total, 151);
        assert_eq!(second.rows.len(), 51);
        assert_eq!(second.rows[0][0].as_deref(), Some("200"));
        let combined = page(
            &pool,
            "sqlite",
            &table,
            0,
            &[filter("id", "in", "2, 101, 203"), filter("id", "gt", "100")],
        )
        .await
        .unwrap();
        assert_eq!(combined.total, 2);
        assert_eq!(combined.rows[0][0].as_deref(), Some("101"));
        let mut disabled = filter("id", "eq", "999");
        disabled.enabled = false;
        assert_eq!(
            page(&pool, "sqlite", &table, 0, &[disabled])
                .await
                .unwrap()
                .total,
            250
        );
        let malicious = page(
            &pool,
            "sqlite",
            &table,
            0,
            &[filter("label", "eq", "' OR 1=1 --")],
        )
        .await
        .unwrap();
        assert_eq!(malicious.total, 0);
    }
    #[tokio::test]
    async fn filters_handle_null_and_literal_like_characters() {
        let (pool, table) = fixture().await;
        sqlx::query("UPDATE \"order details\" SET value='100%_done!' WHERE id=1")
            .execute(&pool)
            .await
            .unwrap();
        let filter = |operator: &str, value: &str| crate::filters::TableFilter {
            column: "value".into(),
            operator: operator.into(),
            value: value.into(),
            enabled: true,
        };
        assert_eq!(
            page(&pool, "sqlite", &table, 0, &[filter("contains", "%_")])
                .await
                .unwrap()
                .total,
            1
        );
        assert_eq!(
            page(&pool, "sqlite", &table, 0, &[filter("is_null", "")])
                .await
                .unwrap()
                .total,
            1
        );
        assert_eq!(
            page(
                &pool,
                "sqlite",
                &table,
                0,
                &[filter("not_in", "'100%_done!'")]
            )
            .await
            .unwrap()
            .total,
            0
        );
        assert!(page(&pool, "sqlite", &table, 0, &[filter("in", "1,")])
            .await
            .is_err());
    }
    #[tokio::test]
    async fn sorting_uses_native_values_before_paging_with_stable_ties() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE items(id INTEGER PRIMARY KEY, bucket INTEGER)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<250) INSERT INTO items SELECT x, x % 2 FROM n").execute(&pool).await.unwrap();
        let table = Table {
            schema: String::new(),
            name: "items".into(),
        };
        let desc = TableSort {
            column: "id".into(),
            direction: SortDirection::Desc,
        };
        let first = page_sorted(&pool, "sqlite", &table, 0, &[], Some(&desc))
            .await
            .unwrap();
        assert_eq!(first.rows[0][0].as_deref(), Some("250"));
        assert_eq!(first.rows[99][0].as_deref(), Some("151"));
        let second = page_sorted(&pool, "sqlite", &table, 1, &[], Some(&desc))
            .await
            .unwrap();
        assert_eq!(second.rows[0][0].as_deref(), Some("150"));
        let asc = TableSort {
            column: "bucket".into(),
            direction: SortDirection::Asc,
        };
        let tied = page_sorted(&pool, "sqlite", &table, 1, &[], Some(&asc))
            .await
            .unwrap();
        assert_eq!(tied.rows[0][0].as_deref(), Some("202"));
        let filter = crate::filters::TableFilter {
            column: "id".into(),
            operator: "in".into(),
            value: "3, 200".into(),
            enabled: true,
        };
        let filtered = page_sorted(&pool, "sqlite", &table, 0, &[filter], Some(&desc))
            .await
            .unwrap();
        assert_eq!(filtered.total, 2);
        assert_eq!(filtered.rows[0][0].as_deref(), Some("200"));
        let invalid = TableSort {
            column: "id; DROP TABLE items".into(),
            direction: SortDirection::Asc,
        };
        assert!(page_sorted(&pool, "sqlite", &table, 0, &[], Some(&invalid))
            .await
            .is_err());
        assert!(serde_json::from_str::<TableSort>(
            r#"{"column":"id","direction":"desc; DROP TABLE items"}"#
        )
        .is_err());
    }
}

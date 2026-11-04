use crate::{
    editor::{qualified, quote},
    Table,
};
use futures_util::TryStreamExt;
use sqlx::{AnyConnection, AnyPool, Row};
use std::{
    fs::File,
    io::{BufWriter, Write},
};

pub async fn dump(
    pool: &AnyPool,
    tables: &[Table],
    include_data: bool,
    file: File,
) -> Result<(), String> {
    let mut connection = pool.begin().await.map_err(display)?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *connection)
        .await
        .map_err(display)?;
    for setting in [
        "SET LOCAL search_path = pg_catalog",
        "SET LOCAL standard_conforming_strings = on",
        "SET LOCAL DateStyle = 'ISO, YMD'",
        "SET LOCAL IntervalStyle = 'postgres'",
        "SET LOCAL bytea_output = 'hex'",
        "SET LOCAL extra_float_digits = 3",
        "SET LOCAL row_security = off",
    ] {
        sqlx::query(setting)
            .execute(&mut *connection)
            .await
            .map_err(display)?;
    }

    let version: String = sqlx::query_scalar("SHOW server_version_num")
        .fetch_one(&mut *connection)
        .await
        .map_err(display)?;
    let version: u32 = version.parse().map_err(display)?;
    let mut output = BufWriter::new(file);
    writeln!(output, "BEGIN;\nSET LOCAL search_path = pg_catalog;\nSET LOCAL standard_conforming_strings = on;\nSET LOCAL DateStyle = 'ISO, YMD';\nSET LOCAL IntervalStyle = 'postgres';").map_err(display)?;

    let mut indexes = Vec::new();
    let mut foreign_keys = Vec::new();

    for table in tables {
        let target = qualified("postgresql", table);
        let schema = quote("postgresql", &table.schema);
        let relation: String = sqlx::query_scalar(
            "SELECT CASE WHEN c.relkind = 'r' AND c.relpersistence <> 't'
                         AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid OR i.inhparent = c.oid)
                         THEN c.relpersistence::text ELSE '' END
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = $1 AND c.relname = $2",
        ).bind(&table.schema).bind(&table.name).fetch_one(&mut *connection).await.map_err(display)?;
        if relation.is_empty() {
            return Err(format!(
                "Built-in export supports ordinary PostgreSQL tables. {target} requires pg_dump."
            ));
        }

        let persistence = if relation == "u" { "UNLOGGED " } else { "" };
        writeln!(output, "CREATE SCHEMA IF NOT EXISTS {schema};").map_err(display)?;
        let columns = sqlx::query(
            "SELECT a.attname::text AS name, format_type(a.atttypid, a.atttypmod) AS kind,
                    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END AS required,
                    COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS expression,
                    COALESCE(row_to_json(a)->>'attgenerated', '') AS generated,
                    COALESCE(row_to_json(a)->>'attidentity', '') AS identity,
                    COALESCE(pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname::text), '') AS sequence,
                    CASE WHEN a.attcollation <> t.typcollation THEN format(' COLLATE %I.%I', cn.nspname, co.collname) ELSE '' END AS collation
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_type t ON t.oid = a.atttypid
             LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             LEFT JOIN pg_collation co ON co.oid = a.attcollation
             LEFT JOIN pg_namespace cn ON cn.oid = co.collnamespace
             WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
             ORDER BY a.attnum",
        ).bind(&table.schema).bind(&table.name).fetch_all(&mut *connection).await.map_err(display)?;

        let mut definitions = Vec::new();
        let mut writable = Vec::new();
        let mut sequences = Vec::new();
        let mut override_identity = false;

        for row in columns {
            let name: String = row.try_get("name").map_err(display)?;
            let column = quote("postgresql", &name);
            let kind: String = row.try_get("kind").map_err(display)?;
            let required: String = row.try_get("required").map_err(display)?;
            let expression: String = row.try_get("expression").map_err(display)?;
            let generated: String = row.try_get("generated").map_err(display)?;
            let identity: String = row.try_get("identity").map_err(display)?;
            let sequence: String = row.try_get("sequence").map_err(display)?;
            let collation: String = row.try_get("collation").map_err(display)?;
            let mut definition = format!("{column} {kind}{collation}");

            if !generated.is_empty() {
                let storage = if generated == "v" {
                    "VIRTUAL"
                } else {
                    "STORED"
                };
                definition.push_str(&format!(" GENERATED ALWAYS AS ({expression}) {storage}"));
            } else {
                writable.push(column.clone());
                if !identity.is_empty() {
                    let mode = if identity == "a" {
                        "ALWAYS"
                    } else {
                        "BY DEFAULT"
                    };
                    override_identity |= identity == "a";
                    let options = sequence_options(&mut connection, &sequence, version).await?;
                    definition.push_str(&format!(
                        " GENERATED {mode} AS IDENTITY (SEQUENCE NAME {sequence} {options})"
                    ));
                } else {
                    if !sequence.is_empty() {
                        let options = sequence_options(&mut connection, &sequence, version).await?;
                        writeln!(output, "CREATE SEQUENCE {sequence} {options};")
                            .map_err(display)?;
                    }
                    if !expression.is_empty() {
                        definition.push_str(&format!(" DEFAULT {expression}"));
                    }
                }
            }
            definition.push_str(&required);
            definitions.push(definition);

            if !sequence.is_empty() {
                sequences.push((column, sequence, identity.is_empty()));
            }
        }

        writeln!(
            output,
            "CREATE {persistence}TABLE {target} (\n    {}\n);",
            definitions.join(",\n    ")
        )
        .map_err(display)?;
        if include_data {
            write_rows(
                &mut connection,
                &mut output,
                &target,
                &writable,
                override_identity,
            )
            .await?;
        }

        for (column, sequence, owned) in sequences {
            if owned {
                writeln!(
                    output,
                    "ALTER SEQUENCE {sequence} OWNED BY {target}.{column};"
                )
                .map_err(display)?;
            }
            if include_data {
                let query = format!("SELECT format('SELECT pg_catalog.setval(%L, %s, %L);', $1::text, last_value, is_called) FROM {sequence}");
                let reset: String = sqlx::query_scalar(&query)
                    .bind(&sequence)
                    .fetch_one(&mut *connection)
                    .await
                    .map_err(display)?;
                writeln!(output, "{reset}").map_err(display)?;
            }
        }

        let constraints = sqlx::query(
            "SELECT con.conname::text AS name, con.contype::text AS kind, pg_get_constraintdef(con.oid) AS definition
             FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = $1 AND c.relname = $2 AND con.contype IN ('c', 'f', 'p', 'u', 'x') ORDER BY con.conname",
        ).bind(&table.schema).bind(&table.name).fetch_all(&mut *connection).await.map_err(display)?;
        for row in constraints {
            let name: String = row.try_get("name").map_err(display)?;
            let kind: String = row.try_get("kind").map_err(display)?;
            let definition: String = row.try_get("definition").map_err(display)?;
            let sql = format!(
                "ALTER TABLE {target} ADD CONSTRAINT {} {definition};",
                quote("postgresql", &name)
            );
            if kind == "f" {
                foreign_keys.push(sql);
            } else {
                writeln!(output, "{sql}").map_err(display)?;
            }
        }

        let definitions: Vec<String> = sqlx::query_scalar(
            "SELECT pg_get_indexdef(i.indexrelid)
             FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = $1 AND c.relname = $2 AND i.indisvalid
             AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid AND con.contype IN ('p', 'u', 'x'))
             ORDER BY i.indexrelid",
        ).bind(&table.schema).bind(&table.name).fetch_all(&mut *connection).await.map_err(display)?;
        indexes.extend(
            definitions
                .into_iter()
                .map(|definition| format!("{definition};")),
        );
    }

    for statement in indexes.into_iter().chain(foreign_keys) {
        writeln!(output, "{statement}").map_err(display)?;
    }

    writeln!(output, "COMMIT;").map_err(display)?;
    output.flush().map_err(display)?;
    connection.commit().await.map_err(display)
}

async fn sequence_options(
    connection: &mut AnyConnection,
    sequence: &str,
    version: u32,
) -> Result<String, String> {
    if version >= 100000 {
        return sqlx::query_scalar(
            "SELECT format('INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s',
                           seqincrement, seqmin, seqmax, seqstart, seqcache,
                           CASE WHEN seqcycle THEN 'CYCLE' ELSE 'NO CYCLE' END)
             FROM pg_sequence WHERE seqrelid = $1::text::regclass",
        )
        .bind(sequence)
        .fetch_one(connection)
        .await
        .map_err(display);
    }

    let query = format!("SELECT format('INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s', increment_by, min_value, max_value, start_value, cache_value, CASE WHEN is_cycled THEN 'CYCLE' ELSE 'NO CYCLE' END) FROM {sequence}");
    sqlx::query_scalar(&query)
        .fetch_one(connection)
        .await
        .map_err(display)
}

async fn write_rows(
    connection: &mut AnyConnection,
    output: &mut BufWriter<File>,
    target: &str,
    columns: &[String],
    override_identity: bool,
) -> Result<(), String> {
    let (query, prefix) = if columns.is_empty() {
        (
            format!("SELECT ''::text FROM {target}"),
            format!("INSERT INTO {target} DEFAULT VALUES"),
        )
    } else {
        let values = columns
            .iter()
            .map(|column| format!("quote_nullable({column}::text)"))
            .collect::<Vec<_>>()
            .join(" || ', ' || ");
        let mode = if override_identity {
            " OVERRIDING SYSTEM VALUE"
        } else {
            ""
        };
        (
            format!("SELECT {values} FROM {target}"),
            format!(
                "INSERT INTO {target} ({}){mode} VALUES (",
                columns.join(", ")
            ),
        )
    };
    let mut rows = sqlx::query(&query).fetch(connection);
    while let Some(row) = rows.try_next().await.map_err(display)? {
        if columns.is_empty() {
            writeln!(output, "{prefix};").map_err(display)?;
        } else {
            let values: String = row.try_get(0).map_err(display)?;
            writeln!(output, "{prefix}{values});").map_err(display)?;
        }
    }
    Ok(())
}

fn display(error: impl std::fmt::Display) -> String {
    error.to_string()
}

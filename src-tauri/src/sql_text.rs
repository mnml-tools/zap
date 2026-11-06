use sqlx::{
    any::{AnyRow, AnyTypeInfoKind},
    ColumnIndex, Row, ValueRef,
};

// MySQL TEXT (including catalog expressions cast to CHAR) can retain a BLOB
// protocol type in SQLx Any. Only use this for fields known to contain text.
pub fn optional<I>(row: &AnyRow, index: I) -> Result<Option<String>, sqlx::Error>
where
    I: ColumnIndex<AnyRow> + Clone,
{
    let raw = row.try_get_raw(index.clone())?;
    if raw.type_info().kind() == AnyTypeInfoKind::Blob {
        let bytes: Option<Vec<u8>> = row.try_get(index)?;
        bytes
            .map(String::from_utf8)
            .transpose()
            .map_err(|error| sqlx::Error::ColumnDecode {
                index: "text metadata".into(),
                source: Box::new(error),
            })
    } else {
        row.try_get(index)
    }
}

pub fn required<I>(row: &AnyRow, index: I) -> Result<String, sqlx::Error>
where
    I: ColumnIndex<AnyRow> + Clone,
{
    optional(row, index)?.ok_or(sqlx::Error::Decode(Box::new(
        sqlx::error::UnexpectedNullError,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn decodes_text_and_blob_metadata_without_losing_nulls_or_invalid_bytes() {
        sqlx::any::install_default_drivers();
        let pool = sqlx::AnyPool::connect("sqlite::memory:").await.unwrap();
        let row = sqlx::query("SELECT 'varchar' AS text_kind, CAST('varchar' AS BLOB) AS kind, CAST('café' AS BLOB) AS unicode, NULL AS missing, x'FF' AS invalid, 42 AS number")
            .fetch_one(&pool).await.unwrap();
        assert!(row.try_get::<String, _>("kind").is_err());
        assert_eq!(required(&row, "kind").unwrap(), "varchar");
        assert_eq!(required(&row, "text_kind").unwrap(), "varchar");
        assert_eq!(required(&row, "unicode").unwrap(), "café");
        assert_eq!(optional(&row, "missing").unwrap(), None);
        assert!(required(&row, "missing").is_err());
        assert!(required(&row, "invalid").is_err());
        assert!(required(&row, "number").is_err());
    }
}

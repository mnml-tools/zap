use serde::Deserialize;
#[derive(Deserialize, Clone)]
pub struct TableFilter {
    pub column: String,
    pub operator: String,
    #[serde(default)]
    pub value: String,
    #[serde(default = "enabled")]
    pub enabled: bool,
}
fn enabled() -> bool {
    true
}
fn quote(driver: &str, column: &str) -> String {
    if driver == "mysql" {
        format!("`{}`", column.replace('`', "``"))
    } else {
        format!("\"{}\"", column.replace('"', "\"\""))
    }
}
// CSV-style lists support quoted commas and doubled quotes. Values are always bound.
pub fn list(value: &str) -> Result<Vec<String>, String> {
    let mut items = vec![];
    let mut chars = value.chars().peekable();
    loop {
        while chars.peek().is_some_and(|c| c.is_whitespace()) {
            chars.next();
        }
        if chars.peek().is_none() {
            if items.is_empty() {
                return Err("IN needs at least one value.".into());
            } else {
                return Err("Remove the trailing comma in the IN list.".into());
            }
        }
        let quoted = chars.peek().copied().filter(|c| *c == '\'' || *c == '"');
        let mut item = String::new();
        if let Some(quote) = quoted {
            chars.next();
            let mut closed = false;
            while let Some(c) = chars.next() {
                if c == quote {
                    if chars.peek() == Some(&quote) {
                        chars.next();
                        item.push(quote)
                    } else {
                        closed = true;
                        break;
                    }
                } else {
                    item.push(c)
                }
            }
            if !closed {
                return Err("Close the quoted value in the IN list.".into());
            }
            while chars.peek().is_some_and(|c| c.is_whitespace()) {
                chars.next();
            }
            if chars.peek().is_some_and(|c| *c != ',') {
                return Err("Separate IN values with commas.".into());
            }
        } else {
            while chars.peek().is_some_and(|c| *c != ',') {
                item.push(chars.next().unwrap())
            }
            item = item.trim().to_owned();
            if item.is_empty() {
                return Err("Empty IN values must be quoted as ''.".into());
            }
        }
        items.push(item);
        if items.len() > 200 {
            return Err("Use at most 200 values per IN filter.".into());
        }
        if chars.next().is_none() {
            break;
        }
    }
    Ok(items)
}
pub fn build(
    driver: &str,
    columns: &[(String, String)],
    filters: &[TableFilter],
) -> Result<(String, Vec<String>), String> {
    if filters.len() > 50 {
        return Err("Use at most 50 filter conditions.".into());
    }
    let mut predicates = vec![];
    let mut values = vec![];
    for filter in filters.iter().filter(|f| f.enabled) {
        let (_, kind) = columns
            .iter()
            .find(|(name, _)| name == &filter.column)
            .ok_or("Filter column no longer exists.")?;
        let field = format!("zap_row.{}", quote(driver, &filter.column));
        let mut bind = |value: String, typed: bool| {
            values.push(value);
            if driver == "postgresql" {
                if typed {
                    format!("CAST(CAST(${} AS TEXT) AS {kind})", values.len())
                } else {
                    format!("CAST(${} AS TEXT)", values.len())
                }
            } else {
                "?".into()
            }
        };
        let predicate = match filter.operator.as_str() {
            "is_null" => format!("{field} IS NULL"),
            "is_not_null" => format!("{field} IS NOT NULL"),
            "eq" | "ne" | "gt" | "gte" | "lt" | "lte" => {
                let operator = match filter.operator.as_str() {
                    "eq" => "=",
                    "ne" => "<>",
                    "gt" => ">",
                    "gte" => ">=",
                    "lt" => "<",
                    _ => "<=",
                };
                format!("{field} {operator} {}", bind(filter.value.clone(), true))
            }
            "contains" | "not_contains" | "starts_with" | "ends_with" => {
                let escaped = filter
                    .value
                    .replace('!', "!!")
                    .replace('%', "!%")
                    .replace('_', "!_");
                let pattern = match filter.operator.as_str() {
                    "starts_with" => format!("{escaped}%"),
                    "ends_with" => format!("%{escaped}"),
                    _ => format!("%{escaped}%"),
                };
                let operator = if filter.operator == "not_contains" {
                    "NOT LIKE"
                } else {
                    "LIKE"
                };
                let cast = if driver == "mysql" { "CHAR" } else { "TEXT" };
                format!(
                    "CAST({field} AS {cast}) {operator} {} ESCAPE '!'",
                    bind(pattern, false)
                )
            }
            "in" | "not_in" => {
                let items = list(&filter.value)?;
                let parameters = items
                    .into_iter()
                    .map(|v| bind(v, true))
                    .collect::<Vec<_>>()
                    .join(",");
                format!(
                    "{field} {} ({parameters})",
                    if filter.operator == "in" {
                        "IN"
                    } else {
                        "NOT IN"
                    }
                )
            }
            _ => return Err("Unsupported filter operator.".into()),
        };
        predicates.push(predicate);
    }
    Ok((
        if predicates.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", predicates.join(" AND "))
        },
        values,
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quoted_lists_and_invalid_inputs() {
        assert_eq!(
            list("1, 'a,b', \"O\"\"Brien\", ''").unwrap(),
            vec!["1", "a,b", "O\"Brien", ""]
        );
        for input in ["", ",", "1,", "'unfinished", "'a' garbage"] {
            assert!(list(input).is_err(), "{input}");
        }
    }
    #[test]
    fn parameters_are_bound_and_identifiers_are_validated() {
        let columns = vec![("key\"id".into(), "integer".into())];
        let filters = vec![TableFilter {
            column: "key\"id".into(),
            operator: "in".into(),
            value: "1, 2".into(),
            enabled: true,
        }];
        let (sql, values) = build("postgresql", &columns, &filters).unwrap();
        assert!(sql.contains("\"key\"\"id\""));
        assert!(sql.contains("CAST(CAST($1 AS TEXT) AS integer)"));
        assert_eq!(values, vec!["1", "2"]);
        assert!(build(
            "sqlite",
            &columns,
            &[TableFilter {
                column: "not_a_column".into(),
                ..filters[0].clone()
            }]
        )
        .is_err());
    }
}

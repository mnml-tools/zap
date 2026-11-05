use crate::{credential, read, saved_password, write_connections, Connection, Store};
use serde::Deserialize;
use std::{collections::HashSet, io::Write, path::Path};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Deserialize)]
struct ConnectionFile {
    version: u32,
    connections: Vec<Connection>,
}

fn decode(bytes: &[u8]) -> Result<Vec<Connection>, String> {
    let file: ConnectionFile = serde_json::from_slice(bytes)
        .map_err(|_| "Choose a valid Zap connections JSON file.".to_string())?;
    if file.version != 1 {
        return Err("This connections file version is not supported.".into());
    }
    for connection in &file.connections {
        if connection.title.trim().is_empty()
            || connection.database.trim().is_empty()
            || !matches!(
                connection.driver.as_str(),
                "postgresql" | "mysql" | "sqlite"
            )
            || !matches!(connection.authentication.as_str(), "password" | "none")
            || (connection.driver != "sqlite"
                && (connection.host.trim().is_empty() || connection.port == 0))
        {
            return Err(
                "The file contains an invalid connection. No connections were imported.".into(),
            );
        }
    }
    Ok(file.connections)
}

fn encode(connections: Vec<Connection>) -> Result<Vec<u8>, String> {
    let entries = connections
        .into_iter()
        .map(|connection| {
            let mut value = serde_json::to_value(&connection).map_err(|e| e.to_string())?;
            value["password"] = serde_json::Value::String(connection.password);
            Ok(value)
        })
        .collect::<Result<Vec<_>, String>>()?;
    serde_json::to_vec_pretty(&serde_json::json!({ "version": 1, "connections": entries }))
        .map_err(|e| e.to_string())
}

fn assign_ids(existing: &[Connection], imported: &mut [Connection]) {
    let mut ids: HashSet<String> = existing
        .iter()
        .map(|connection| connection.id.clone())
        .collect();
    for connection in imported {
        let base = if connection.id.is_empty() {
            "imported".to_string()
        } else {
            connection.id.clone()
        };
        let mut id = base.clone();
        let mut suffix = 1;
        while !ids.insert(id.clone()) {
            id = format!("{base}-import-{suffix}");
            suffix += 1;
        }
        connection.id = id;
    }
}

fn write_export(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let filename = path
        .file_name()
        .ok_or("Choose a file name.")?
        .to_string_lossy();
    let temporary = path.with_file_name(format!(".{filename}.zap-export.tmp"));
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
    let result = (|| {
        file.write_all(bytes)?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(temporary);
    }
    result.map_err(|e: std::io::Error| e.to_string())
}

#[tauri::command]
pub async fn export_connections(
    window: tauri::Window,
    state: State<'_, Store>,
) -> Result<bool, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Export connections with passwords")
        .set_file_name("zap-connections.json")
        .add_filter("Zap connections", &["json"])
        .save_file(move |path| {
            let _ = send.send(path);
        });
    let Some(path) = receive.await.map_err(|e| e.to_string())? else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    let mut connections = read(window.app_handle())?;
    for connection in &mut connections {
        if connection.driver != "sqlite" && connection.authentication == "password" {
            connection.password = saved_password(&state, &connection.id)?;
        }
    }
    write_export(&path, &encode(connections)?)?;
    Ok(true)
}

#[tauri::command]
pub async fn import_connections(
    window: tauri::Window,
    state: State<'_, Store>,
) -> Result<Option<usize>, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Import connections")
        .add_filter("Zap connections", &["json"])
        .pick_file(move |path| {
            let _ = send.send(path);
        });
    let Some(path) = receive.await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let mut imported = decode(&std::fs::read(path).map_err(|e| e.to_string())?)?;
    let count = imported.len();
    let _guard = state.files.lock().map_err(|e| e.to_string())?;
    let mut all = read(window.app_handle())?;
    assign_ids(&all, &mut imported);
    let mut written = Vec::new();
    let result = (|| {
        for connection in &imported {
            if !connection.password.is_empty() {
                state
                    .credentials
                    .write(&connection.id, &connection.password, || {
                        credential(&connection.id)?
                            .set_password(&connection.password)
                            .map_err(|e| e.to_string())
                    })?;
                written.push(connection.id.clone());
            }
        }
        all.extend(imported);
        write_connections(window.app_handle(), &all)
    })();
    if result.is_err() {
        let mut cleanup_failed = false;
        for id in written {
            if state
                .credentials
                .remove(&id, || {
                    credential(&id)?
                        .delete_credential()
                        .map_err(|e| e.to_string())
                })
                .is_err()
            {
                cleanup_failed = true;
            }
        }
        let detail = if cleanup_failed {
            " Some unused passwords could not be removed from the credential store."
        } else {
            ""
        };
        return Err(format!(
            "No connections were imported. {}{detail}",
            result.unwrap_err()
        ));
    }
    Ok(Some(count))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection() -> Connection {
        serde_json::from_value(serde_json::json!({
            "id": "example",
            "title": "Example",
            "driver": "postgresql",
            "host": "localhost",
            "port": 5432,
            "authentication": "password",
            "user": "postgres",
            "password": "test-only-secret",
            "database": "example",
            "environment": "prod",
            "ssh": { "host": "jump.example", "port": 22, "user": "test", "keyPath": "/example/key" }
        }))
        .unwrap()
    }

    #[test]
    fn backup_preserves_secrets_and_settings_without_changing_regular_storage() {
        let encoded = encode(vec![connection()]).unwrap();
        let imported = decode(&encoded).unwrap();
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].password, "test-only-secret");
        assert_eq!(imported[0].ssh.as_ref().unwrap().key_path, "/example/key");
        let metadata = serde_json::to_value(&imported[0]).unwrap();
        assert_eq!(metadata["environment"], "prod");
        assert!(metadata.get("password").is_none());
    }

    #[test]
    fn validates_entire_backup_and_version_before_import() {
        let mut value: serde_json::Value =
            serde_json::from_slice(&encode(vec![connection()]).unwrap()).unwrap();
        value["version"] = 2.into();
        assert!(decode(&serde_json::to_vec(&value).unwrap()).is_err());
        value["version"] = 1.into();
        let mut invalid = value["connections"][0].clone();
        invalid["driver"] = "unsupported".into();
        value["connections"].as_array_mut().unwrap().push(invalid);
        assert!(decode(&serde_json::to_vec(&value).unwrap()).is_err());
        assert!(decode(b"not json").is_err());
    }

    #[test]
    fn repeated_imports_do_not_overwrite_existing_connections_or_each_other() {
        let existing = vec![connection()];
        let mut imported = vec![connection(), connection()];
        assign_ids(&existing, &mut imported);
        assert_eq!(existing[0].id, "example");
        assert_eq!(imported[0].id, "example-import-1");
        assert_eq!(imported[1].id, "example-import-2");
        let all = [existing, imported].concat();
        let mut next = vec![connection()];
        assign_ids(&all, &mut next);
        assert_eq!(next[0].id, "example-import-3");
    }

    #[test]
    fn export_writes_complete_backup_with_private_unix_permissions() {
        let path = std::env::temp_dir().join(format!(
            "zap-connection-export-{}-{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let bytes = encode(vec![connection()]).unwrap();
        write_export(&path, &bytes).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        std::fs::remove_file(path).unwrap();
    }
}

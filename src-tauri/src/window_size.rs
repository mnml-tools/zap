use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{LogicalSize, Manager, WebviewWindow, WindowEvent};

#[derive(Clone, Copy, Serialize, Deserialize)]
struct WindowSize {
    width: f64,
    height: f64,
}

pub fn restore_and_track(window: WebviewWindow) {
    let Ok(directory) = window.app_handle().path().app_data_dir() else {
        return;
    };
    let path = directory.join("window-size.json");
    let restored = std::fs::read(&path)
        .ok()
        .and_then(|data| serde_json::from_slice::<WindowSize>(&data).ok())
        .filter(|size| {
            size.width.is_finite()
                && size.height.is_finite()
                && size.width > 0.0
                && size.height > 0.0
        });

    if let Some(size) = restored {
        let _ = window.set_size(LogicalSize::new(size.width, size.height));
    }

    let pending = Arc::new(Mutex::new((0_u64, restored)));
    let observed = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(size)
            if size.width > 0
                && size.height > 0
                && matches!(observed.is_maximized(), Ok(false))
                && matches!(observed.is_fullscreen(), Ok(false)) =>
        {
            let Ok(scale) = observed.scale_factor() else {
                return;
            };
            let logical = size.to_logical::<f64>(scale);
            let Ok(mut state) = pending.lock() else {
                return;
            };
            state.0 += 1;
            state.1 = Some(WindowSize {
                width: logical.width,
                height: logical.height,
            });
            let revision = state.0;
            let pending = Arc::clone(&pending);
            let path = path.clone();

            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(350)).await;
                if let Ok(state) = pending.lock() {
                    if state.0 == revision {
                        save(&path, state.1);
                    }
                }
            });
        }
        WindowEvent::CloseRequested { .. } => {
            if let Ok(state) = pending.lock() {
                save(&path, state.1);
            }
        }
        _ => {}
    });
}

fn save(path: &Path, size: Option<WindowSize>) {
    let Some(parent) = path.parent() else { return };
    let Some(size) = size else { return };
    let Ok(data) = serde_json::to_vec(&size) else {
        return;
    };
    let temporary = path.with_extension("tmp");
    if std::fs::create_dir_all(parent).is_ok() && std::fs::write(&temporary, data).is_ok() {
        let _ = std::fs::rename(temporary, path);
    }
}

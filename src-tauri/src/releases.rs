const LATEST_RELEASE_URL: &str = "https://github.com/mnml-tools/zap/releases/latest";

#[tauri::command]
pub async fn open_latest_release() -> Result<(), String> {
    open_page(LATEST_RELEASE_URL).await
}

#[tauri::command]
pub async fn open_project_page(page: String) -> Result<(), String> {
    let url = match page.as_str() {
        "project" => "https://github.com/mnml-tools/zap",
        "issues" => "https://github.com/mnml-tools/zap/issues",
        _ => return Err("Unknown project page.".to_owned()),
    };
    open_page(url).await
}

async fn open_page(url: &'static str) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let status = std::process::Command::new("open").arg(url).status();

        #[cfg(target_os = "windows")]
        let status = {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("cmd")
                .args(["/C", "start", "", url])
                .creation_flags(0x08000000)
                .status()
        };

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let status = std::process::Command::new("xdg-open").arg(url).status();

        match status {
            Ok(status) if status.success() => Ok(()),
            _ => Err("Unable to open the release page in your browser.".to_owned()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

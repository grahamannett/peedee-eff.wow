use crate::sidecar::SharedSidecar;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct ConvertResult {
    pub id: String,
}

#[tauri::command]
pub async fn start_conversion(
    sidecar: State<'_, SharedSidecar>,
    pdf_path: String,
    output_dir: String,
    options: serde_json::Value,
) -> Result<ConvertResult, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let guard = sidecar.lock().await;
    let manager = guard.as_ref().ok_or("Sidecar not running")?;
    manager
        .send_convert(&id, &pdf_path, options, &output_dir)
        .await?;
    Ok(ConvertResult { id })
}

#[tauri::command]
pub async fn is_sidecar_ready(
    sidecar: State<'_, SharedSidecar>,
) -> Result<bool, String> {
    let guard = sidecar.lock().await;
    Ok(guard.is_some())
}

#[tauri::command]
pub async fn check_model_status(
    sidecar: State<'_, SharedSidecar>,
    engine: String,
) -> Result<(), String> {
    let guard = sidecar.lock().await;
    let manager = guard.as_ref().ok_or("Sidecar not running")?;
    let cmd = serde_json::json!({
        "type": "model_status",
        "engine": engine,
    });
    manager.send_raw(&cmd.to_string()).await
}

#[tauri::command]
pub async fn download_models(
    sidecar: State<'_, SharedSidecar>,
    engine: String,
) -> Result<(), String> {
    let guard = sidecar.lock().await;
    let manager = guard.as_ref().ok_or("Sidecar not running")?;
    let cmd = serde_json::json!({
        "type": "download_models",
        "engine": engine,
    });
    manager.send_raw(&cmd.to_string()).await
}

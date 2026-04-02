mod commands;
mod sidecar;

use sidecar::{SharedSidecar, SidecarManager};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::{mpsc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle().plugin(tauri_plugin_fs::init())?;
            app.handle().plugin(tauri_plugin_shell::init())?;
            app.handle().plugin(tauri_plugin_store::Builder::default().build())?;

            let shared_sidecar: SharedSidecar = Arc::new(Mutex::new(None));
            app.manage(shared_sidecar.clone());

            let app_handle = app.handle().clone();

            // Spawn sidecar in background
            tauri::async_runtime::spawn(async move {
                let (event_tx, mut event_rx) = mpsc::channel(128);

                let manifest_dir = env!("CARGO_MANIFEST_DIR");
                let sidecar_dir = std::path::Path::new(manifest_dir)
                    .parent()
                    .unwrap()
                    .join("sidecar");

                // Check for bundled binary first (production), fall back to Python (dev)
                let bundled_binary = sidecar_dir
                    .parent()
                    .unwrap()
                    .join("src-tauri/binaries/peedee-eff-sidecar-aarch64-apple-darwin");

                let spawn_result = if !cfg!(debug_assertions) && bundled_binary.exists() {
                    log::info!("Spawning bundled sidecar binary: {}", bundled_binary.display());
                    SidecarManager::spawn_binary(
                        bundled_binary.to_str().unwrap(),
                        event_tx,
                    )
                    .await
                } else {
                    let script_path = sidecar_dir.join("main.py");
                    let venv_python = sidecar_dir.join(".venv/bin/python3");
                    let python_path = if venv_python.exists() {
                        venv_python.to_string_lossy().to_string()
                    } else {
                        "python3".to_string()
                    };
                    log::info!("Spawning sidecar: {} {} (cwd: {})", python_path, script_path.display(), sidecar_dir.display());
                    SidecarManager::spawn(
                        &python_path,
                        script_path.to_str().unwrap(),
                        sidecar_dir.to_str().unwrap(),
                        event_tx,
                    )
                    .await
                };

                match spawn_result
                {
                    Ok(manager) => {
                        log::info!("Sidecar spawned successfully");
                        *shared_sidecar.lock().await = Some(manager);
                    }
                    Err(e) => {
                        log::error!("Failed to spawn sidecar: {}", e);
                        return;
                    }
                }

                // Forward sidecar events to the frontend
                while let Some(msg) = event_rx.recv().await {
                    log::info!("Sidecar event: {:?}", msg);
                    if let Err(e) = app_handle.emit("sidecar-event", &msg) {
                        log::error!("Failed to emit event to frontend: {}", e);
                    }
                }

                log::info!("Sidecar event loop ended");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_conversion,
            commands::is_sidecar_ready,
            commands::check_model_status,
            commands::download_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

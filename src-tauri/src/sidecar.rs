use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum SidecarMessage {
    Ready,
    Progress {
        id: String,
        percent: f64,
        message: String,
    },
    Complete {
        id: String,
        outputs: serde_json::Value,
    },
    Error {
        id: Option<String>,
        message: String,
    },
    ModelStatus {
        engine: String,
        downloaded: bool,
        size_bytes: u64,
    },
    DownloadProgress {
        engine: String,
        percent: f64,
        message: String,
    },
    DownloadComplete {
        engine: String,
    },
}

pub struct SidecarManager {
    stdin_tx: mpsc::Sender<String>,
    _child: Child,
}

impl SidecarManager {
    pub async fn spawn_binary(
        binary_path: &str,
        event_tx: mpsc::Sender<SidecarMessage>,
    ) -> Result<Self, String> {
        let mut child = Command::new(binary_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar binary: {}", e))?;
        Self::setup(child, event_tx).await
    }

    pub async fn spawn(
        python_path: &str,
        sidecar_script: &str,
        working_dir: &str,
        event_tx: mpsc::Sender<SidecarMessage>,
    ) -> Result<Self, String> {
        let mut child = Command::new(python_path)
            .arg(sidecar_script)
            .current_dir(working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;
        Self::setup(child, event_tx).await
    }

    async fn setup(
        mut child: Child,
        event_tx: mpsc::Sender<SidecarMessage>,
    ) -> Result<Self, String> {
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;

        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(32);

        // Task to write to stdin
        tokio::spawn(async move {
            let mut stdin = stdin;
            while let Some(line) = stdin_rx.recv().await {
                if let Err(e) = stdin.write_all(line.as_bytes()).await {
                    log::error!("Failed to write to sidecar stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    log::error!("Failed to flush sidecar stdin: {}", e);
                    break;
                }
            }
        });

        // Task to read stdout
        let event_tx_clone = event_tx.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                match serde_json::from_str::<SidecarMessage>(&line) {
                    Ok(msg) => {
                        if let Err(e) = event_tx_clone.send(msg).await {
                            log::error!("Failed to forward sidecar message: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to parse sidecar message: {} - line: {}", e, line);
                    }
                }
            }
            log::info!("Sidecar stdout reader ended");
        });

        // Task to read stderr (just log it)
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::warn!("Sidecar stderr: {}", line);
            }
        });

        Ok(Self {
            stdin_tx,
            _child: child,
        })
    }

    pub async fn send_raw(&self, json_line: &str) -> Result<(), String> {
        let mut line = json_line.to_string();
        if !line.ends_with('\n') {
            line.push('\n');
        }
        self.stdin_tx
            .send(line)
            .await
            .map_err(|e| format!("Failed to send to sidecar: {}", e))
    }

    pub async fn send_convert(
        &self,
        id: &str,
        pdf_path: &str,
        options: serde_json::Value,
        output_dir: &str,
    ) -> Result<(), String> {
        let cmd = serde_json::json!({
            "type": "convert",
            "id": id,
            "pdf_path": pdf_path,
            "options": options,
            "output_dir": output_dir,
        });
        self.send_raw(&cmd.to_string()).await
    }
}

pub type SharedSidecar = Arc<Mutex<Option<SidecarManager>>>;

use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[tokio::test]
async fn test_sidecar_round_trip() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let sidecar_dir = std::path::Path::new(manifest_dir)
        .parent()
        .unwrap()
        .join("sidecar");
    let script_path = sidecar_dir.join("main.py");

    let venv_python = sidecar_dir.join(".venv/bin/python3");
    let python = if venv_python.exists() {
        venv_python.to_string_lossy().to_string()
    } else {
        "python3".to_string()
    };

    let mut child = Command::new(&python)
        .arg(&script_path)
        .current_dir(&sidecar_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to spawn sidecar");

    let mut stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let mut reader = BufReader::new(stdout).lines();

    // Read the "ready" message
    let ready_line = reader.next_line().await.unwrap().unwrap();
    let ready: serde_json::Value = serde_json::from_str(&ready_line).unwrap();
    assert_eq!(ready["type"], "ready");

    // Send a convert command
    let cmd = serde_json::json!({
        "type": "convert",
        "id": "rust-test-1",
        "pdf_path": "/tmp/test.pdf",
        "options": {"force_ocr": true, "engine": "mock"},
        "output_dir": "/tmp/peedee-eff-rust-test"
    });
    stdin
        .write_all(format!("{}\n", cmd).as_bytes())
        .await
        .unwrap();
    stdin.flush().await.unwrap();

    // Close stdin to signal EOF
    drop(stdin);

    // Collect all messages
    let mut messages = vec![];
    while let Ok(Some(line)) = reader.next_line().await {
        let msg: serde_json::Value = serde_json::from_str(&line).unwrap();
        messages.push(msg);
    }

    // Check we got progress messages
    let progress_msgs: Vec<_> = messages
        .iter()
        .filter(|m| m["type"] == "progress")
        .collect();
    assert!(!progress_msgs.is_empty(), "Expected progress messages");

    for pm in &progress_msgs {
        assert_eq!(pm["id"], "rust-test-1");
    }

    // Check we got a complete message
    let complete_msgs: Vec<_> = messages
        .iter()
        .filter(|m| m["type"] == "complete")
        .collect();
    assert_eq!(complete_msgs.len(), 1, "Expected exactly one complete message");
    assert_eq!(complete_msgs[0]["id"], "rust-test-1");
    assert!(complete_msgs[0]["outputs"]["markdown"].is_string());
}

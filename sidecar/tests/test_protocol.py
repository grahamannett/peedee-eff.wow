import json
import subprocess
import sys


def run_sidecar(input_lines: list[str]) -> list[dict]:
    proc = subprocess.run(
        [sys.executable, "main.py"],
        input="\n".join(input_lines) + "\n",
        capture_output=True,
        text=True,
        timeout=30,
        cwd=".",
    )
    messages = []
    for line in proc.stdout.strip().split("\n"):
        if line:
            messages.append(json.loads(line))
    return messages


def test_ready_message():
    msgs = run_sidecar([])
    assert len(msgs) >= 1
    assert msgs[0]["type"] == "ready"


def test_invalid_json():
    msgs = run_sidecar(["not json"])
    assert msgs[0]["type"] == "ready"
    assert msgs[1]["type"] == "error"
    assert "Invalid JSON" in msgs[1]["message"]


def test_missing_type():
    msgs = run_sidecar(['{"foo": "bar"}'])
    assert msgs[1]["type"] == "error"
    assert "Missing 'type'" in msgs[1]["message"]


def test_unknown_type():
    msgs = run_sidecar(['{"type": "unknown_cmd"}'])
    assert msgs[1]["type"] == "error"
    assert "Unknown message type" in msgs[1]["message"]


def test_mock_conversion():
    cmd = json.dumps(
        {
            "type": "convert",
            "id": "test-1",
            "pdf_path": "/tmp/test.pdf",
            "options": {"force_ocr": True},
            "output_dir": "/tmp/peedee-eff-test-out",
        }
    )
    msgs = run_sidecar([cmd])

    assert msgs[0]["type"] == "ready"

    progress_msgs = [m for m in msgs if m["type"] == "progress"]
    assert len(progress_msgs) > 0
    for pm in progress_msgs:
        assert pm["id"] == "test-1"
        assert "percent" in pm

    complete_msgs = [m for m in msgs if m["type"] == "complete"]
    assert len(complete_msgs) == 1
    assert complete_msgs[0]["id"] == "test-1"
    assert "markdown" in complete_msgs[0]["outputs"]


def test_model_status():
    cmd = json.dumps({"type": "model_status", "engine": "mock"})
    msgs = run_sidecar([cmd])

    status_msgs = [m for m in msgs if m["type"] == "model_status"]
    assert len(status_msgs) == 1
    assert status_msgs[0]["downloaded"] is True

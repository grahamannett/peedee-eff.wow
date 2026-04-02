import json
import sys


def send_message(msg: dict) -> None:
    line = json.dumps(msg)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def make_progress_callback(job_id: str):
    def callback(percent: float, message: str) -> None:
        send_message(
            {
                "type": "progress",
                "id": job_id,
                "percent": round(percent, 1),
                "message": message,
            }
        )

    return callback

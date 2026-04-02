import json
import os
import sys

from engines.base import ConversionOptions
from engines.mock_engine import MockEngine
from engines.marker_engine import MarkerEngine
from builders.epub_builder import build_epub
from utils.progress import make_progress_callback, send_message

ENGINES = {
    "mock": MockEngine,
    "marker": MarkerEngine,
}


def get_engine(name: str = "mock"):
    cls = ENGINES.get(name)
    if cls is None:
        raise ValueError(f"Unknown engine: {name}")
    return cls()


def handle_convert(msg: dict) -> None:
    job_id = msg["id"]
    pdf_path = msg["pdf_path"]
    output_dir = msg["output_dir"]
    options_raw = msg.get("options", {})

    options = ConversionOptions(
        force_ocr=options_raw.get("force_ocr", True),
        page_range=options_raw.get("page_range"),
        language=options_raw.get("language", "English"),
        extract_images=options_raw.get("extract_images", True),
        output_formats=options_raw.get("output_formats", ["epub", "markdown"]),
    )

    engine_name = options_raw.get("engine", "mock")
    engine = get_engine(engine_name)
    progress_cb = make_progress_callback(job_id)

    try:
        result = engine.convert(pdf_path, options, progress_cb)
    except Exception as e:
        send_message({"type": "error", "id": job_id, "message": str(e)})
        return

    os.makedirs(output_dir, exist_ok=True)

    md_path = os.path.join(output_dir, "result.md")
    with open(md_path, "w") as f:
        f.write(result.markdown)

    # Save extracted images
    images_dir = os.path.join(output_dir, "images")
    saved_images = []
    for img in result.images:
        img_data = img.get("data")
        if img_data is not None:
            os.makedirs(images_dir, exist_ok=True)
            img_path = os.path.join(images_dir, img["path"])
            os.makedirs(os.path.dirname(img_path), exist_ok=True)
            # img_data may be a PIL Image
            if hasattr(img_data, "save"):
                img_data.save(img_path)
            saved_images.append(img_path)
        else:
            saved_images.append(img["path"])

    # Build EPUB if requested
    epub_path = None
    if "epub" in options.output_formats:
        epub_path = os.path.join(output_dir, "result.epub")
        title = result.metadata.get("title", "") or os.path.basename(pdf_path)
        try:
            build_epub(md_path, images_dir, epub_path, title=title)
        except Exception as e:
            send_message({"type": "error", "id": job_id, "message": f"EPUB build failed: {e}"})
            return

    outputs = {
        "markdown": md_path,
        "epub": epub_path,
        "images": saved_images,
        "metadata": result.metadata,
    }

    send_message({"type": "complete", "id": job_id, "outputs": outputs})


def handle_model_status(msg: dict) -> None:
    engine_name = msg.get("engine", "mock")
    engine = get_engine(engine_name)
    send_message(
        {
            "type": "model_status",
            "engine": engine_name,
            "downloaded": engine.models_downloaded(),
            "size_bytes": 0,
        }
    )


def handle_download_models(msg: dict) -> None:
    engine_name = msg.get("engine", "mock")
    engine = get_engine(engine_name)

    def progress_cb(percent: float, message: str) -> None:
        send_message(
            {
                "type": "download_progress",
                "engine": engine_name,
                "percent": round(percent, 1),
                "message": message,
            }
        )

    engine.download_models(progress_cb)
    send_message(
        {
            "type": "download_complete",
            "engine": engine_name,
        }
    )


HANDLERS = {
    "convert": handle_convert,
    "model_status": handle_model_status,
    "download_models": handle_download_models,
}


def main() -> None:
    send_message({"type": "ready"})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            send_message({"type": "error", "id": None, "message": f"Invalid JSON: {e}"})
            continue

        msg_type = msg.get("type")
        if not msg_type:
            send_message({"type": "error", "id": None, "message": "Missing 'type' field"})
            continue

        handler = HANDLERS.get(msg_type)
        if handler is None:
            send_message(
                {"type": "error", "id": msg.get("id"), "message": f"Unknown message type: {msg_type}"}
            )
            continue

        try:
            handler(msg)
        except Exception as e:
            send_message({"type": "error", "id": msg.get("id"), "message": f"Handler error: {e}"})


if __name__ == "__main__":
    main()

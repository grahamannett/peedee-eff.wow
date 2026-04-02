import os
import threading

from .base import ConversionOptions, ConversionResult, OCREngine, ProgressCallback


class MarkerEngine(OCREngine):
    def __init__(self):
        self._converter = None
        self._models_loaded = False

    def name(self) -> str:
        return "marker"

    def is_available(self) -> bool:
        try:
            import marker  # noqa: F401
            return True
        except ImportError:
            return False

    def models_downloaded(self) -> bool:
        try:
            from huggingface_hub import scan_cache_dir

            cache = scan_cache_dir()
            required_repos = {"vikp/surya_det3", "vikp/surya_rec2"}
            cached_repos = {repo.repo_id for repo in cache.repos}
            return required_repos.issubset(cached_repos)
        except Exception:
            return False

    def download_models(self, progress_callback: ProgressCallback) -> None:
        progress_callback(0, "Loading marker models (this downloads them if needed)...")

        # Creating the model dict triggers downloads
        from marker.models import create_model_dict

        progress_callback(30, "Downloading/loading OCR models...")
        create_model_dict()
        progress_callback(100, "Models ready")

    def _ensure_converter(self, progress_callback: ProgressCallback):
        if self._converter is not None:
            return

        progress_callback(0, "Loading marker models...")
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict

        progress_callback(10, "Initializing model dictionary...")
        artifact_dict = create_model_dict()

        progress_callback(20, "Creating PDF converter...")
        self._converter = PdfConverter(artifact_dict=artifact_dict)
        self._models_loaded = True
        progress_callback(25, "Models loaded, starting conversion...")

    def convert(
        self,
        pdf_path: str,
        options: ConversionOptions,
        progress_callback: ProgressCallback,
    ) -> ConversionResult:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        self._ensure_converter(progress_callback)

        # Marker's converter is a blocking call without built-in progress.
        # We run it in a thread and report estimated progress.
        result_holder = {}
        error_holder = {}

        def do_convert():
            try:
                rendered = self._converter(pdf_path)
                from marker.output import text_from_rendered

                text, _, images = text_from_rendered(rendered)
                result_holder["text"] = text
                result_holder["images"] = images
                result_holder["metadata"] = rendered.metadata
            except Exception as e:
                error_holder["error"] = e

        thread = threading.Thread(target=do_convert)
        thread.start()

        # Send estimated progress while waiting
        progress_callback(30, "Converting PDF (OCR in progress)...")
        step = 30
        while thread.is_alive():
            thread.join(timeout=2.0)
            if step < 90:
                step = min(step + 5, 90)
                progress_callback(step, "Converting PDF (OCR in progress)...")

        if "error" in error_holder:
            raise error_holder["error"]

        text = result_holder["text"]
        raw_images = result_holder.get("images", {})
        metadata = result_holder.get("metadata", {})

        progress_callback(95, "Processing images...")

        images = []
        for img_name, img_data in raw_images.items():
            images.append(
                {
                    "path": img_name,
                    "data": img_data,
                    "alt": img_name,
                }
            )

        progress_callback(100, "Conversion complete")

        return ConversionResult(
            markdown=text,
            images=images,
            metadata={
                "title": metadata.get("title", ""),
                "engine": self.name(),
            },
        )

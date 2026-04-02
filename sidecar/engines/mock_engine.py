import time

from .base import ConversionOptions, ConversionResult, OCREngine, ProgressCallback


class MockEngine(OCREngine):
    def name(self) -> str:
        return "mock"

    def is_available(self) -> bool:
        return True

    def models_downloaded(self) -> bool:
        return True

    def download_models(self, progress_callback: ProgressCallback) -> None:
        for i in range(0, 101, 25):
            progress_callback(i, f"Downloading mock models... {i}%")
            time.sleep(0.05)

    def convert(
        self,
        pdf_path: str,
        options: ConversionOptions,
        progress_callback: ProgressCallback,
    ) -> ConversionResult:
        total_pages = 10
        for page in range(1, total_pages + 1):
            percent = (page / total_pages) * 100
            progress_callback(percent, f"OCR page {page}/{total_pages}...")
            time.sleep(0.05)

        markdown = f"""# Sample Document

## Chapter 1: Introduction

This is a mock conversion of `{pdf_path}`.

The document was processed with the following options:
- Force OCR: {options.force_ocr}
- Language: {options.language}
- Page range: {options.page_range or "all"}
- Extract images: {options.extract_images}

## Chapter 2: Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua.

![Figure 1](images/figure_1.png)

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
ut aliquip ex ea commodo consequat.

## Chapter 3: Conclusion

This concludes the mock conversion output.
"""

        images = [
            {"path": "images/figure_1.png", "page": 3, "alt": "Figure 1"},
        ]

        metadata = {
            "title": "Sample Document",
            "pages": total_pages,
            "engine": self.name(),
        }

        return ConversionResult(markdown=markdown, images=images, metadata=metadata)

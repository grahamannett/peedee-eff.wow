from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class ConversionResult:
    markdown: str
    images: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class ConversionOptions:
    force_ocr: bool = True
    page_range: str | None = None
    language: str = "English"
    extract_images: bool = True
    output_formats: list[str] = field(default_factory=lambda: ["epub", "markdown"])


ProgressCallback = Callable[[float, str], None]


class OCREngine(ABC):
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def is_available(self) -> bool: ...

    @abstractmethod
    def models_downloaded(self) -> bool: ...

    @abstractmethod
    def download_models(self, progress_callback: ProgressCallback) -> None: ...

    @abstractmethod
    def convert(
        self,
        pdf_path: str,
        options: ConversionOptions,
        progress_callback: ProgressCallback,
    ) -> ConversionResult: ...

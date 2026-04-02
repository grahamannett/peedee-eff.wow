from engines.base import ConversionOptions
from engines.mock_engine import MockEngine


def test_mock_engine_name():
    engine = MockEngine()
    assert engine.name() == "mock"


def test_mock_engine_available():
    engine = MockEngine()
    assert engine.is_available() is True


def test_mock_engine_models_downloaded():
    engine = MockEngine()
    assert engine.models_downloaded() is True


def test_mock_engine_convert():
    engine = MockEngine()
    options = ConversionOptions(force_ocr=True)
    progress_events = []

    def on_progress(percent: float, message: str):
        progress_events.append((percent, message))

    result = engine.convert("/tmp/test.pdf", options, on_progress)

    assert len(progress_events) > 0
    assert progress_events[-1][0] == 100.0
    assert "# Sample Document" in result.markdown
    assert len(result.images) > 0
    assert result.metadata["engine"] == "mock"


def test_mock_engine_download_models():
    engine = MockEngine()
    progress_events = []

    def on_progress(percent: float, message: str):
        progress_events.append((percent, message))

    engine.download_models(on_progress)
    assert len(progress_events) > 0
    assert progress_events[-1][0] == 100

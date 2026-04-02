# peedee-eff

i have a bunch of scanned PDFs (textbooks, papers, etc) that i want to read on my kindle or just have as markdown. this app does that — drop a PDF in, get an EPUB and/or markdown out. equations get rendered properly in the epub, images get extracted, the whole thing runs locally on your machine with no cloud anything.

![peedee-eff converting a PDF](docs/peedee-eff-running.png)

uses [marker](https://github.com/VikParuchuri/marker) for OCR. the app is a tauri v2 shell (rust backend, react frontend) that spawns a python sidecar for the heavy lifting. the sidecar talks to tauri over stdin/stdout json.

## running it

you need rust, bun, python 3.10+, and uv.

```bash
bun install
cd sidecar && uv sync && cd ..
bun tauri dev
```

first launch downloads OCR models (~2.5 GB), only happens once.

## tests

```bash
cd sidecar && uv run python -m pytest tests/ -v
cd src-tauri && cargo test
bunx tsc --noEmit
```

## layout

```
src/              frontend (react + typescript)
src-tauri/        rust backend, sidecar management
sidecar/          python ocr + epub builder
  engines/        ocr engine interface (marker, mock, etc)
  builders/       epub and markdown output
```

## status

works on macos (apple silicon). not packaged as a .dmg yet.

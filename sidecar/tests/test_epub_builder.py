import os
import tempfile
import zipfile

from builders.epub_builder import build_epub, _markdown_to_html, _split_into_chapters


def test_markdown_to_html_headings():
    html = _markdown_to_html("## Hello World")
    assert "<h2>" in html
    assert "Hello World" in html


def test_markdown_to_html_bold():
    html = _markdown_to_html("This is **bold** text")
    assert "<strong>bold</strong>" in html


def test_markdown_to_html_images():
    html = _markdown_to_html("![alt text](image.png)")
    assert '<img src="image.png" alt="alt text"/>' in html


def test_markdown_to_html_lists():
    html = _markdown_to_html("- item 1\n- item 2")
    assert "<ul>" in html
    assert "<li>" in html


def test_split_into_chapters():
    md = """## Chapter 1
Some content here.

## Chapter 2
More content here.
"""
    chapters = _split_into_chapters(md)
    assert len(chapters) == 2
    assert chapters[0][0] == "Chapter 1"
    assert chapters[1][0] == "Chapter 2"


def test_build_epub_basic():
    with tempfile.TemporaryDirectory() as tmpdir:
        md_path = os.path.join(tmpdir, "test.md")
        epub_path = os.path.join(tmpdir, "test.epub")

        with open(md_path, "w") as f:
            f.write("""## Chapter 1

This is the first chapter.

## Chapter 2

This is the second chapter with **bold** text.
""")

        result = build_epub(md_path, None, epub_path, title="Test Book")

        assert os.path.exists(result)

        # Validate EPUB structure
        with zipfile.ZipFile(result, "r") as z:
            names = z.namelist()
            assert "mimetype" in names
            assert "META-INF/container.xml" in names

            mimetype = z.read("mimetype").decode()
            assert mimetype == "application/epub+zip"

            # Check chapters exist
            chapter_files = [n for n in names if "chapter" in n]
            assert len(chapter_files) >= 2


def test_build_epub_with_images():
    with tempfile.TemporaryDirectory() as tmpdir:
        md_path = os.path.join(tmpdir, "test.md")
        images_dir = os.path.join(tmpdir, "images")
        epub_path = os.path.join(tmpdir, "test.epub")

        os.makedirs(images_dir)

        # Create a tiny PNG (1x1 pixel)
        import struct
        import zlib

        def create_minimal_png():
            signature = b"\x89PNG\r\n\x1a\n"
            ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
            ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data)
            ihdr = struct.pack(">I", 13) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)
            raw = b"\x00\xff\x00\x00"
            compressed = zlib.compress(raw)
            idat_crc = zlib.crc32(b"IDAT" + compressed)
            idat = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", idat_crc)
            iend_crc = zlib.crc32(b"IEND")
            iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)
            return signature + ihdr + idat + iend

        with open(os.path.join(images_dir, "test.png"), "wb") as f:
            f.write(create_minimal_png())

        with open(md_path, "w") as f:
            f.write("""## Chapter 1

Here is an image:

![Test Image](test.png)
""")

        result = build_epub(md_path, images_dir, epub_path, title="Image Test")
        assert os.path.exists(result)

        with zipfile.ZipFile(result, "r") as z:
            image_files = [n for n in z.namelist() if "images/" in n]
            assert len(image_files) >= 1

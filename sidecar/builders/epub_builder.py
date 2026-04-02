import os
import re
import uuid

import latex2mathml.converter
from ebooklib import epub


DEFAULT_CSS = """
body {
    font-family: Georgia, serif;
    line-height: 1.6;
    margin: 1em;
    color: #333;
}
h1, h2, h3, h4, h5, h6 {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
}
h1 { font-size: 1.8em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }
p { margin: 0.8em 0; }
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
}
code {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 0.9em;
    background: #f5f5f5;
    padding: 0.15em 0.3em;
    border-radius: 3px;
}
pre {
    background: #f5f5f5;
    padding: 1em;
    overflow-x: auto;
    border-radius: 5px;
}
blockquote {
    border-left: 3px solid #ccc;
    padding-left: 1em;
    margin-left: 0;
    color: #666;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}
th, td {
    border: 1px solid #ddd;
    padding: 0.5em;
    text-align: left;
}
th { background: #f5f5f5; font-weight: bold; }
.math-block {
    text-align: center;
    margin: 1.2em 0;
    overflow-x: auto;
}
"""


def _markdown_to_html(text: str) -> str:
    """Minimal markdown-to-HTML conversion for EPUB content."""
    lines = text.split("\n")
    html_parts = []
    in_code_block = False
    in_list = False
    list_type = None

    for line in lines:
        # Code blocks
        if line.strip().startswith("```"):
            if in_code_block:
                html_parts.append("</code></pre>")
                in_code_block = False
            else:
                lang = line.strip()[3:]
                html_parts.append(f"<pre><code>")
                in_code_block = True
            continue

        if in_code_block:
            html_parts.append(_escape_html(line))
            continue

        # Close list if needed
        if in_list and not line.strip().startswith(("- ", "* ", "1.")):
            tag = "ul" if list_type == "ul" else "ol"
            html_parts.append(f"</{tag}>")
            in_list = False

        stripped = line.strip()

        # Empty lines
        if not stripped:
            html_parts.append("")
            continue

        # Headers
        header_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if header_match:
            level = len(header_match.group(1))
            content = _inline_format(header_match.group(2))
            html_parts.append(f"<h{level}>{content}</h{level}>")
            continue

        # Unordered lists
        if stripped.startswith(("- ", "* ")):
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
                list_type = "ul"
            content = _inline_format(stripped[2:])
            html_parts.append(f"<li>{content}</li>")
            continue

        # Blockquotes
        if stripped.startswith("> "):
            content = _inline_format(stripped[2:])
            html_parts.append(f"<blockquote><p>{content}</p></blockquote>")
            continue

        # Horizontal rules
        if stripped in ("---", "***", "___"):
            html_parts.append("<hr/>")
            continue

        # Display math on its own line: $$...$$
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            latex = stripped[2:-2].strip()
            mathml = _latex_to_mathml(latex, display=True)
            html_parts.append(f"<div class=\"math-block\">{mathml}</div>")
            continue

        # Regular paragraph
        html_parts.append(f"<p>{_inline_format(stripped)}</p>")

    if in_list:
        tag = "ul" if list_type == "ul" else "ol"
        html_parts.append(f"</{tag}>")
    if in_code_block:
        html_parts.append("</code></pre>")

    return "\n".join(html_parts)


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _latex_to_mathml(latex: str, display: bool = False) -> str:
    """Convert a LaTeX math string to MathML."""
    try:
        mathml = latex2mathml.converter.convert(latex)
        if display:
            # Switch to display mode
            mathml = mathml.replace('display="inline"', 'display="block"')
        return mathml
    except Exception:
        # Fallback: return the raw LaTeX in a code element
        return f"<code>{_escape_html(latex)}</code>"


def _convert_math(text: str) -> str:
    """Convert LaTeX math expressions in text to MathML.

    Handles:
    - Display math: $$...$$ (block-level)
    - Inline math: $...$ (inline)
    - Escaped dollars: \\$ (left as literal $)
    """
    # First, protect escaped dollar signs
    text = text.replace(r"\$", "\x00ESCAPED_DOLLAR\x00")

    # Display math: $$...$$
    def replace_display(m):
        return _latex_to_mathml(m.group(1).strip(), display=True)

    text = re.sub(r"\$\$(.+?)\$\$", replace_display, text, flags=re.DOTALL)

    # Inline math: $...$  (but not empty $$ which we already handled)
    def replace_inline(m):
        return _latex_to_mathml(m.group(1).strip(), display=False)

    text = re.sub(r"\$([^\$]+?)\$", replace_inline, text)

    # Restore escaped dollars
    text = text.replace("\x00ESCAPED_DOLLAR\x00", "$")

    return text


def _inline_format(text: str) -> str:
    """Handle inline markdown formatting."""
    # Math first (before other formatting that might interfere)
    text = _convert_math(text)
    # Images: ![alt](src)
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1"/>', text)
    # Links: [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    # Bold+Italic
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", text)
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # Italic
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    # Inline code
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


def _split_into_chapters(markdown: str) -> list[tuple[str, str]]:
    """Split markdown by top-level headings into (title, content) chapters."""
    # Split on ## headings (h2 level, which marker uses for sections)
    pattern = r"^(#{1,2})\s+(.+)$"
    chapters = []
    current_title = "Introduction"
    current_content = []

    for line in markdown.split("\n"):
        match = re.match(pattern, line)
        if match and len(match.group(1)) <= 2:
            # Save previous chapter if it has content
            if current_content:
                content = "\n".join(current_content).strip()
                if content:
                    chapters.append((current_title, content))
            current_title = match.group(2).strip("*").strip()
            current_content = [line]
        else:
            current_content.append(line)

    # Save last chapter
    if current_content:
        content = "\n".join(current_content).strip()
        if content:
            chapters.append((current_title, content))

    # If no chapters found, treat entire text as one chapter
    if not chapters:
        chapters = [("Document", markdown)]

    return chapters


def build_epub(
    markdown_path: str,
    images_dir: str | None,
    output_path: str,
    title: str = "Converted Document",
    author: str = "peedee-eff",
) -> str:
    """Build an EPUB file from a markdown file and optional images directory."""
    with open(markdown_path, "r") as f:
        markdown_text = f.read()

    book = epub.EpubBook()

    # Metadata
    book.set_identifier(str(uuid.uuid4()))
    book.set_title(title)
    book.set_language("en")
    book.add_author(author)

    # CSS
    style = epub.EpubItem(
        uid="style",
        file_name="style/default.css",
        media_type="text/css",
        content=DEFAULT_CSS.encode("utf-8"),
    )
    book.add_item(style)

    # Add images
    image_items = {}
    if images_dir and os.path.isdir(images_dir):
        for root, _, files in os.walk(images_dir):
            for filename in files:
                if filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg")):
                    filepath = os.path.join(root, filename)
                    rel_path = os.path.relpath(filepath, images_dir)
                    epub_path = f"images/{rel_path}"

                    ext = os.path.splitext(filename)[1].lower()
                    media_types = {
                        ".png": "image/png",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".gif": "image/gif",
                        ".svg": "image/svg+xml",
                    }
                    media_type = media_types.get(ext, "image/png")

                    with open(filepath, "rb") as img_file:
                        img_content = img_file.read()

                    img_item = epub.EpubItem(
                        uid=f"img_{rel_path}",
                        file_name=epub_path,
                        media_type=media_type,
                        content=img_content,
                    )
                    book.add_item(img_item)
                    image_items[rel_path] = epub_path

    # Build chapters
    chapters = _split_into_chapters(markdown_text)
    epub_chapters = []
    toc = []

    for i, (title_text, content) in enumerate(chapters):
        chapter = epub.EpubHtml(
            title=title_text,
            file_name=f"chapter_{i}.xhtml",
            lang="en",
        )

        # Convert markdown content to HTML
        html_content = _markdown_to_html(content)

        # Rewrite image paths for EPUB
        for original, epub_path in image_items.items():
            html_content = html_content.replace(original, epub_path)

        chapter.content = f"""<html xmlns="http://www.w3.org/1999/xhtml" xmlns:m="http://www.w3.org/1998/Math/MathML">
<head><link rel="stylesheet" href="style/default.css"/></head>
<body>
{html_content}
</body>
</html>""".encode("utf-8")

        chapter.add_item(style)
        book.add_item(chapter)
        epub_chapters.append(chapter)
        toc.append(epub.Link(f"chapter_{i}.xhtml", title_text, f"ch{i}"))

    # Table of contents and spine
    book.toc = toc
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + epub_chapters

    epub.write_epub(output_path, book)
    return output_path

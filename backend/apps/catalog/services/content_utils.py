"""
Утиліти для роботи з content_json:
- extract_plain_text, extract_toc, validate_content_json
"""

import copy
import json
import logging
import os
import re
import shutil
from urllib.parse import unquote, urlparse

ALLOWED_NODE_TYPES = frozenset(
    {
        "doc",
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "listItem",
        "image",
        "horizontalRule",
        "hardBreak",
        "table",
        "tableRow",
        "tableCell",
        "tableHeader",
        "text",
    }
)

ALLOWED_MARK_TYPES = frozenset(
    {
        "bold",
        "italic",
        "underline",
        "strike",
        "textStyle",
        "link",
        "superscript",
        "subscript",
        "highlight",
    }
)

DANGEROUS_URL_PREFIXES = ("javascript:", "data:text/html", "vbscript:")

MAX_CONTENT_JSON_SIZE = 5 * 1024 * 1024

logger = logging.getLogger(__name__)

_FORBIDDEN_IN_STYLE_VALUE = re.compile(r"[;(){}\\\n\r]")
_RE_CSS_COLOR = re.compile(
    r"^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|"
    r"rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|"
    r"[a-zA-Z]{1,30})$"
)
_RE_CSS_FONT_SIZE = re.compile(r"^\d+(\.\d+)?(px|pt|em|rem|%)$")
_RE_CSS_FONT_FAMILY = re.compile(r"^[\w\s\-,\"'.]{1,200}$", re.UNICODE)


def validate_css_color(value: str) -> bool:
    """Перевірка кольору для color / backgroundColor / highlight (без CSS-ін'єкцій)."""
    if not isinstance(value, str):
        return False
    v = value.strip()
    if not v or _FORBIDDEN_IN_STYLE_VALUE.search(v):
        return False
    return bool(_RE_CSS_COLOR.match(v))


def validate_text_style_value(key: str, value: str) -> bool:
    """Валідація значень textStyle при збереженні content_json."""
    if not isinstance(value, str):
        return False
    v = value.strip()
    if not v or _FORBIDDEN_IN_STYLE_VALUE.search(v):
        return False
    if key in ("color", "backgroundColor"):
        return validate_css_color(v)
    if key == "fontSize":
        return bool(_RE_CSS_FONT_SIZE.match(v))
    if key == "fontFamily":
        return bool(_RE_CSS_FONT_FAMILY.match(v))
    return False


def extract_plain_text(content_json: dict) -> str:
    """Рекурсивно витягує весь текст із content_json."""
    if not content_json:
        return ""

    if content_json.get("type") == "text":
        return content_json.get("text", "")

    parts = []
    for child in content_json.get("content", []):
        text = extract_plain_text(child)
        if text:
            parts.append(text)

    node_type = content_json.get("type", "")
    if node_type in ("paragraph", "heading", "listItem", "blockquote", "tableCell"):
        return "".join(parts) + "\n"

    return "".join(parts)


def extract_toc(content_json: dict) -> list:
    """Витягує заголовки для навігаційного змісту."""
    if not content_json:
        return []

    toc = []
    for node in content_json.get("content", []):
        if node.get("type") == "heading":
            level = node.get("attrs", {}).get("level", 1)
            text = extract_plain_text(node).strip()
            if text:
                toc.append({"level": level, "text": text})

    return toc


def validate_content_json(data, depth: int = 0) -> bool:
    """Валідує структуру content_json."""
    if depth > 50:
        return False

    if not isinstance(data, dict):
        return False

    node_type = data.get("type")
    if node_type is None:
        return False

    if node_type not in ALLOWED_NODE_TYPES:
        return False

    if depth == 0 and node_type != "doc":
        return False

    for mark in data.get("marks", []):
        if not isinstance(mark, dict):
            return False
        if mark.get("type") not in ALLOWED_MARK_TYPES:
            return False

        mark_attrs = mark.get("attrs", {})

        if mark.get("type") == "link":
            href = str(mark_attrs.get("href", ""))
            if any(href.lower().startswith(p) for p in DANGEROUS_URL_PREFIXES):
                return False

        if mark.get("type") == "textStyle":
            allowed_style_keys = {"color", "fontSize", "fontFamily", "backgroundColor"}
            if not set(mark_attrs.keys()).issubset(allowed_style_keys):
                return False
            for style_key, style_val in mark_attrs.items():
                if not validate_text_style_value(style_key, str(style_val)):
                    return False

        if mark.get("type") == "highlight":
            ha = mark.get("attrs")
            if ha is not None:
                if not isinstance(ha, dict):
                    return False
                if set(ha.keys()) - {"color"}:
                    return False
                if "color" in ha and not validate_css_color(str(ha["color"])):
                    return False

    if node_type == "image":
        src = str(data.get("attrs", {}).get("src", ""))
        if any(src.lower().startswith(p) for p in DANGEROUS_URL_PREFIXES):
            return False

    if node_type == "text":
        if not isinstance(data.get("text"), str):
            return False

    children = data.get("content", [])
    if not isinstance(children, list):
        return False

    for child in children:
        if not validate_content_json(child, depth + 1):
            return False

    return True


def content_json_byte_size(content_json: dict) -> int:
    """Розмір JSON у байтах (UTF-8) для ліміту на збереження."""
    return len(json.dumps(content_json, ensure_ascii=False).encode("utf-8"))


def group_list_items(nodes: list) -> list:
    """Групує послідовні _listItem у bulletList."""
    result = []
    current_list = None

    for node in nodes:
        if node.get("type") == "_listItem":
            inner_content = node.get("content", [])
            list_item = {
                "type": "listItem",
                "content": [
                    {"type": "paragraph", "content": inner_content}
                    if inner_content
                    else {"type": "paragraph"}
                ],
            }

            if current_list is None:
                current_list = {"type": "bulletList", "content": []}
            current_list["content"].append(list_item)
        else:
            if current_list is not None:
                result.append(current_list)
                current_list = None
            result.append(node)

    if current_list is not None:
        result.append(current_list)

    return result


def iter_image_srcs_from_content_json(node) -> list[str]:
    """Усі attrs.src з вузлів type=image (рекурсивно)."""
    out: list[str] = []
    if not isinstance(node, dict):
        return out
    if node.get("type") == "image":
        attrs = node.get("attrs") or {}
        src = attrs.get("src")
        if isinstance(src, str) and src.strip():
            out.append(src.strip())
    for child in node.get("content") or []:
        out.extend(iter_image_srcs_from_content_json(child))
    return out


def src_to_media_relative_path(src: str, media_url: str) -> str | None:
    """
    Шлях відносно MEDIA_ROOT (posix), напр. books/foo/chapters/images/x.jpg
    або tmp/editor-images/5/uuid.png. None якщо не вдалося розпізнати.
    """
    if not src or not isinstance(src, str):
        return None
    s = src.strip()
    mu = (media_url or "/media/").rstrip("/")
    if "://" in s:
        path = unquote(urlparse(s).path or "")
    else:
        path = unquote(s.split("?")[0])
    path = path.replace("\\", "/")
    if not path.startswith("/"):
        path = "/" + path
    media_prefix = mu if mu.startswith("/") else "/" + mu
    if not media_prefix.endswith("/"):
        media_prefix += "/"
    if path.startswith(media_prefix):
        rel = path[len(media_prefix) :].lstrip("/")
        return rel
    if path.startswith("/media/"):
        return path[len("/media/") :].lstrip("/")
    if path.lstrip("/").startswith("tmp/editor-images/"):
        return path.lstrip("/")
    if path.lstrip("/").startswith("books/"):
        return path.lstrip("/")
    return None


def relocate_temp_images(
    content_json: dict,
    user_id: int,
    book_slug: str,
    chapter_slug: str,
    media_root: str,
    media_url: str,
) -> dict:
    """
    Переносить файли з tmp/editor-images/<user_id>/ у books/<book_slug>/chapters/images/,
    оновлює src у JSON. Ідемпотентно: якщо джерела немає, а ціль існує — лишає новий URL.
    """
    data = copy.deepcopy(content_json)
    prefix = f"tmp/editor-images/{int(user_id)}/"
    dest_dir = os.path.join(media_root, "books", book_slug, "chapters", "images")
    os.makedirs(dest_dir, exist_ok=True)
    mu = (media_url or "/media/").rstrip("/")

    def walk(n):
        if not isinstance(n, dict):
            return
        if n.get("type") == "image":
            attrs = n.setdefault("attrs", {})
            src = attrs.get("src")
            if not isinstance(src, str):
                return
            rel = src_to_media_relative_path(src, media_url)
            if not rel or not rel.startswith(prefix):
                return
            fname = os.path.basename(rel)
            if not fname:
                return
            src_abs = os.path.normpath(os.path.join(media_root, rel.replace("/", os.sep)))
            dest_abs = os.path.normpath(os.path.join(dest_dir, fname))
            media_root_norm = os.path.normpath(media_root)
            if not src_abs.startswith(media_root_norm) or not dest_abs.startswith(
                media_root_norm
            ):
                logger.warning("relocate_temp_images: path outside MEDIA_ROOT, skip")
                return
            new_rel = f"books/{book_slug}/chapters/images/{fname}".replace("\\", "/")
            new_url = f"{mu}/{new_rel}"

            if os.path.isfile(src_abs):
                try:
                    shutil.move(src_abs, dest_abs)
                except OSError as e:
                    logger.warning("relocate_temp_images move %s -> %s: %s", src_abs, dest_abs, e)
                    if not os.path.isfile(dest_abs):
                        return
            elif os.path.isfile(dest_abs):
                pass
            else:
                return

            attrs["src"] = new_url

        for child in n.get("content") or []:
            walk(child)

    walk(data)
    return data


def collect_referenced_chapter_image_rel_paths(content_json, media_url: str) -> set[str]:
    """Відносні шляхи (posix) до зображень у books/.../chapters/images/ з одного content_json."""
    refs: set[str] = set()
    for src in iter_image_srcs_from_content_json(content_json):
        rel = src_to_media_relative_path(src, media_url)
        if rel and "/chapters/images/" in rel and rel.startswith("books/"):
            refs.add(rel.replace("\\", "/"))
    return refs

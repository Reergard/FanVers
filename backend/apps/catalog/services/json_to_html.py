"""
Рендеринг content_json → HTML з inline-стилями.
"""

from html import escape

from apps.catalog.services.content_utils import validate_css_color, validate_text_style_value


def render_content_json(content_json: dict) -> str:
    """Головна функція: content_json → HTML-рядок."""
    if not content_json:
        return ""
    return _render_node(content_json)


def _render_node(node: dict) -> str:
    """Рекурсивний рендеринг одного вузла."""
    node_type = node.get("type", "")
    attrs = node.get("attrs", {})
    content = node.get("content", [])
    marks = node.get("marks", [])

    if node_type == "text":
        html = escape(node.get("text", ""))
        for mark in reversed(marks):
            html = _wrap_mark(html, mark)
        return html

    if node_type == "doc":
        return "".join(_render_node(c) for c in content)

    if node_type == "paragraph":
        style = _build_block_style(attrs)
        inner = "".join(_render_node(c) for c in content)
        return f"<p{style}>{inner}</p>\n"

    if node_type == "heading":
        level = min(max(attrs.get("level", 1), 1), 6)
        style = _build_block_style(attrs)
        inner = "".join(_render_node(c) for c in content)
        return f"<h{level}{style}>{inner}</h{level}>\n"

    if node_type == "blockquote":
        inner = "".join(_render_node(c) for c in content)
        return f"<blockquote>{inner}</blockquote>\n"

    if node_type == "image":
        src = escape(str(attrs.get("src") or ""))
        alt = escape(str(attrs.get("alt") or ""))
        parts = [f'src="{src}"', f'alt="{alt}"']
        title = attrs.get("title")
        if title is not None:
            parts.append(f'title="{escape(str(title))}"')
        if attrs.get("width"):
            parts.append(f'width="{int(attrs["width"])}"')
        if attrs.get("height"):
            parts.append(f'height="{int(attrs["height"])}"')
        return f'<img {" ".join(parts)} />\n'

    if node_type == "horizontalRule":
        return "<hr />\n"

    if node_type == "hardBreak":
        return "<br />"

    if node_type == "bulletList":
        inner = "".join(_render_node(c) for c in content)
        return f"<ul>{inner}</ul>\n"

    if node_type == "orderedList":
        start = attrs.get("start", 1)
        start_attr = f' start="{start}"' if start != 1 else ""
        inner = "".join(_render_node(c) for c in content)
        return f"<ol{start_attr}>{inner}</ol>\n"

    if node_type == "listItem":
        inner = "".join(_render_node(c) for c in content)
        return f"<li>{inner}</li>\n"

    if node_type == "table":
        inner = "".join(_render_node(c) for c in content)
        return f"<table>{inner}</table>\n"

    if node_type == "tableRow":
        inner = "".join(_render_node(c) for c in content)
        return f"<tr>{inner}</tr>\n"

    if node_type == "tableCell":
        colspan = attrs.get("colspan", 1)
        rowspan = attrs.get("rowspan", 1)
        extra = ""
        if colspan > 1:
            extra += f' colspan="{colspan}"'
        if rowspan > 1:
            extra += f' rowspan="{rowspan}"'
        inner = "".join(_render_node(c) for c in content)
        return f"<td{extra}>{inner}</td>\n"

    if node_type == "tableHeader":
        colspan = attrs.get("colspan", 1)
        rowspan = attrs.get("rowspan", 1)
        extra = ""
        if colspan > 1:
            extra += f' colspan="{colspan}"'
        if rowspan > 1:
            extra += f' rowspan="{rowspan}"'
        inner = "".join(_render_node(c) for c in content)
        return f"<th{extra}>{inner}</th>\n"

    return "".join(_render_node(c) for c in content)


def _wrap_mark(html: str, mark: dict) -> str:
    """Обертає HTML-фрагмент у тег відповідно до mark."""
    mark_type = mark.get("type", "")
    attrs = mark.get("attrs", {})

    if mark_type == "bold":
        return f"<strong>{html}</strong>"
    if mark_type == "italic":
        return f"<em>{html}</em>"
    if mark_type == "underline":
        return f'<span style="text-decoration:underline">{html}</span>'
    if mark_type == "strike":
        return f"<s>{html}</s>"
    if mark_type == "superscript":
        return f"<sup>{html}</sup>"
    if mark_type == "subscript":
        return f"<sub>{html}</sub>"

    if mark_type == "link":
        href = escape(attrs.get("href", ""))
        if href.lower().startswith("javascript:"):
            return html
        target = attrs.get("target", "_blank")
        if target not in ("_blank", "_self", "_parent", "_top"):
            target = "_blank"
        return (
            f'<a href="{href}" target="{target}" rel="noopener noreferrer">{html}</a>'
        )

    if mark_type == "textStyle":
        parts = []
        for attr_key, css_prop in (
            ("color", "color"),
            ("fontSize", "font-size"),
            ("fontFamily", "font-family"),
            ("backgroundColor", "background-color"),
        ):
            raw = attrs.get(attr_key)
            if not raw:
                continue
            val = str(raw).strip()
            if validate_text_style_value(attr_key, val):
                parts.append(f"{css_prop}:{val}")
        style = ";".join(parts)
        return f'<span style="{style}">{html}</span>' if style else html

    if mark_type == "highlight":
        raw = attrs.get("color", "yellow")
        color = str(raw).strip() if raw is not None else "yellow"
        if not validate_css_color(color):
            color = "yellow"
        return f'<mark style="background-color:{color}">{html}</mark>'

    return html


def _build_block_style(attrs: dict) -> str:
    """Будує атрибут style для блочного елемента."""
    parts = []
    text_align = attrs.get("textAlign")
    if text_align in ("left", "center", "right", "justify"):
        parts.append(f"text-align:{text_align}")
    if not parts:
        return ""
    return f' style="{";".join(parts)}"'

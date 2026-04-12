"""
Конвертація існуючого HTML (mammoth) → content_json. Лише для міграції.
"""

from lxml import html as lxml_html

from apps.catalog.services.content_utils import group_list_items, validate_css_color


def html_to_content_json(html: str) -> dict:
    if not html or not str(html).strip():
        return {"type": "doc", "content": [{"type": "paragraph"}]}

    try:
        frags = lxml_html.fragments_fromstring(html)
    except (lxml_html.ParserError, TypeError):
        return {"type": "doc", "content": [{"type": "paragraph"}]}

    if not frags:
        return {"type": "doc", "content": [{"type": "paragraph"}]}

    nodes = []
    for frag in frags:
        if hasattr(frag, "tag"):
            got = _block_element(frag)
            if got:
                if isinstance(got, list):
                    nodes.extend(got)
                else:
                    nodes.append(got)
        elif isinstance(frag, str) and frag.strip():
            nodes.append(
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": frag.strip()}],
                }
            )

    nodes = group_list_items(nodes)
    if not nodes:
        nodes = [{"type": "paragraph"}]
    return {"type": "doc", "content": nodes}


def _block_element(el):
    if not isinstance(el.tag, str):
        return None
    tag = el.tag.lower()

    if tag == "p":
        inner = _inlines(el)
        return {"type": "paragraph", "content": inner} if inner else {"type": "paragraph"}

    if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
        lvl = int(tag[1])
        inner = _inlines(el)
        return {
            "type": "heading",
            "attrs": {"level": lvl},
            "content": inner or [{"type": "text", "text": ""}],
        }

    if tag == "blockquote":
        inner = []
        for ch in el:
            sub = _block_element(ch)
            if not sub:
                continue
            if isinstance(sub, list):
                inner.extend(sub)
            else:
                inner.append(sub)
        if not inner:
            inner = [{"type": "paragraph"}]
        return {"type": "blockquote", "content": inner}

    if tag == "ul":
        items = []
        for li in el:
            if isinstance(li.tag, str) and li.tag.lower() == "li":
                items.append(_li_node(li))
        return {"type": "bulletList", "content": items} if items else None

    if tag == "ol":
        items = []
        for li in el:
            if isinstance(li.tag, str) and li.tag.lower() == "li":
                items.append(_li_node(li))
        if not items:
            return None
        node = {"type": "orderedList", "content": items}
        try:
            start = int(el.get("start", "1") or 1)
            if start != 1:
                node["attrs"] = {"start": start}
        except (TypeError, ValueError):
            pass
        return node

    if tag == "table":
        rows = []
        for tr in el.findall(".//tr"):
            cells = []
            for cell in tr:
                ct = cell.tag.lower() if isinstance(cell.tag, str) else ""
                if ct not in ("td", "th"):
                    continue
                cell_nodes = []
                for ch in cell:
                    bn = _block_element(ch)
                    if bn:
                        cell_nodes.append(bn)
                if not cell_nodes:
                    cell_nodes = [{"type": "paragraph"}]
                cell_nodes = group_list_items(cell_nodes)
                cells.append({"type": "tableCell", "content": cell_nodes})
            if cells:
                rows.append({"type": "tableRow", "content": cells})
        return {"type": "table", "content": rows} if rows else None

    if tag == "img":
        return {
            "type": "image",
            "attrs": {
                "src": el.get("src", "") or "",
                "alt": el.get("alt", "") or "",
            },
        }

    if tag == "hr":
        return {"type": "horizontalRule"}

    if tag in ("div", "section"):
        acc = []
        for ch in el:
            bn = _block_element(ch)
            if not bn:
                continue
            if isinstance(bn, list):
                acc.extend(bn)
            else:
                acc.append(bn)
        if not acc:
            return None
        if len(acc) == 1:
            return acc[0]
        return acc

    inner = _inlines(el)
    if inner:
        return {"type": "paragraph", "content": inner}
    return None


def _li_node(li_el):
    blocks = []
    if li_el.text and li_el.text.strip():
        blocks.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": li_el.text.strip()}],
            }
        )
    for ch in li_el:
        bn = _block_element(ch)
        if bn:
            blocks.append(bn)
    if not blocks:
        return {"type": "listItem", "content": [{"type": "paragraph"}]}
    norm = []
    for b in blocks:
        if b.get("type") == "paragraph":
            norm.append(b)
        else:
            norm.append({"type": "paragraph", "content": _as_inline(b)})
    return {"type": "listItem", "content": norm}


def _as_inline(node):
    if node.get("type") == "text":
        return [node]
    if node.get("type") == "paragraph":
        return node.get("content") or []
    return [{"type": "text", "text": (node.get("text") or "")}]


def _style_to_text_style_attrs(style_str: str) -> dict:
    """Узгоджено з validate_content_json (textStyle)."""
    if not style_str or not str(style_str).strip():
        return {}
    key_to_pm = {
        "color": "color",
        "font-size": "fontSize",
        "font-family": "fontFamily",
        "background-color": "backgroundColor",
    }
    out = {}
    for part in style_str.split(";"):
        part = part.strip()
        if not part or ":" not in part:
            continue
        key, val = part.split(":", 1)
        key = key.strip().lower()
        val = val.strip().strip("\"'")
        pm = key_to_pm.get(key)
        if pm and val:
            out[pm] = val
    return out


def _inlines(el, marks=None):
    marks = marks or []
    out = []

    if el.text:
        t = el.text
        if t:
            tn = {"type": "text", "text": t}
            if marks:
                tn["marks"] = list(marks)
            out.append(tn)

    for child in el:
        if not isinstance(child.tag, str):
            continue
        ct = child.tag.lower()
        nm = list(marks)
        if ct in ("strong", "b"):
            nm.append({"type": "bold"})
        elif ct in ("em", "i"):
            nm.append({"type": "italic"})
        elif ct == "u":
            nm.append({"type": "underline"})
        elif ct in ("s", "del"):
            nm.append({"type": "strike"})
        elif ct == "sup":
            nm.append({"type": "superscript"})
        elif ct == "sub":
            nm.append({"type": "subscript"})
        elif ct == "mark":
            mark_style = child.get("style", "") or ""
            bg_color = "yellow"
            for part in mark_style.split(";"):
                part = part.strip()
                if part.lower().startswith("background-color:"):
                    cand = part.split(":", 1)[1].strip().strip("\"'")
                    if validate_css_color(cand):
                        bg_color = cand
                    break
            nm_mark = list(marks)
            nm_mark.append({"type": "highlight", "attrs": {"color": bg_color}})
            out.extend(_inlines(child, nm_mark))
            if child.tail:
                tn = {"type": "text", "text": child.tail}
                if marks:
                    tn["marks"] = list(marks)
                out.append(tn)
            continue
        elif ct == "a":
            nm.append({"type": "link", "attrs": {"href": child.get("href", "") or ""}})
        elif ct == "span":
            ts_attrs = _style_to_text_style_attrs(child.get("style", "") or "")
            nm_span = list(marks)
            if ts_attrs:
                nm_span.append({"type": "textStyle", "attrs": ts_attrs})
            out.extend(_inlines(child, nm_span))
            if child.tail:
                tn = {"type": "text", "text": child.tail}
                if marks:
                    tn["marks"] = list(marks)
                out.append(tn)
            continue
        elif ct == "br":
            out.append({"type": "hardBreak"})
            if child.tail:
                tn = {"type": "text", "text": child.tail}
                if marks:
                    tn["marks"] = list(marks)
                out.append(tn)
            continue
        elif ct == "img":
            out.append(
                {
                    "type": "image",
                    "attrs": {
                        "src": child.get("src", "") or "",
                        "alt": child.get("alt", "") or "",
                    },
                }
            )
            if child.tail:
                tn = {"type": "text", "text": child.tail}
                if marks:
                    tn["marks"] = list(marks)
                out.append(tn)
            continue
        else:
            out.extend(_inlines(child, marks))
            if child.tail:
                tn = {"type": "text", "text": child.tail}
                if marks:
                    tn["marks"] = list(marks)
                out.append(tn)
            continue

        out.extend(_inlines(child, nm))
        if child.tail:
            tn = {"type": "text", "text": child.tail}
            if marks:
                tn["marks"] = list(marks)
            out.append(tn)

    return out

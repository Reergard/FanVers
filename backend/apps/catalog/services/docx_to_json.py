"""
Конвертація .docx → ProseMirror-сумісний content_json (python-docx).
"""

import hashlib
import os
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph

from apps.catalog.services.content_utils import group_list_items

ALIGN_MAP = {
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
}

HIGHLIGHT_COLOR_MAP = {
    1: "#FFFF00",
    2: "#00FF00",
    3: "#00FFFF",
    4: "#FF00FF",
    5: "#0000FF",
    6: "#FF0000",
    7: "#00008B",
    8: "#008080",
    9: "#008000",
    10: "#800080",
    11: "#800000",
    12: "#808000",
    13: "#808080",
    14: "#C0C0C0",
    15: "#000000",
}


def docx_to_content_json(
    docx_path: str,
    media_dir: str = None,
    book_slug: str = "",
    chapter_slug: str = "",
) -> dict:
    doc = Document(docx_path)

    image_map = {}
    if media_dir and book_slug:
        image_map = _extract_images(doc, media_dir, book_slug, chapter_slug)

    nodes = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            para = Paragraph(child, doc)
            nodes.extend(_paragraph_nodes(para, image_map))
        elif child.tag == qn("w:tbl"):
            table = Table(child, doc)
            table_node = _table_to_node(table, image_map)
            if table_node:
                nodes.append(table_node)

    nodes = group_list_items(nodes)

    if not nodes:
        nodes = [{"type": "paragraph", "content": [{"type": "text", "text": ""}]}]

    return {"type": "doc", "content": nodes}


def _has_num_pr(para) -> bool:
    return para._element.find(qn("w:pPr/w:numPr")) is not None


def _paragraph_nodes(para, image_map: dict) -> list:
    node_type, extra_attrs = _detect_node_type(para)
    if _has_num_pr(para):
        node_type, extra_attrs = "_listItem", {}

    attrs = {}
    if para.alignment and para.alignment in ALIGN_MAP:
        attrs["textAlign"] = ALIGN_MAP[para.alignment]
    attrs.update(extra_attrs)

    text_nodes = []
    for run in para.runs:
        if not run.text:
            continue
        text_node = {"type": "text", "text": run.text}
        marks = _extract_marks(run)
        if marks:
            text_node["marks"] = marks
        text_nodes.append(text_node)

    inline_images = _get_paragraph_images(para, image_map)
    out = []

    if node_type == "_listItem":
        inner = text_nodes
        out.append({"type": "_listItem", "content": inner})
        for img in inline_images:
            out.append(img)
        return out

    if inline_images and not text_nodes:
        out.append(inline_images[0])
        out.extend(inline_images[1:])
        return out

    node = {"type": node_type}
    if attrs:
        node["attrs"] = attrs
    if text_nodes:
        node["content"] = text_nodes

    if node_type == "blockquote":
        inner = {"type": "paragraph"}
        if text_nodes:
            inner["content"] = text_nodes
        if attrs.get("textAlign"):
            inner["attrs"] = {"textAlign": attrs["textAlign"]}
        node = {"type": "blockquote", "content": [inner]}

    if not text_nodes and not inline_images and node_type == "paragraph":
        node = {"type": "paragraph"}

    out.append(node)
    out.extend(inline_images)
    return out


def _detect_node_type(para) -> tuple:
    style_name = (para.style.name or "").lower().strip()

    if style_name.startswith("heading"):
        level_match = re.search(r"\d+", style_name)
        level = int(level_match.group()) if level_match else 1
        return "heading", {"level": min(max(level, 1), 6)}

    if style_name in (
        "quote",
        "block quote",
        "intense quote",
        "block text",
        "цитата",
    ):
        return "blockquote", {}

    if style_name.startswith("list"):
        return "_listItem", {}

    return "paragraph", {}


def _extract_marks(run) -> list:
    marks = []

    if run.bold:
        marks.append({"type": "bold"})
    if run.italic:
        marks.append({"type": "italic"})
    u = run.underline
    if u and u is not False:
        marks.append({"type": "underline"})
    if run.font.strike:
        marks.append({"type": "strike"})

    try:
        if run.font.superscript:
            marks.append({"type": "superscript"})
    except AttributeError:
        pass
    try:
        if run.font.subscript:
            marks.append({"type": "subscript"})
    except AttributeError:
        pass

    try:
        highlight = run.font.highlight_color
        if highlight:
            color_value = (
                highlight if isinstance(highlight, int) else getattr(highlight, "value", None)
            )
            if color_value and color_value in HIGHLIGHT_COLOR_MAP:
                marks.append(
                    {
                        "type": "highlight",
                        "attrs": {"color": HIGHLIGHT_COLOR_MAP[color_value]},
                    }
                )
    except (AttributeError, TypeError, ValueError):
        pass

    style_attrs = {}

    try:
        if run.font.color and run.font.color.rgb:
            rgb = run.font.color.rgb
            style_attrs["color"] = f"#{rgb}"
    except (AttributeError, TypeError, ValueError):
        pass

    try:
        if run.font.size:
            size_pt = run.font.size.pt
            style_attrs["fontSize"] = f"{size_pt}px"
    except (AttributeError, TypeError, ValueError):
        pass

    if run.font.name:
        style_attrs["fontFamily"] = run.font.name

    if style_attrs:
        marks.append({"type": "textStyle", "attrs": style_attrs})

    return marks


def _get_paragraph_images(para, image_map: dict) -> list:
    images = []
    if not image_map:
        return images

    for drawing in para._element.findall(".//" + qn("a:blip")):
        embed_id = drawing.get(qn("r:embed"))
        if embed_id and embed_id in image_map:
            images.append(
                {
                    "type": "image",
                    "attrs": {
                        "src": image_map[embed_id],
                        "alt": "",
                    },
                }
            )

    return images


def _tc_colspan_val(tc) -> int:
    tc_pr = tc.find(qn("w:tcPr"))
    if tc_pr is None:
        return 1
    gs = tc_pr.find(qn("w:gridSpan"))
    if gs is None:
        return 1
    try:
        return max(int(gs.get(qn("w:val"), 1)), 1)
    except (TypeError, ValueError):
        return 1


def _tc_vmerge_kind(tc):
    tc_pr = tc.find(qn("w:tcPr"))
    if tc_pr is None:
        return None
    vm = tc_pr.find(qn("w:vMerge"))
    if vm is None:
        return None
    if vm.get(qn("w:val")) == "continue":
        return "continue"
    return "restart"


def _iter_row_tc_grid_starts(tr):
    col = 0
    for tc in tr.findall(qn("w:tc")):
        yield tc, col
        col += _tc_colspan_val(tc)


def _tc_at_grid_col(tr, target_col: int):
    for tc, c in _iter_row_tc_grid_starts(tr):
        cs = _tc_colspan_val(tc)
        if c <= target_col < c + cs:
            return tc
    return None


def _count_vmerge_span(trs, start_ri: int, start_col: int) -> int:
    if start_ri >= len(trs):
        return 1
    tr0 = trs[start_ri]
    tc0 = _tc_at_grid_col(tr0, start_col)
    if tc0 is None:
        return 1
    tc_pr = tc0.find(qn("w:tcPr"))
    vm = tc_pr.find(qn("w:vMerge")) if tc_pr is not None else None
    if vm is None:
        return 1
    if vm.get(qn("w:val")) == "continue":
        return 1
    count = 1
    for rj in range(start_ri + 1, len(trs)):
        tcj = _tc_at_grid_col(trs[rj], start_col)
        if tcj is None:
            break
        tc_prj = tcj.find(qn("w:tcPr"))
        vmj = tc_prj.find(qn("w:vMerge")) if tc_prj is not None else None
        if vmj is None:
            break
        if vmj.get(qn("w:val")) != "continue":
            break
        count += 1
    return count


def _tc_to_cell_content(tc, table: Table, image_map: dict) -> list:
    cell = _Cell(tc, table)
    cell_content = []
    for para in cell.paragraphs:
        for n in _paragraph_nodes(para, image_map):
            if n.get("type") == "heading":
                n = {**n, "type": "paragraph"}
            cell_content.append(n)
    return cell_content


def _table_to_node(table: Table, image_map: dict) -> dict:
    tbl = table._tbl
    trs = tbl.findall(qn("w:tr"))
    if not trs:
        return {"type": "table", "content": []}

    rows = []
    for ri, tr in enumerate(trs):
        cells = []
        for tc, col in _iter_row_tc_grid_starts(tr):
            if _tc_vmerge_kind(tc) == "continue":
                continue

            colspan = _tc_colspan_val(tc)
            rowspan = _count_vmerge_span(trs, ri, col)

            cell_content = _tc_to_cell_content(tc, table, image_map)
            cell_content = group_list_items(cell_content)
            if not cell_content:
                cell_content = [{"type": "paragraph"}]

            cell_node = {"type": "tableCell", "content": cell_content}
            attrs = {}
            if colspan > 1:
                attrs["colspan"] = colspan
            if rowspan > 1:
                attrs["rowspan"] = rowspan
            if attrs:
                cell_node["attrs"] = attrs
            cells.append(cell_node)

        rows.append({"type": "tableRow", "content": cells})

    return {"type": "table", "content": rows}


def _extract_images(doc, media_root: str, book_slug: str, chapter_slug: str) -> dict:
    image_map = {}
    images_dir = os.path.join(media_root, "books", book_slug, "chapters", "images")
    os.makedirs(images_dir, exist_ok=True)

    for rel_id, rel in doc.part.rels.items():
        if rel.reltype != RT.IMAGE:
            continue
        try:
            image_data = rel.target_part.blob
            content_type = rel.target_part.content_type
            ext = content_type.split("/")[-1]
            if ext == "jpeg":
                ext = "jpg"
            elif ext not in ("png", "gif", "webp", "svg+xml"):
                ext = "png"
            if ext == "svg+xml":
                ext = "svg"

            hash_suffix = hashlib.sha256(image_data).hexdigest()[:12]
            filename = f"{chapter_slug}_{hash_suffix}.{ext}"
            filepath = os.path.join(images_dir, filename)

            with open(filepath, "wb") as f:
                f.write(image_data)

            url = f"/media/books/{book_slug}/chapters/images/{filename}"
            image_map[rel_id] = url
        except Exception:
            continue

    return image_map

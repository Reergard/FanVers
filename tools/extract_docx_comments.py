import argparse
import re
import zipfile
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET


NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1]


def _parse_comments(comments_xml: bytes) -> dict[str, dict[str, str | None]]:
    root = ET.fromstring(comments_xml)
    out: dict[str, dict[str, str | None]] = {}
    for c in root.findall(f".//{{{NS_W}}}comment"):
        cid = c.attrib.get(f"{{{NS_W}}}id")
        if cid is None:
            continue
        author = c.attrib.get(f"{{{NS_W}}}author")
        date = c.attrib.get(f"{{{NS_W}}}date")
        texts: list[str] = []
        for t in c.findall(f".//{{{NS_W}}}t"):
            if t.text:
                texts.append(t.text)
        out[cid] = {"author": author, "date": date, "text": "".join(texts).strip()}
    return out


def _parse_document_text_with_markers(document_xml: bytes) -> list[str]:
    root = ET.fromstring(document_xml)
    paras_out: list[str] = []
    active: list[str] = []

    for p in root.findall(f".//{{{NS_W}}}p"):
        chunks: list[str] = []
        for node in p.iter():
            tag = _strip_ns(node.tag)
            if tag == "commentRangeStart":
                cid = node.attrib.get(f"{{{NS_W}}}id")
                if cid is not None and cid not in active:
                    active.append(cid)
            elif tag == "commentRangeEnd":
                cid = node.attrib.get(f"{{{NS_W}}}id")
                if cid in active:
                    active.remove(cid)
            elif tag == "t":
                if node.text:
                    txt = node.text
                    if active:
                        txt = f"{txt}[[c:{','.join(active)}]]"
                    chunks.append(txt)

        para = "".join(chunks)
        para = re.sub(r"\s+", " ", para).strip()
        if para:
            paras_out.append(para)

    return paras_out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docx", required=True, help="Path to .docx file")
    ap.add_argument("--out", required=True, help="Path to output .md file")
    args = ap.parse_args()

    docx_path = Path(args.docx)
    out_path = Path(args.out)

    if not docx_path.exists():
        raise SystemExit(f"DOCX not found: {docx_path}")

    with zipfile.ZipFile(docx_path) as z:
        names = set(z.namelist())
        document_xml = z.read("word/document.xml")
        comments_xml = z.read("word/comments.xml") if "word/comments.xml" in names else None

    comments = _parse_comments(comments_xml) if comments_xml else {}
    paras_out = _parse_document_text_with_markers(document_xml)

    lines: list[str] = []
    lines.append("# DOCX extract: 3_audit_with_comments")
    lines.append("")
    lines.append(f"- Source: `{docx_path}`")
    lines.append(f"- Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append("## Document text (inline comment markers like `[[c:12]]`)")
    lines.append("")
    for para in paras_out:
        lines.append(para)
        lines.append("")

    lines.append("## Comments")
    lines.append("")
    if comments:
        def _comment_sort_key(cid: str):
            return (0, int(cid)) if cid.isdigit() else (1, cid)

        for cid in sorted(comments.keys(), key=_comment_sort_key):
            c = comments[cid]
            meta = " — ".join([x for x in [c.get("author"), c.get("date")] if x])
            meta_s = f" ({meta})" if meta else ""
            lines.append(f"- **c:{cid}**{meta_s}: {(c.get('text') or '').strip()}")
    else:
        lines.append("(No `word/comments.xml` found in this DOCX.)")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {out_path}")
    print(f"Paragraphs: {len(paras_out)} | Comments: {len(comments)}")


if __name__ == "__main__":
    main()


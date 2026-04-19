"""
Конвертация SVG-обёрнутых PNG в AVIF/WebP/PNG с ресайзом.

Источники:
  - src/main/assets/backgrounds/NewBook.svg (12.2 MB, внутри PNG 4096x2296)
  - src/assets/backgrounds/mobile_home_bg.svg (1.6 MB, PNG + blur-прямоугольники)

Цели:
  - src/main/assets/backgrounds/NewBook.{avif,webp,png} — 2084x1396 (2x display)
  - src/assets/backgrounds/mobile_home_bg-{480,768,1080}.{avif,webp,png}
"""
import base64
import io
import re
import os
import sys
from pathlib import Path

import pillow_avif  # noqa: F401 — активирует AVIF плагин
from PIL import Image
import resvg_py

ROOT = Path(__file__).resolve().parent.parent  # frontend/
NEWBOOK_SVG = ROOT / "src" / "main" / "assets" / "backgrounds" / "NewBook.svg"
MOBILE_SVG = ROOT / "src" / "assets" / "backgrounds" / "mobile_home_bg.svg"

NEWBOOK_OUT_DIR = NEWBOOK_SVG.parent
MOBILE_OUT_DIR = MOBILE_SVG.parent

NEWBOOK_BASE = "NewBook"           # итог: NewBook-{WIDTH}.{avif,webp,png}
MOBILE_BASE = "mobile_home_bg"     # итог: mobile_home_bg-{WIDTH}.{avif,webp,png}

# Ширины для NewBook (отображается 1042px на десктопе).
# 2084 = 2x retina, 3126 = 3x retina / 4K экран.
NEWBOOK_WIDTHS = [2084, 3126]

# Ширины для мобильного фона. На retina-телефоне с DPR=3 и шириной 400 CSS px
# реальный размер после CSS-увеличения (608/430) = ~1700px. Нужны варианты
# достаточно крупные для retina-мобилок и retina-планшетов.
MOBILE_WIDTHS = [608, 1216, 1824, 2432]

# Качество (чуть выше дефолта — для критичного визуала)
AVIF_Q = 85
WEBP_Q = 92


def extract_embedded_png(svg_path: Path) -> Image.Image:
    """Извлекает первый base64-PNG из <image xlink:href='data:image/png;base64,...' />."""
    text = svg_path.read_text(encoding="utf-8")
    m = re.search(r"data:image/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)", text)
    if not m:
        raise RuntimeError(f"Base64 image not found in {svg_path}")
    data = base64.b64decode(m.group(1))
    return Image.open(io.BytesIO(data)).convert("RGBA")


def rasterize_svg(svg_path: Path, width: int) -> Image.Image:
    """Рендерит SVG целиком в PNG заданной ширины с сохранением аспекта."""
    png_bytes = resvg_py.svg_to_bytes(svg_path=str(svg_path), width=width)
    return Image.open(io.BytesIO(bytes(png_bytes))).convert("RGBA")


def save_all_formats(img: Image.Image, out_dir: Path, base_name: str,
                     avif_q: int = AVIF_Q, webp_q: int = WEBP_Q) -> dict:
    """Сохраняет AVIF, WebP, PNG. Возвращает {формат: размер в байтах}."""
    out_dir.mkdir(parents=True, exist_ok=True)
    sizes = {}

    # PNG (fallback, оптимизированный)
    png_path = out_dir / f"{base_name}.png"
    img.save(png_path, "PNG", optimize=True)
    sizes["png"] = png_path.stat().st_size

    # WebP (качественный, с прозрачностью)
    webp_path = out_dir / f"{base_name}.webp"
    img.save(webp_path, "WEBP", quality=webp_q, method=6)
    sizes["webp"] = webp_path.stat().st_size

    # AVIF (самое сильное сжатие)
    avif_path = out_dir / f"{base_name}.avif"
    img.save(avif_path, "AVIF", quality=avif_q)
    sizes["avif"] = avif_path.stat().st_size

    return sizes


def format_size(n: int) -> str:
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def main():
    print("=" * 60)
    print(f"1/2: NewBook.svg -> NewBook-{{{','.join(str(w) for w in NEWBOOK_WIDTHS)}}}.{{avif,webp,png}}")
    print("=" * 60)
    src_size = NEWBOOK_SVG.stat().st_size
    print(f"  source: {format_size(src_size)}")

    # Растеризуем ВСЮ SVG через resvg — это автоматически применит viewBox crop.
    # Raw PNG внутри 4096x2296, но visible area в viewBox 1424x941 (ratio 1.513).
    for width in NEWBOOK_WIDTHS:
        print(f"  rasterizing @ {width}px wide...")
        img = rasterize_svg(NEWBOOK_SVG, width)
        print(f"    actual size: {img.size}")
        sizes = save_all_formats(img, NEWBOOK_OUT_DIR, f"{NEWBOOK_BASE}-{width}")
        for fmt, n in sizes.items():
            pct = 100 * n / src_size
            print(f"      {fmt}: {format_size(n)} ({pct:.1f}% of SVG)")

    print()
    print("=" * 60)
    print(f"2/2: mobile_home_bg.svg -> mobile_home_bg-{{{','.join(str(w) for w in MOBILE_WIDTHS)}}}.{{avif,webp,png}}")
    print("=" * 60)
    src_size = MOBILE_SVG.stat().st_size
    print(f"  source: {format_size(src_size)}")

    for width in MOBILE_WIDTHS:
        print(f"  rasterizing @ {width}px wide...")
        img = rasterize_svg(MOBILE_SVG, width)
        print(f"    actual size: {img.size}")
        sizes = save_all_formats(img, MOBILE_OUT_DIR, f"{MOBILE_BASE}-{width}")
        for fmt, n in sizes.items():
            print(f"      {fmt}: {format_size(n)}")

    print()
    print("Done.")


if __name__ == "__main__":
    main()

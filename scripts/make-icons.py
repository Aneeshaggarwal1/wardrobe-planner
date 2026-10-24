"""Generates the PWA icons in public/icons: a navy tile with a cream shirt mark.

    python3 scripts/make-icons.py     (needs Pillow: pip install pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
NAVY = (20, 33, 61)
CREAM = (246, 244, 239)
BRASS = (184, 146, 90)

# Shirt outline on a 240-unit grid (same shape as the demo garments).
SHIRT = [(70, 28), (100, 18), (120, 30), (140, 18), (170, 28), (214, 66), (194, 100), (172, 86),
         (172, 222), (68, 222), (68, 86), (46, 100), (26, 66)]


def icon(size: int, inset: float, rounded: bool) -> Image.Image:
    scale = 4  # draw large, then downsample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=NAVY)
    else:
        d.rectangle((0, 0, s, s), fill=NAVY)
    box = s * (1 - 2 * inset)
    off = s * inset
    pts = [(off + x / 240 * box, off + y / 240 * box) for x, y in SHIRT]
    d.polygon(pts, fill=CREAM)
    collar = [(100, 18), (112, 46), (120, 34), (128, 46), (140, 18)]
    d.line([(off + x / 240 * box, off + y / 240 * box) for x, y in collar], fill=NAVY, width=int(s * 0.018))
    cx = off + 120 / 240 * box
    for y in (70, 110, 150, 190):
        r = s * 0.012
        cy = off + y / 240 * box
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BRASS)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, 0.16, True).save(OUT / "icon-192.png")
    icon(512, 0.16, True).save(OUT / "icon-512.png")
    icon(512, 0.24, False).save(OUT / "icon-maskable-512.png")  # safe zone for Android masks
    icon(180, 0.16, False).convert("RGB").save(OUT / "apple-touch-icon.png")
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Crop all images in ./src to 16:9 aspect ratio at 400, 800, and 1200px widths.
Usage: python compress.py
"""

from pathlib import Path
from PIL import Image

SIZES = [400, 800, 1200]
ASPECT = (16, 9)

SRC_DIR = Path(__file__).parent / "src"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# Optimization options
QUALITY = 90       # JPEG quality (1–95)
OPTIMIZE = True    # Extra compression pass (slower, smaller file)
RESAMPLE = Image.LANCZOS  # Resampling filter: LANCZOS, BICUBIC, BILINEAR

FORMATS = [
    ("webp", {"quality": QUALITY, "method": 6}),
    # ("avif", {"quality": QUALITY}),
]


def crop_to_aspect(img: Image.Image, width: int, height: int) -> Image.Image:
    """Center-crop image to target aspect ratio, then resize."""
    src_w, src_h = img.size
    target_ratio = width / height
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Image is wider than target — crop sides
        new_w = int(src_h * target_ratio)
        offset = (src_w - new_w) // 2
        box = (offset, 0, offset + new_w, src_h)
    else:
        # Image is taller than target — crop top/bottom
        new_h = int(src_w / target_ratio)
        offset = (src_h - new_h) // 2
        box = (0, offset, src_w, offset + new_h)

    return img.crop(box).resize((width, height), RESAMPLE)

def process(src: Path) -> None:
    img = Image.open(src).convert("RGB")
    ratio_h = ASPECT[1]
    ratio_w = ASPECT[0]

    for w in SIZES:
        h = w * ratio_h // ratio_w
        cropped = crop_to_aspect(img, w, h)
        out_dir = src.parent.parent / str(w)
        out_dir.mkdir(exist_ok=True)

        out = out_dir / f"{src.stem}{src.suffix}"
        # out = out_dir / f"{src.stem}_{w}x{h}{src.suffix}"
        cropped.save(out, quality=QUALITY, optimize=OPTIMIZE)
        print(f"Saved: {out}")

        for fmt, save_opts in FORMATS:
            out_fmt = out_dir / f"{src.stem}.{fmt}"
            # out_fmt = out_dir / f"{src.stem}_{w}x{h}.{fmt}"
            cropped.save(out_fmt, **save_opts)
            print(f"Saved: {out_fmt}")


def main():
    if not SRC_DIR.exists():
        print(f"Source folder not found: {SRC_DIR}")
        return

    images = [p for p in SRC_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    if not images:
        print("No images found in src/")
        return

    for src in images:
        print(f"Processing: {src.name}")
        process(src)


if __name__ == "__main__":
    main()
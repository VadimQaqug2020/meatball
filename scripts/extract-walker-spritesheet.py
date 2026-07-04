#!/usr/bin/env python3
"""Extract walker animation frames from the front-view walk sprite sheet."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


CURSOR_SHEET = Path(
    "/Users/usr01/.cursor/projects/Users-usr01-Projects-tyshchenko-tomato-game/assets/image-10ebf6cd-1d45-47b7-9011-1814e6bf2bc8.png"
)


def is_background(red: int, green: int, blue: int, alpha: int) -> bool:
    return alpha < 128 or (red >= 228 and green >= 228 and blue >= 228)


def detect_regions(image: Image.Image) -> list[tuple[int, int, int, int]]:
    width, height = image.size
    pixels = image.load()

    row_density = [
        sum(1 for x in range(width) if not is_background(*pixels[x, y]))
        for y in range(height)
    ]

    row_bands: list[tuple[int, int]] = []
    in_band = False
    start = 0
    for y, count in enumerate(row_density):
        if count > 20 and not in_band:
            start = y
            in_band = True
        elif count <= 20 and in_band:
            row_bands.append((start, y))
            in_band = False
    if in_band:
        row_bands.append((start, height))

    regions: list[tuple[int, int, int, int]] = []
    for y0, y1 in row_bands:
        col_density = [
            sum(1 for y in range(y0, y1) if not is_background(*pixels[x, y]))
            for x in range(width)
        ]
        in_col = False
        col_start = 0
        min_width = 40
        min_height = 40
        for x, count in enumerate(col_density):
            if count > 5 and not in_col:
                col_start = x
                in_col = True
            elif count <= 5 and in_col:
                if x - col_start >= min_width and (y1 - y0) >= min_height:
                    regions.append((col_start, y0, x, y1))
                in_col = False
        if in_col and width - col_start >= min_width and (y1 - y0) >= min_height:
            regions.append((col_start, y0, width, y1))

    return sorted(regions, key=lambda box: (box[1], box[0]))


def crop_region(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = box
    cropped = image.crop((x0, y0, x1, y1)).convert("RGBA")
    pixels = cropped.load()
    width, height = cropped.size

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if is_background(red, green, blue, alpha):
                pixels[x, y] = (0, 0, 0, 0)

    return cropped


def normalize_frames(frames: list[Image.Image]) -> list[Image.Image]:
    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    normalized: list[Image.Image] = []

    for frame in frames:
        canvas = Image.new("RGBA", (max_width, max_height), (0, 0, 0, 0))
        x = (max_width - frame.width) // 2
        y = max_height - frame.height
        canvas.paste(frame, (x, y), frame)
        normalized.append(canvas)

    return normalized


def main() -> int:
    project_dir = Path(__file__).resolve().parents[1]
    assets_dir = project_dir / "assets"
    sheet_path = assets_dir / "walker-sheet.png"

    if not sheet_path.exists() and CURSOR_SHEET.exists():
        Image.open(CURSOR_SHEET).save(sheet_path)

    if not sheet_path.exists():
        print(f"missing sprite sheet: {sheet_path}", file=sys.stderr)
        return 1

    for old_frame in assets_dir.glob("walker-[0-9][0-9].png"):
        old_frame.unlink()

    image = Image.open(sheet_path).convert("RGBA")
    regions = detect_regions(image)
    if len(regions) != 5:
        print(f"expected 5 frames, found {len(regions)}", file=sys.stderr)
        return 1

    frames = normalize_frames([crop_region(image, region) for region in regions])

    for index, frame in enumerate(frames, start=1):
        output_path = assets_dir / f"walker-{index:02d}.png"
        frame.save(output_path, "PNG")
        print(f"saved {output_path.name} ({frame.width}x{frame.height})")

    print(f"total frames: {len(frames)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

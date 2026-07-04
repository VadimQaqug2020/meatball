#!/usr/bin/env python3
"""Remove baked-in backgrounds from game PNG cutouts."""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image


def is_office_checker(r: int, g: int, b: int) -> bool:
    if max(r, g, b) - min(r, g, b) > 8:
        return False
    avg = (r + g + b) / 3
    return (72 <= avg <= 80) or (108 <= avg <= 116)


def is_throw_checker(r: int, g: int, b: int) -> bool:
    if max(r, g, b) - min(r, g, b) > 8:
        return False
    avg = (r + g + b) / 3
    return (14 <= avg <= 35) or (44 <= avg <= 66)


def is_studio_bg(r: int, g: int, b: int) -> bool:
    if max(r, g, b) - min(r, g, b) > 18:
        return False
    avg = (r + g + b) / 3
    return avg <= 48 or 95 <= avg <= 165


def remove_flat(path: Path, predicate) -> tuple[int, int]:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    removed = 0

    for y in range(height):
        for x in range(width):
            red, green, blue, _alpha = pixels[x, y]
            if predicate(red, green, blue):
                pixels[x, y] = (0, 0, 0, 0)
                removed += 1

    image.save(path, "PNG")
    return removed, width * height


def is_meatball_checker(r: int, g: int, b: int) -> bool:
    if max(r, g, b) - min(r, g, b) > 14:
        return False
    avg = (r + g + b) / 3
    return avg >= 218 or (34 <= avg <= 46) or (74 <= avg <= 88)


def remove_flood_simple(path: Path, predicate) -> tuple[int, int]:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    bg = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if predicate(*pixels[x, y][:3]) and not bg[y][x]:
            bg[y][x] = True
            queue.append((x, y))

    for x in range(width):
        try_seed(x, 0)
        try_seed(x, height - 1)
    for y in range(height):
        try_seed(0, y)
        try_seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not bg[ny][nx]:
                if predicate(*pixels[nx, ny][:3]):
                    bg[ny][nx] = True
                    queue.append((nx, ny))

    removed = 0
    for y in range(height):
        for x in range(width):
            if bg[y][x]:
                pixels[x, y] = (0, 0, 0, 0)
                removed += 1

    image.save(path, "PNG")
    return removed, width * height


def remove_flood(path: Path, predicate) -> tuple[int, int]:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    bg = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if predicate(*pixels[x, y][:3]) and not bg[y][x]:
            bg[y][x] = True
            queue.append((x, y))

    for x in range(width):
        try_seed(x, 0)
        try_seed(x, height - 1)
    for y in range(height):
        try_seed(0, y)
        try_seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not bg[ny][nx]:
                if predicate(*pixels[nx, ny][:3]):
                    bg[ny][nx] = True
                    queue.append((nx, ny))

    removed = 0
    for y in range(height):
        for x in range(width):
            if bg[y][x]:
                pixels[x, y] = (0, 0, 0, 0)
                removed += 1

    removed += remove_temshchyk_floor(pixels, width, height)

    image.save(path, "PNG")
    return removed, width * height


def is_floor_pixel(red: int, green: int, blue: int) -> bool:
    if max(red, green, blue) - min(red, green, blue) > 28:
        return False
    avg = (red + green + blue) / 3
    return 125 <= avg <= 215


def remove_temshchyk_floor(pixels, width: int, height: int) -> int:
    removed = 0
    floor_start = int(height * 0.74)

    for y in range(floor_start, height):
        row_count = 0
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            if is_floor_pixel(red, green, blue):
                row_count += 1

        if row_count > width * 0.12:
            for x in range(width):
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    continue
                if is_floor_pixel(red, green, blue):
                    pixels[x, y] = (0, 0, 0, 0)
                    removed += 1
            continue

        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            if is_floor_pixel(red, green, blue):
                pixels[x, y] = (0, 0, 0, 0)
                removed += 1

    shadow_start = int(height * 0.28)
    shadow_floor = int(height * 0.74)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        red, green, blue, alpha = pixels[x, shadow_floor]
        if alpha == 0 or is_floor_pixel(red, green, blue):
            queue.append((x, shadow_floor))

    seen = set(queue)
    while queue:
        x, y = queue.popleft()
        red, green, blue, alpha = pixels[x, y]
        if alpha == 0:
            continue
        if not is_floor_pixel(red, green, blue):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        removed += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if shadow_start <= ny < shadow_floor and (nx, ny) not in seen:
                seen.add((nx, ny))
                queue.append((nx, ny))

    return removed


def main() -> int:
    assets_dir = Path(__file__).resolve().parents[1] / "assets"
    jobs = [
        ("flat", is_office_checker, ["office-iqos.png", "office-stand.png"]),
        ("flat", is_throw_checker, [f"throw-{index}.png" for index in range(1, 6)]),
        ("flood", is_studio_bg, [f"temshchyk-{index}.png" for index in range(1, 6)]),
        ("flood_simple", is_meatball_checker, ["meatball.png"]),
    ]

    for mode, predicate, files in jobs:
        for filename in files:
            path = assets_dir / filename
            if not path.exists():
                print(f"skip missing: {path.name}")
                continue
            if mode == "flood":
                removed, total = remove_flood(path, predicate)
            elif mode == "flood_simple":
                removed, total = remove_flood_simple(path, predicate)
            else:
                removed, total = remove_flat(path, predicate)
            percent = 100 * removed / total if total else 0
            print(f"{path.name}: removed {removed}/{total} px ({percent:.1f}%)")

    return 0


if __name__ == "__main__":
    sys.exit(main())

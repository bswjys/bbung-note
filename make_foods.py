#!/usr/bin/env python3
"""한국 음식·과일 그림 아이콘 만들기

images CLI로 만든 4×4 그리드 시트 2장(.dev/foods/sheet_a.png, sheet_b.png)을
16칸씩 정확히 잘라 원형 알파가 있는 128×128 WebP로 foods/ 에 저장합니다.

    python3 make_foods.py

그리드 순서(행 우선)는 아래 SHEETS 목록 그대로예요. 시트를 새로 만들 때는
같은 순서로 프롬프트를 주고 SHEETS만 고치면 됩니다.
"""
import os

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, ".dev", "foods")
OUT = os.path.join(BASE, "foods")
SIZE = 128
INSET = 0.022  # 칸 경계의 얇은 베이지 선을 지우려고 살짝 안쪽으로 자릅니다

SHEETS = [
    ("sheet_a.png", [
        "chamoe", "jadu", "gam", "muhwagwa",
        "seongnyu", "salgu", "daechu", "maesil",
        "oi", "aehobak", "kongnamul", "sigeumchi",
        "dubu", "gim", "eomuk", "godeungeo",
    ]),
    ("sheet_b.png", [
        "kimchi-jjigae", "doenjang-jjigae", "miyeokguk", "sundaeguk",
        "gimbap", "tteokbokki", "tteokguk", "samgyeopsal",
        "bibimbap", "naengmyeon", "jjajangmyeon", "kalguksu",
        "buchimgae", "gyeranmari", "japchae", "galbijjim",
    ]),
]


def circle_mask(size, supersample=4):
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    mask = circle_mask(SIZE)
    made = []
    for sheet, names in SHEETS:
        path = os.path.join(SRC, sheet)
        with Image.open(path) as im:
            rgb = im.convert("RGB")
        w, h = rgb.size
        cw, ch = w / 4, h / 4
        ix, iy = cw * INSET, ch * INSET
        for idx, slug in enumerate(names):
            row, col = divmod(idx, 4)
            box = (
                round(col * cw + ix), round(row * ch + iy),
                round((col + 1) * cw - ix), round((row + 1) * ch - iy),
            )
            cell = rgb.crop(box)
            side = min(cell.size)
            left = (cell.width - side) // 2
            top = (cell.height - side) // 2
            cell = cell.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
            cell.putalpha(mask)
            out = os.path.join(OUT, f"{slug}.webp")
            cell.save(out, "WEBP", quality=90, method=6)
            made.append((slug, os.path.getsize(out)))
    total = sum(s for _, s in made)
    print(f"{len(made)}개 아이콘 · {SIZE}×{SIZE} · 합계 {total / 1024:.1f}KB")
    for slug, size in made:
        print(f"  foods/{slug}.webp  {size / 1024:.1f}KB")


if __name__ == "__main__":
    main()

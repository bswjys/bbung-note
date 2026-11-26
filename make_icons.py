#!/usr/bin/env python3
"""뿡뿡이 기록 아이콘 생성기 (v2).

character.svg(귀여운 방귀 캐릭터)를 바탕으로
  · icon.svg / icon-maskable.svg  — 앱 아이콘용 SVG(배경 + 캐릭터)
  · icon-512.png / icon-192.png / apple-touch-icon.png / icon-maskable-512.png
를 만든다.

    LD_LIBRARY_PATH=/workspace/.browserlibs/lib python3 make_icons.py
"""
import os
import re

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 512

ICON_TMPL = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="ic-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFAF2"/>
      <stop offset=".55" stop-color="#FFF3E6"/>
      <stop offset="1" stop-color="#FFE9F0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="{radius}" fill="url(#ic-bg)"/>
  <circle cx="104" cy="92" r="66" fill="#FFE3CF" opacity=".55"/>
  <circle cx="452" cy="452" r="74" fill="#DDF3E7" opacity=".55"/>
  <circle cx="430" cy="96" r="26" fill="#ECE4FB" opacity=".65"/>
  <g transform="translate({tx} {ty}) scale({scale})">
{character}
  </g>
</svg>
"""

JOBS = [
    ("icon.svg", [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]),
    ("icon-maskable.svg", [(512, "icon-maskable-512.png")]),
]


def character_body():
    raw = open(os.path.join(HERE, "character.svg"), encoding="utf-8").read()
    body = re.sub(r"^.*?<svg[^>]*>", "", raw, flags=re.S)
    body = body.replace("</svg>", "").strip()
    # 아이콘 안에서는 그림자가 배경에 묻히므로 그대로 두되 id 충돌만 피한다
    return re.sub(r"^", "", body)


def write_icon(name, scale, tx, ty, radius):
    svg = ICON_TMPL.format(character=character_body(), scale=scale, tx=tx, ty=ty, radius=radius)
    with open(os.path.join(HERE, name), "w", encoding="utf-8") as fh:
        fh.write(svg)
    print("wrote", name)


def render(page, svg_name, out_path):
    page.set_viewport_size({"width": SIZE, "height": SIZE})
    page.goto("file://" + os.path.join(HERE, svg_name))
    page.screenshot(path=out_path, clip={"x": 0, "y": 0, "width": SIZE, "height": SIZE})


def main():
    # 일반 아이콘: 둥근 모서리 + 캐릭터를 크게
    write_icon("icon.svg", scale=0.90, tx=26, ty=34, radius=112)
    # 마스커블: 전체 배경 + 안전 영역(80%) 안에 캐릭터
    write_icon("icon-maskable.svg", scale=0.80, tx=48, ty=60, radius=0)

    os.makedirs(os.path.join(HERE, ".dev"), exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(device_scale_factor=1)
        for svg_name, targets in JOBS:
            master = os.path.join(HERE, ".dev", "_master_" + svg_name.replace(".svg", ".png"))
            render(page, svg_name, master)
            img = Image.open(master).convert("RGB")
            for px, name in targets:
                img.resize((px, px), Image.LANCZOS).save(os.path.join(HERE, name), "PNG", optimize=True)
                print("saved", name, px)
            os.remove(master)
        browser.close()


if __name__ == "__main__":
    main()

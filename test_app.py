#!/usr/bin/env python3
"""뿡뿡이 기록 v3 · 자동 검증

    LD_LIBRARY_PATH=/workspace/.browserlibs/lib python3 test_app.py

v3에서 바뀐 점
  · 음식 사전 387종으로 대폭 확장 + 비슷한 말(별명) 사전 → 샤인머스캣·한라봉·청양고추·어묵탕도 알아서 매칭
  · 이모지에 없던 한국 음식·과일 32종 전용 그림(foods/*.webp, 128×128 원형) — 미리보기·표 칩·상세·뿡밍아웃 카드 전부
  · 상세 시트 '음식 그림 바꾸기'에 한국 음식 그림 32개 + 이모지가 함께 (직접 골라 바꾸기)
  · sw.js bbung-note-v3 · foods 프리캐시

검증 항목
  · PWA 자원(manifest·sw v3·아이콘·사진)과 첫 화면
  · 가족 4명 사진 로드(깨진 이미지 0) · 선택 시 사진/이름 동기화
  · 브랜드 클릭 → 기록하기 복귀
  · 오늘/7일/전체 필터 없음 · 어제 기록도 바로 보이는 누적 표
  · 음식 입력 → 원형 미리보기 실시간 매칭 (그림/이모지)
  · 4단계 저장 · 저장 버튼 · 같은 음식 중복 방지(단계만 이동, 메모 보존)
  · 칩 클릭 → 방귀 소리(Web Audio) + 상세 시트 · 메모 · 단계 변경 · 삭제
  · 뿡밍아웃 PNG 카드(1080×1350) · 이미지 저장(데스크톱 내려받기 / 아이폰 공유 시트) · 공유하기
  · 가족 실시간 공유(Firebase) — 실제 테스트 방으로 쓰기/읽기 확인 후 정리
  · 한국 음식 그림 32종 제공·매칭·칩·상세·카드 · 모바일 390 / 데스크톱 1280 가로 넘침 0 · 콘솔 오류 0
  · 스크린샷 downloads/bbung_note/01~12
"""
import asyncio
import base64
import json
import os
import random
import socket
import string
import sys
import threading
import urllib.request
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image
from playwright.async_api import async_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(os.path.dirname(os.path.dirname(BASE)), "downloads", "bbung_note")
FB = "https://baby-feeding-9f820-default-rtdb.asia-southeast1.firebasedatabase.app"
TODAY = datetime.now().strftime("%Y-%m-%d")

FAMILY = [("mom", "엄마"), ("dad", "아빠"), ("sarang", "사랑"), ("harang", "하랑")]

# 아이폰처럼 navigator.share 파일 공유가 되는 브라우저 흉내
SHARE_MOCK = """
window.__shares = [];
Object.defineProperty(navigator, 'canShare', {
  configurable: true,
  value: (data) => !!(data && data.files && data.files.length),
});
Object.defineProperty(navigator, 'share', {
  configurable: true,
  value: async (data) => {
    window.__shares.push({
      title: data && data.title,
      text: data && data.text,
      files: Array.from((data && data.files) || []).map((f) => ({ name: f.name, size: f.size, type: f.type })),
    });
  },
});
"""

PASS = []
FAIL = []
WARN = []
ERRORS = []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  ✓ {name}")
    else:
        FAIL.append(f"{name} — {detail}")
        print(f"  ✗ {name} — {detail}")


def warn(name, detail=""):
    WARN.append(f"{name} — {detail}")
    print(f"  ! {name} — {detail}")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    handler = lambda *a, **kw: QuietHandler(*a, directory=BASE, **kw)
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


def http_json(method, url, body=None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw else None


async def new_page(browser, width=390, height=844, seed=None, who=None, url_suffix="", init_script=None):
    ctx = await browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        accept_downloads=True,
        locale="ko-KR",
    )
    page = await ctx.new_page()
    page.on("console", lambda m: ERRORS.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: ERRORS.append(f"[pageerror] {e}"))
    if seed is not None or who:
        script = ""
        if who:
            script += f"localStorage.setItem('bbung.who.v1', {json.dumps(who)});"
        if seed is not None:
            script += f"localStorage.setItem('bbung.v1', {json.dumps(json.dumps({'records': seed}))});"
        await page.add_init_script(script)
    if init_script:
        await page.add_init_script(init_script)
    return ctx, page


async def goto(page, port, suffix=""):
    await page.goto(f"http://127.0.0.1:{port}/index.html{suffix}", wait_until="networkidle")
    await page.wait_for_function("document.documentElement.dataset.ready === '1'")


def seed_records():
    now = datetime.now().astimezone()
    iso = now.isoformat(timespec="seconds")
    ms = int(now.timestamp() * 1000)
    demo = [
        ("양파", "🧅", "peach", "triple", "양파 반 개까지는 괜찮았음", 0),
        ("김치", "🥬", "rose", "triple", "", 1),
        ("사과", "🍎", "rose", "double", "오후에 반 개", 2),
        ("마늘", "🧄", "peach", "double", "", 3),
        ("우유", "🥛", "sky", "single", "", 4),
        ("고구마", "🍠", "peach", "single", "", 5),
        ("쌀밥", "🍚", "butter", "calm", "", 6),
        ("두유", "🥛", "mint", "calm", "아침에 따뜻하게", 7),
    ]
    out = []
    for i, (food, emoji, tone, stage, note, minute) in enumerate(demo):
        out.append({
            "id": f"seed{i}",
            "who": "mom",
            "food": food,
            "emoji": emoji,
            "tone": tone,
            "cat": "gas" if stage in ("triple", "double") else "gentle",
            "stage": stage,
            "note": note,
            "at": iso,
            "updatedAt": ms + i,
            "minute": minute,
        })
    return out


async def board_chip_count(page, selector):
    return await page.locator(selector).count()


async def open_share_card(page):
    await page.click("#shareCardBtn")
    await page.wait_for_function(
        "(() => { const i = document.getElementById('shareImg'); return i && i.naturalWidth > 0; })()",
        timeout=15000,
    )


async def run():
    os.makedirs(SHOTS, exist_ok=True)
    srv, port = start_server()
    room = "TEST" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    room_url = f"{FB}/bbung_rooms/{room}.json"
    print(f"· 검증 서버 http://127.0.0.1:{port} · 테스트 방 {room}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx, page = await new_page(browser)
        await goto(page, port)

        # ── 1. 첫 화면 · PWA · 새 아이콘 ──
        print("\n[1] 첫 화면 · PWA · 방귀 캐릭터 아이콘")
        check("앱 제목", "뿡뿡이 기록" in (await page.title()))
        check("브랜드 표시", "뿡뿡이 기록" in (await page.inner_text(".brand-text")))
        check("브랜드는 누를 수 있는 버튼", await page.evaluate("document.getElementById('brandHome').tagName") == "BUTTON")
        check("브랜드 마크 = 캐릭터 그림",
              await page.evaluate("document.querySelector('.brand-mark img').getAttribute('src')") == "./character.svg")
        check("브랜드 캐릭터 로드", await page.evaluate("document.querySelector('.brand-mark img').naturalWidth") > 0)
        check("기본 가족은 엄마", "엄마" in (await page.inner_text(".fam[aria-selected='true']")))
        check("가족 탭 4명", await page.locator(".fam").count() == 4)
        check("하단 탭 2개", await page.locator(".tabbar .tab").count() == 2)
        check("음식 사전 100종 이상", await page.evaluate("window.__bbung.foods") >= 100,
              f"{await page.evaluate('window.__bbung.foods')}종")

        # 가족 4명 실제 사진
        fam_imgs = await page.evaluate("""Array.from(document.querySelectorAll('.fam')).map((b) => {
            const im = b.querySelector('img');
            return { who: b.dataset.who, src: im && im.getAttribute('src'), w: im ? im.naturalWidth : 0, h: im ? im.naturalHeight : 0 };
        })""")
        check("가족 탭 4명 모두 사진", len(fam_imgs) == 4 and all(i["w"] > 0 for i in fam_imgs), str(fam_imgs))
        check("사진 파일 이름", [os.path.basename(i["src"]) for i in fam_imgs] ==
              ["mom.jpg", "dad.jpg", "sarang.jpg", "harang.jpg"], str([i["src"] for i in fam_imgs]))
        check("사진은 160px 이하 정사각", all(0 < i["w"] <= 160 and i["w"] == i["h"] for i in fam_imgs), str(fam_imgs))
        check("기록하기 오른쪽 큰 사진", await page.evaluate("document.getElementById('helloPhoto').naturalWidth") > 0)
        check("큰 사진도 현재 가족 사진",
              (await page.get_attribute("#helloPhoto", "src")) == "./photos/mom.jpg")
        broken = await page.evaluate("Array.from(document.images).filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map((i) => i.src)")
        check("깨진 이미지 0", len(broken) == 0, str(broken))

        manifest = await page.evaluate("fetch('./manifest.webmanifest').then(r => r.json())")
        check("manifest 이름", manifest.get("short_name") == "뿡뿡이 기록", str(manifest.get("short_name")))
        check("manifest 아이콘 3종", len(manifest.get("icons", [])) == 3)
        sw = await page.evaluate("fetch('./sw.js').then(r => r.text())")
        check("sw 캐시 이름 bbung-note-v5", "bbung-note-v5" in sw)
        check("sw에 사진·캐릭터 캐시", "photos/harang.jpg" in sw and "character.svg" in sw)
        check("sw에 음식 그림 프리캐시", "foods/chamoe.webp" in sw and "foods/kimchi-jjigae.webp" in sw)
        html = await page.evaluate("fetch('./index.html').then(r => r.text())")
        check("index ?v=5", "styles.css?v=5" in html and "app.js?v=5" in html)
        for icon in ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png",
                     "icon.svg", "icon-maskable.svg", "character.svg", "photos/mom.jpg", "photos/dad.jpg",
                     "photos/sarang.jpg", "photos/harang.jpg"]:
            ok = await page.evaluate(f"fetch('./{icon}').then(r => r.ok)")
            check(f"{icon} 제공", ok)

        # 새 아이콘 그림 확인(512 아이콘 가운데에 캐릭터 얼굴이 있는지 = 어두운 눈 픽셀)
        icon512 = os.path.join(BASE, "icon-512.png")
        with Image.open(icon512) as im:
            rgb = im.convert("RGB")
            check("icon-512는 512×512", rgb.size == (512, 512), str(rgb.size))
            core = rgb.crop((170, 150, 420, 420)).convert("L")
            dark = sum(1 for px in core.tobytes() if px < 110)
            check("icon-512에 캐릭터 얼굴", dark > 200, f"{dark}px")
        check("v3 스크립트 버전", await page.evaluate("window.__bbung.version") == "3")

        # ── 2. 가족 전환 · 브랜드 클릭 복귀 ──
        print("\n[2] 가족 전환 · 브랜드 클릭 → 기록하기")
        await page.click(".fam[data-who='dad']")
        await page.wait_for_timeout(300)
        check("아빠 선택 시 오른쪽 사진 교체",
              (await page.get_attribute("#helloPhoto", "src")) == "./photos/dad.jpg")
        check("아빠 인사 문구", "아빠" in (await page.inner_text("#helloTitle")))
        dad_photo_src = await page.evaluate("document.getElementById('helloPhoto').src")
        check("사진 실제 로드", "photos/dad.jpg" in dad_photo_src)
        await page.click(".fam[data-who='sarang']")
        await page.wait_for_timeout(250)
        check("사랑 사진", (await page.get_attribute("#helloPhoto", "src")) == "./photos/sarang.jpg")
        await page.click(".fam[data-who='mom']")
        await page.wait_for_timeout(250)

        await page.click(".tab[data-view='board']")
        await page.wait_for_timeout(300)
        check("뿡뿡 표로 이동", await page.is_visible("#viewBoard"))
        await page.click("#brandHome")
        await page.wait_for_timeout(400)
        check("브랜드 클릭 → 기록하기 복귀", await page.is_visible("#viewLog"))
        check("기록하기 탭 활성", "on" in (await page.get_attribute(".tab[data-view='log']", "class")))
        # 상세 시트를 연 상태에서도 브랜드로 돌아오는지
        await page.click(".tab[data-view='board']")
        await page.wait_for_timeout(200)
        await page.click("#brandHome")
        await page.wait_for_timeout(300)
        check("브랜드 버튼 두 번째 클릭도 동작", await page.is_visible("#viewLog"))

        # ── 3. 뿡뿡 표 기간 필터 삭제 ──
        print("\n[3] 오늘/7일/전체 필터 삭제 · 누적 표")
        check("기간 필터 없음(#rangeTabs)", await page.locator("#rangeTabs").count() == 0)
        board_text = await page.inner_text("#viewBoard")
        check("오늘/7일/전체 버튼 문구 없음",
              "7일" not in board_text and "전체" not in board_text, board_text[:60])
        check("날짜 문구 유지", "오늘 · " in (await page.inner_text("#boardDate")),
              await page.inner_text("#boardDate"))
        tdy = datetime.now().astimezone()
        yday = tdy - timedelta(days=1)
        old_iso = yday.isoformat(timespec="seconds")
        old_ms = int(yday.timestamp() * 1000)
        ctx_o, page_o = await new_page(browser, who="mom", seed=[{
            "id": "old1", "who": "mom", "food": "양파", "emoji": "🧅", "tone": "peach", "cat": "gas",
            "stage": "triple", "note": "어제 적어 둔 메모", "at": old_iso, "updatedAt": old_ms,
        }])
        await goto(page_o, port)
        await page_o.click(".tab[data-view='board']")
        await page_o.wait_for_timeout(300)
        check("어제 기록도 필터 없이 바로 보임", await page_o.locator(".chip").count() == 1,
              f"{await page_o.locator('.chip').count()}개")
        await page_o.click(".tab[data-view='log']")
        await page_o.fill("#foodInput", "양파")
        await page_o.click(".stage[data-stage='double']")
        await page_o.wait_for_timeout(350)
        check("오늘 다시 저장해도 칩 1개", await page_o.locator(".chip").count() == 1)
        check("오늘 표에 바로 보임", await board_chip_count(page_o, ".col[data-stage='double'] .chip") == 1)
        check("어제 메모 그대로", await page_o.locator(".chip-memo").count() == 1)
        old_recs = await page_o.evaluate("window.__bbung.records.filter(r => !r.deleted)")
        check("레코드는 여전히 1개", len(old_recs) == 1, str(old_recs))
        check("단계만 뿡뿡으로 이동", len(old_recs) == 1 and old_recs[0]["stage"] == "double", str(old_recs))
        check("메모 보존", len(old_recs) == 1 and old_recs[0]["note"] == "어제 적어 둔 메모", str(old_recs))
        check("원래 기록 시각은 그대로", len(old_recs) == 1 and old_recs[0]["at"] == old_iso, str(old_recs))
        check("updatedAt은 갱신", len(old_recs) == 1 and old_recs[0]["updatedAt"] > old_ms)
        await ctx_o.close()

        # ── 3b. 글만 보기 (그림이 안 맞는 음식) ──
        print("\n[3b] 글만 보기(그림 없이) — 보드 칩·상세·공유 카드")
        ctx_t, page_t = await new_page(browser, who="mom", seed=seed_records())
        await goto(page_t, port)
        await page_t.fill("#foodInput", "뿡뿡푸딩")
        await page_t.wait_for_timeout(250)
        check("글만 보기 토글 있음", await page_t.locator("#noIconBtn").count() == 1)
        await page_t.click("#noIconBtn")
        await page_t.wait_for_timeout(220)
        check("토글 켜짐", await page_t.get_attribute("#noIconBtn", "aria-pressed") == "true")
        check("미리보기도 글자만", "asText" in (await page_t.get_attribute("#previewEmoji", "class") or ""))
        check("미리보기 글자", (await page_t.inner_text("#previewEmoji")).strip() == "뿡뿡푸딩")
        await page_t.click(".stage[data-stage='single']")
        await page_t.wait_for_timeout(400)
        check("보드에 글자만 칩", await page_t.locator(".chip.text-only").count() == 1)
        check("글자만 칩에는 동그란 그림 없음", await page_t.locator(".chip.text-only .chip-fig").count() == 0)
        check("글자만 칩 이름", "뿡뿡푸딩" in (await page_t.inner_text(".chip.text-only")))
        check("글자만 칩은 가운데 정렬",
              await page_t.evaluate("getComputedStyle(document.querySelector('.chip.text-only .chip-name')).textAlign") == "center")
        rec_t = await page_t.evaluate("window.__bbung.records.filter(r => !r.deleted && r.food === '뿡뿡푸딩')")
        check("레코드 noIcon", len(rec_t) == 1 and rec_t[0].get("noIcon") is True, str(rec_t))
        check("저장 뒤 토글 자동 해제", await page_t.get_attribute("#noIconBtn", "aria-pressed") == "false")

        # 상세에서 그림을 골랐다가 → 다시 글만 보기
        await page_t.click(".col[data-stage='single'] .chip:has-text('뿡뿡푸딩')")
        await page_t.wait_for_timeout(380)
        check("상세도 글자만", "asText" in (await page_t.get_attribute("#detailCircle", "class") or ""))
        await page_t.click("#emojiMore summary")
        await page_t.wait_for_timeout(220)
        check("글만 보기 선택지", await page_t.locator("#emojiGrid .emoji-none").count() == 1)
        check("글만 보기 선택 상태", "on" in (await page_t.get_attribute("#emojiGrid .emoji-none", "class") or ""))
        await page_t.click("#emojiGrid button[data-emoji='🥣']")
        await page_t.wait_for_timeout(180)
        check("그림 고르면 글자만 해제", "asText" not in (await page_t.get_attribute("#detailCircle", "class") or ""))
        await page_t.click("#detailSave")
        await page_t.wait_for_timeout(380)
        check("그림으로 되돌리면 칩에 그림", await page_t.locator(".chip.text-only").count() == 0
              and await page_t.locator(".chip-fig").count() >= 1)
        await page_t.click(".col[data-stage='single'] .chip:has-text('뿡뿡푸딩')")
        await page_t.wait_for_timeout(380)
        await page_t.click("#emojiMore summary")
        await page_t.wait_for_timeout(180)
        await page_t.click("#emojiGrid .emoji-none")
        await page_t.wait_for_timeout(180)
        await page_t.click("#detailSave")
        await page_t.wait_for_timeout(380)
        check("다시 글만 보기", await page_t.locator(".chip.text-only").count() == 1)
        rec_t = await page_t.evaluate("window.__bbung.records.filter(r => !r.deleted && r.food === '뿡뿡푸딩')")
        check("그림 비우고 noIcon 유지", len(rec_t) == 1 and rec_t[0].get("emoji") == ""
              and rec_t[0].get("noIcon") is True, str(rec_t))

        # 공유 카드에도 글자만
        await open_share_card(page_t)
        ci = await page_t.evaluate("window.__bbung.cardInfo")
        check("카드 집계에 글자만 반영",
              bool(ci) and ci.get("textOnly") >= 1 and ci.get("icons") == ci.get("total") - ci.get("textOnly"), str(ci))
        px = await page_t.evaluate("""(() => {
            const cv = document.createElement('canvas');
            const src = document.getElementById('shareImg');
            cv.width = src.naturalWidth; cv.height = src.naturalHeight;
            const c = cv.getContext('2d');
            c.drawImage(src, 0, 0);
            const d = c.getImageData(655, 501, 1, 1).data;
            return [d[0], d[1], d[2]];
        })()""")
        check("카드에서도 그림 없이 글자만", all(float(v) >= 245 for v in px), str(px))
        await page_t.click("#shareClose")
        await page_t.wait_for_timeout(200)
        await ctx_t.close()

        # ── 3c. 한국 음식 · 과일 그림 32종 · 비슷한 말 매칭 ──
        print("\n[3c] 한국 음식·과일 그림 32종 · 비슷한 말 매칭")
        food_total = await page.evaluate("window.__bbung.foods")
        check("음식 사전 300종 이상", food_total >= 300, f"{food_total}종")
        check("음식 그림 32종", await page.evaluate("window.__bbung.pics") == 32,
              str(await page.evaluate("window.__bbung.pics")))
        pic_names = await page.evaluate("window.__bbung.picNames")
        check("그림 이름 한글", len(pic_names) == 32 and pic_names.get("chamoe") == "참외"
              and pic_names.get("kimchi-jjigae") == "김치찌개", str(pic_names)[:120])
        missing_files = []
        for slug in sorted(pic_names):
            ok = await page.evaluate(f"fetch('./foods/{slug}.webp').then(r => r.ok)")
            if not ok:
                missing_files.append(slug)
        check("foods/*.webp 32개 모두 제공", len(missing_files) == 0, str(missing_files))

        # 이름이 사전 이름으로 바뀌는 말
        matches = [
            ("참외", "참외", "chamoe"), ("김치찌개", "김치찌개", "kimchi-jjigae"),
            ("삼겹살", "삼겹살", "samgyeopsal"), ("김밥", "김밥", "gimbap"),
            ("샤인머스캣", "포도", ""), ("거봉", "포도", ""), ("청포도", "포도", ""),
            ("한라봉", "귤", ""), ("천혜향", "귤", ""), ("레드향", "귤", ""),
            ("대추토마토", "토마토", ""), ("수박화채", "수박", ""),
            ("달걀", "계란", ""), ("라떼", "카페라떼", ""), ("에스프레소", "커피", ""),
            ("요플레", "요거트", ""), ("그릭요거트", "요거트", ""),
            ("백숙", "닭고기", ""),
            ("어묵탕", "어묵", "eomuk"), ("오뎅", "어묵", "eomuk"), ("사과주스", "사과", ""),
            ("김치찌게", "김치찌개", "kimchi-jjigae"), ("된장찌게", "된장찌개", "doenjang-jjigae"),
            ("떡만두국", "떡만둣국", ""),
        ]
        bad = []
        for query, want, want_pic in matches:
            got = await page.evaluate("q => window.__bbung.findFood(q)", query)
            if not got or got.get("n") != want or got.get("p", "") != want_pic:
                bad.append(f"{query}→{got}")
        check(f"비슷한 말 {len(matches)}종 모두 맞음", len(bad) == 0, " | ".join(bad[:5]))

        # 사전에 이름은 따로 있어도 같은 그림으로 이어지는 말
        same_icon = [("삶은계란", "계란"), ("메추리알", "계란"), ("청양고추", "고추"),
                     ("오이고추", "고추"), ("족발", "돼지고기"), ("제육볶음", "돼지고기"),
                     ("방울토마토", "토마토"), ("보쌈", "돼지고기")]
        bad2 = []
        for query, ref in same_icon:
            got = await page.evaluate("q => window.__bbung.findFood(q)", query)
            base = await page.evaluate("q => window.__bbung.findFood(q)", ref)
            if not got or not base or got.get("e") != base.get("e") or got.get("p", "") != base.get("p", ""):
                bad2.append(f"{query}→{got}")
        check(f"같은 그림으로 이어지는 말 {len(same_icon)}종", len(bad2) == 0, " | ".join(bad2[:5]))

        # 화면에서 직접 — 미리보기 그림
        ctx_k, page_k = await new_page(browser, who="mom")
        await goto(page_k, port)
        await page_k.fill("#foodInput", "참외")
        await page_k.wait_for_timeout(400)
        check("참외 → 미리보기 그림", await page_k.is_visible("#previewPic"))
        check("참외 그림 실제 로드", await page_k.evaluate(
            "(() => { const i = document.getElementById('previewPic'); return i.naturalWidth; })()") > 0)
        check("그림이 나오면 이모지는 숨김", await page_k.is_hidden("#previewEmoji"))
        check("참외 이름 표시", "참외" in (await page_k.inner_text("#previewName")))
        await page_k.screenshot(path=os.path.join(SHOTS, "09_v3_korean_foods_390.png"), full_page=False)
        check("09_v3_korean_foods_390.png", os.path.getsize(os.path.join(SHOTS, "09_v3_korean_foods_390.png")) > 20000)

        await page_k.fill("#foodInput", "샤인머스캣")
        await page_k.wait_for_timeout(300)
        check("샤인머스캣 → 포도 표시", "포도" in (await page_k.inner_text("#previewName")))
        check("포도는 이모지로", await page_k.is_visible("#previewEmoji"))
        await page_k.fill("#foodInput", "어묵탕")
        await page_k.wait_for_timeout(300)
        check("어묵탕 → 어묵 그림", "어묵" in (await page_k.inner_text("#previewName"))
              and await page_k.is_visible("#previewPic"))

        # 저장 → 표 칩에 그림
        await page_k.fill("#foodInput", "참외")
        await page_k.wait_for_timeout(200)
        await page_k.click(".stage[data-stage='triple']")
        await page_k.wait_for_timeout(700)
        chip_pic = await page_k.evaluate("""(() => {
            const im = document.querySelector(".col[data-stage='triple'] .chip img.food-pic");
            return im ? { src: im.getAttribute('src'), w: im.naturalWidth } : null;
        })()""")
        check("표 칩에 한국 음식 그림", bool(chip_pic) and chip_pic["w"] > 0
              and "foods/chamoe.webp" in (chip_pic["src"] or ""), str(chip_pic))
        rec_k = await page_k.evaluate("window.__bbung.records.filter(r => r.food === '참외')")
        check("기록에 pic 저장", len(rec_k) == 1 and rec_k[0].get("pic") == "chamoe", str(rec_k))

        for food, stage in [("김치찌개", "single"), ("김밥", "double"), ("삼겹살", "calm")]:
            await page_k.click(".tab[data-view='log']")
            await page_k.fill("#foodInput", food)
            await page_k.wait_for_timeout(200)
            await page_k.click(f".stage[data-stage='{stage}']")
            await page_k.wait_for_timeout(600)
        loaded = await page_k.evaluate("Array.from(document.querySelectorAll('.chip .food-pic')).map(i => i.naturalWidth)")
        check("칩 그림 4개 모두 로드", len(loaded) == 4 and all(w > 0 for w in loaded), str(loaded))
        check("표에서 깨진 그림 0", len(await page_k.evaluate(
            "Array.from(document.images).filter(i => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map(i => i.src)")) == 0)
        await page_k.screenshot(path=os.path.join(SHOTS, "12_v3_board_pics_390.png"), full_page=False)
        check("12_v3_board_pics_390.png", os.path.getsize(os.path.join(SHOTS, "12_v3_board_pics_390.png")) > 20000)

        # 상세 시트 — 음식 그림 바꾸기
        await page_k.click(".col[data-stage='triple'] .chip")
        await page_k.wait_for_timeout(600)
        check("상세 동그란에도 그림", await page_k.evaluate(
            "(() => { const i = document.getElementById('detailPic'); return !i.hidden && i.naturalWidth > 0; })()"))
        await page_k.click("#emojiMore summary")
        await page_k.wait_for_timeout(400)
        check("그림 바꾸기에 한국 음식 32개", await page_k.locator("#emojiGrid .pic-btn").count() == 32,
              str(await page_k.locator("#emojiGrid .pic-btn").count()))
        check("그림 바꾸기에 이모지도 함께", await page_k.locator("#emojiGrid button[data-emoji]").count() >= 40)
        check("현재 그림이 선택되어 있음",
              "on" in (await page_k.get_attribute("#emojiGrid button[data-pic='chamoe']", "class") or ""))
        await page_k.click("#emojiGrid button[data-pic='samgyeopsal']")
        await page_k.wait_for_timeout(350)
        check("다른 그림 고르면 상세 그림 바뀌",
              "samgyeopsal" in (await page_k.get_attribute("#detailPic", "src") or ""))
        await page_k.screenshot(path=os.path.join(SHOTS, "10_v3_food_picker_390.png"), full_page=False)
        check("10_v3_food_picker_390.png", os.path.getsize(os.path.join(SHOTS, "10_v3_food_picker_390.png")) > 20000)
        await page_k.click("#detailSave")
        await page_k.wait_for_timeout(600)
        rec_k = await page_k.evaluate("window.__bbung.records.filter(r => r.food === '참외')")
        check("고른 그림이 기록에 저장", len(rec_k) == 1 and rec_k[0].get("pic") == "samgyeopsal", str(rec_k))
        check("표 칩 그림도 바뀌", "samgyeopsal" in (await page_k.get_attribute(
            ".col[data-stage='triple'] .chip img.food-pic", "src") or ""))

        # 그림 → 글만 보기로 되돌리기
        await page_k.click(".col[data-stage='triple'] .chip")
        await page_k.wait_for_timeout(500)
        await page_k.click("#emojiMore summary")
        await page_k.wait_for_timeout(250)
        await page_k.click("#emojiGrid .emoji-none")
        await page_k.wait_for_timeout(250)
        check("글만 보기 선택 시 그림 숨김", await page_k.is_hidden("#detailPic"))
        await page_k.click("#detailSave")
        await page_k.wait_for_timeout(500)
        rec_k = await page_k.evaluate("window.__bbung.records.filter(r => r.food === '참외')")
        check("pic은 비우고 noIcon 저장", len(rec_k) == 1 and rec_k[0].get("pic") == ""
              and rec_k[0].get("noIcon") is True, str(rec_k))
        check("표에서 그림 없이 글자만", await page_k.locator(".chip.text-only").count() == 1)

        # 사진 그림으로 되돌리고 박뮈아웃 카드 확인
        await page_k.click(".col[data-stage='triple'] .chip")
        await page_k.wait_for_timeout(500)
        await page_k.click("#emojiMore summary")
        await page_k.wait_for_timeout(250)
        await page_k.click("#emojiGrid button[data-pic='chamoe']")
        await page_k.wait_for_timeout(250)
        await page_k.click("#detailSave")
        await page_k.wait_for_timeout(500)
        check("그림으로 되돌리기", await page_k.locator(".chip.text-only").count() == 0
              and await page_k.locator(".chip .food-pic").count() == 4)

        await open_share_card(page_k)
        ci = await page_k.evaluate("window.__bbung.cardInfo")
        check("카드에 음식 그림 4개 들어감", bool(ci) and ci.get("foodPics") == 4, str(ci))
        px = await page_k.evaluate("""(() => {
            const cv = document.createElement('canvas');
            const src = document.getElementById('shareImg');
            cv.width = src.naturalWidth; cv.height = src.naturalHeight;
            const c = cv.getContext('2d');
            c.drawImage(src, 0, 0);
            const read = (x) => [0, 1, 2, 3, 4].map((i) => Array.from(c.getImageData(x - 20 + i * 10, 501, 1, 1).data.slice(0, 3)));
            return { triple: read(195), double: read(425), single: read(655), calm: read(885) };
        })()""")
        varied = [k for k, pts in px.items() if len({tuple(p) for p in pts}) >= 2]
        check("카드 아이콘이 그림으로 그려짐", len(varied) >= 3, f"{varied} / {px}")
        data_url = await page_k.evaluate("document.getElementById('shareImg').src")
        with open(os.path.join(SHOTS, "11_v3_card_korean_foods.png"), "wb") as fh:
            fh.write(base64.b64decode(data_url.split(",", 1)[1]))
        check("11_v3_card_korean_foods.png", os.path.getsize(os.path.join(SHOTS, "11_v3_card_korean_foods.png")) > 50000)
        await page_k.click("#shareClose")
        await page_k.wait_for_timeout(250)

        for w, h in [(390, 844), (1280, 900)]:
            check(f"{w} 한국 음식 그림 넘침 0", await page_k.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
        await ctx_k.close()

        # ── 4. 음식 미리보기 ──
        print("\n[4] 음식 입력 · 실시간 원형 미리보기")
        await page.fill("#foodInput", "양파")
        await page.wait_for_timeout(250)
        check("양파 → 🧅", await page.inner_text("#previewEmoji") == "🧅")
        check("양파 안내 문구", "가스" in (await page.inner_text("#previewHint")))
        await page.fill("#foodInput", "사과")
        await page.wait_for_timeout(200)
        check("사과 → 🍎", await page.inner_text("#previewEmoji") == "🍎")
        await page.fill("#foodInput", "마늘")
        await page.wait_for_timeout(200)
        check("마늘 → 🧄", await page.inner_text("#previewEmoji") == "🧄")
        await page.fill("#foodInput", "우유")
        await page.wait_for_timeout(200)
        check("우유 → 🥛", await page.inner_text("#previewEmoji") == "🥛")
        await page.fill("#foodInput", "뿡뿡가루")
        await page.wait_for_timeout(200)
        check("사전에 없는 음식은 첫 글자 배지",
              await page.inner_text("#previewEmoji") == "뿡"
              and "badge" in (await page.get_attribute("#previewEmoji", "class") or ""))
        await page.fill("#foodInput", "")
        await page.wait_for_timeout(200)
        check("입력 지우면 기본 그림", await page.inner_text("#previewEmoji") == "🍽️")

        # ── 5. 저장 (단계 버튼) ──
        print("\n[5] 4단계 저장 · 보드 전환")
        await page.fill("#foodInput", "양파")
        await page.click(".stage[data-stage='triple']")
        await page.wait_for_timeout(350)
        check("저장 후 보드로 전환", await page.is_visible("#viewBoard"))
        check("뿡뿡뿡 칸에 양파", await board_chip_count(page, ".col[data-stage='triple'] .chip") == 1)
        check("토스트 안내", "담았어요" in (await page.inner_text("#toast")))
        check("localStorage 저장", await page.evaluate("JSON.parse(localStorage.getItem('bbung.v1')).records.length") == 1)

        # ── 6. 저장 버튼 (마지막 단계) ──
        print("\n[6] 저장 버튼")
        await page.click(".tab[data-view='log']")
        await page.fill("#foodInput", "사과")
        await page.click("#saveBtn")
        await page.wait_for_timeout(300)
        check("저장 버튼도 보드로 전환", await page.is_visible("#viewBoard"))
        check("저장 버튼은 직전 단계(뿡뿡뿡) 칸에", await board_chip_count(page, ".col[data-stage='triple'] .chip") == 2)

        # ── 7. 같은 음식 중복 방지 ──
        print("\n[7] 같은 사람 안 음식 중복 방지")
        await page.click(".tab[data-view='log']")
        await page.fill("#foodInput", " 사과 ")  # 앞뒤 공백 포함
        await page.click(".stage[data-stage='double']")
        await page.wait_for_timeout(300)
        total = await page.evaluate("window.__bbung.records.filter(r => !r.deleted).length")
        check("중복 저장해도 칩 개수 유지(2개)", await page.locator(".chip").count() == 2,
              f"{await page.locator('.chip').count()}개")
        check("중복 저장해도 레코드 2개", total == 2, f"{total}개")
        check("사과가 뿡뿡 칸으로 이동", await board_chip_count(page, ".col[data-stage='double'] .chip") == 1)
        check("사과가 뿡 칸에서 사라짐", await board_chip_count(page, ".col[data-stage='single'] .chip") == 0)
        check("이동 안내 토스트", "옮겼어요" in (await page.inner_text("#toast")),
              await page.inner_text("#toast"))

        await page.click(".col[data-stage='double'] .chip")
        await page.wait_for_timeout(350)
        await page.fill("#memoInput", "사과는 반 개가 딱 좋아")
        await page.click("#detailSave")
        await page.wait_for_timeout(250)
        await page.click(".tab[data-view='log']")
        await page.fill("#foodInput", "사과")
        await page.click(".stage[data-stage='double']")
        await page.wait_for_timeout(300)
        recs = await page.evaluate("window.__bbung.records.filter(r => !r.deleted && r.food.includes('사과'))")
        check("다시 저장해도 메모 그대로", len(recs) == 1 and recs[0]["note"] == "사과는 반 개가 딱 좋아",
              str(recs))

        # ── 8. 상세 · 소리 · 메모 · 단계 변경 ──
        print("\n[8] 칩 클릭 · 방귀 소리 · 상세/메모")
        before = await page.evaluate("window.__bbung.soundLog.length")
        await page.click(".col[data-stage='double'] .chip")
        await page.wait_for_timeout(420)
        log = await page.evaluate("window.__bbung.soundLog.slice(-1)[0]")
        check("칩 클릭 시 소리 기록", await page.evaluate("window.__bbung.soundLog.length") > before, str(log))
        check("뿡뿡 소리 종류", log.get("stage") == "double", str(log))
        check("상세 시트 열림", await page.is_visible("#detailWrap .sheet"))
        check("상세 음식 이름", "사과" in (await page.inner_text("#detailTitle")))
        check("기존 메모 표시", (await page.input_value("#memoInput")) == "사과는 반 개가 딱 좋아")
        await page.fill("#memoInput", "사과 반 개 · 오후 3시쯤")
        await page.click("#detailStages button[data-stage='calm']")
        await page.wait_for_timeout(200)
        calm_sound = await page.evaluate("window.__bbung.soundLog.slice(-1)[0].stage")
        check("편안 소리", calm_sound == "calm", calm_sound)
        await page.click("#detailSave")
        await page.wait_for_timeout(350)
        check("단계 변경 반영(편안 칸)", await board_chip_count(page, ".col[data-stage='calm'] .chip") == 1)
        check("상세 닫힘", await page.is_hidden("#detailWrap"))
        check("메모 배지 표시", await page.locator(".col[data-stage='calm'] .chip-memo").count() == 1)

        # ── 9. 소리 끄기 ──
        print("\n[9] 소리 켜기/끄기")
        await page.click("#soundBtn")
        check("음소거 상태 반영", await page.get_attribute("#soundBtn", "aria-pressed") == "false")
        check("아이콘 🔇", (await page.inner_text("#soundBtn")) == "🔇")
        n0 = await page.evaluate("window.__bbung.soundLog.length")
        await page.click(".col[data-stage='calm'] .chip")
        await page.wait_for_timeout(350)
        muted = await page.evaluate("window.__bbung.soundLog.slice(-1)[0]")
        check("음소거 중에는 muted 기록", muted.get("muted") is True, str(muted))
        await page.click("#detailClose")
        await page.wait_for_timeout(200)
        await page.click("#soundBtn")
        check("다시 소리 켜짐", await page.get_attribute("#soundBtn", "aria-pressed") == "true")

        # ── 10. 가족 분리 ──
        print("\n[10] 가족 구성원별 기록 분리")
        await page.click(".fam[data-who='dad']")
        await page.wait_for_timeout(300)
        check("아빠 탭 선택", await page.get_attribute(".fam[data-who='dad']", "aria-selected") == "true")
        check("아빠 보드는 비어 있음", await page.locator(".chip").count() == 0)
        await page.click(".tab[data-view='log']")
        await page.fill("#foodInput", "양파")
        await page.click(".stage[data-stage='triple']")
        await page.wait_for_timeout(300)
        check("아빠도 양파 1개", await board_chip_count(page, ".col[data-stage='triple'] .chip") == 1)
        dad_total = await page.evaluate("window.__bbung.records.filter(r => !r.deleted && r.who === 'dad').length")
        check("아빠 기록 1개", dad_total == 1)
        await page.click(".fam[data-who='mom']")
        await page.wait_for_timeout(300)
        mom_total = await page.evaluate("window.__bbung.records.filter(r => !r.deleted && r.who === 'mom').length")
        check("엄마 기록은 2개 그대로", mom_total == 2)
        check("엄마 보드 칩 2개", await page.locator(".chip").count() == 2)

        # ── 11. 새로고침 유지 ──
        print("\n[11] 저장 유지")
        await page.reload(wait_until="networkidle")
        await page.wait_for_function("document.documentElement.dataset.ready === '1'")
        check("새로고침 후 유지(3개)", await page.evaluate("window.__bbung.records.filter(r => !r.deleted).length") == 3)
        await page.click(".fam[data-who='mom']")
        await page.click(".tab[data-view='board']")
        await page.wait_for_timeout(300)
        check("새로고침 후 엄마 칩 2개", await page.locator(".chip").count() == 2)
        check("새로고침 후 메모 유지",
              await page.locator(".col[data-stage='calm'] .chip-memo").count() == 1)

        # ── 12. 삭제 ──
        print("\n[12] 기록 삭제")
        await page.click(".col[data-stage='calm'] .chip")
        await page.wait_for_timeout(300)
        await page.click("#detailDelete")
        await page.wait_for_timeout(150)
        check("삭제 전 한 번 더 확인", "정말 삭제" in (await page.inner_text("#detailDelete")))
        await page.click("#detailDelete")
        await page.wait_for_timeout(350)
        mom_left = await page.evaluate("window.__bbung.records.filter(r => !r.deleted && r.who === 'mom').length")
        check("삭제 후 엄마 기록 1개", mom_left == 1, str(mom_left))

        # ── 13. 뿡밍아웃 카드 (아이폰 공유 시트 흉내) ──
        print("\n[13] 뿡밍아웃 카드 · 이미지 저장 · 공유하기")
        ctx_s, page_s = await new_page(browser, seed=seed_records(), who="mom", init_script=SHARE_MOCK)
        await goto(page_s, port)
        await open_share_card(page_s)
        info = await page_s.evaluate("(() => { const i = document.getElementById('shareImg'); return { w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 30), len: i.src.length, tag: i.tagName }; })()")
        check("카드 1080×1350 PNG", info["w"] == 1080 and info["h"] == 1350 and info["src"].startswith("data:image/png"), str(info))
        check("미리보기는 실제 <img> + 데이터 URL", info["tag"] == "IMG" and info["src"].startswith("data:image/png"), str(info))
        check("카드 이미지 용량 충분", info["len"] > 100000, str(info["len"]))
        check("이미지 저장 버튼 유지", await page_s.locator("#shareSave").count() == 1)
        check("이미지 저장 버튼 문구", "이미지 저장" in (await page_s.inner_text("#shareSave")))
        check("공유하기 버튼 있음", await page_s.locator("#shareSend").count() == 1)
        check("두 버튼 나란히", await page_s.evaluate("Math.abs(document.getElementById('shareSave').getBoundingClientRect().top - document.getElementById('shareSend').getBoundingClientRect().top) < 4"))
        data_url = await page_s.evaluate("document.getElementById('shareImg').src")
        card_path = os.path.join(SHOTS, "04_share_card.png")
        with open(card_path, "wb") as fh:
            fh.write(base64.b64decode(data_url.split(",", 1)[1]))
        check("04_share_card.png 저장", os.path.getsize(card_path) > 50000, card_path)
        await page_s.screenshot(path=os.path.join(SHOTS, "03_share_modal_390.png"), full_page=False)
        check("03_share_modal_390.png", os.path.getsize(os.path.join(SHOTS, "03_share_modal_390.png")) > 20000)

        # 카드에 가족 사진·캐릭터가 그려졌는지(캔버스 픽셀: 왼쪽 위 사진 자리 / 아래 캐릭터 자리)
        px = await page_s.evaluate("""(() => {
            const cv = document.createElement('canvas');
            const src = document.getElementById('shareImg');
            cv.width = src.naturalWidth; cv.height = src.naturalHeight;
            const c = cv.getContext('2d');
            c.drawImage(src, 0, 0);
            const photo = c.getImageData(112, 196, 1, 1).data;
            const skin = c.getImageData(112, 170, 1, 1).data;
            const char = c.getImageData(540, 1120, 1, 1).data;
            return { photo: [...photo], skin: [...skin], char: [...char] };
        })()""")
        check("카드에 가족 사진 자리", px["photo"][0] > 60 and px["photo"][1] < 245, str(px))

        # 이미지 저장 → 아이폰이면 공유 시트(파일)로
        await page_s.click("#shareSave")
        await page_s.wait_for_function("window.__shares.length >= 1", timeout=8000)
        shares = await page_s.evaluate("window.__shares")
        first = shares[0] if shares else {}
        files = first.get("files") or []
        check("이미지 저장 → 공유 시트에 PNG", len(files) == 1 and files[0]["type"] == "image/png" and files[0]["name"].endswith(".png"), str(first))
        check("저장 안내 토스트", "이미지 저장" in (await page_s.inner_text("#toast")), await page_s.inner_text("#toast"))

        # 공유하기 → 카톡 공유용 title/text + 파일
        await page_s.click("#shareSend")
        await page_s.wait_for_function("window.__shares.length >= 2", timeout=8000)
        shares = await page_s.evaluate("window.__shares")
        second = shares[1] if len(shares) > 1 else {}
        check("공유하기 → 파일 공유", len(second.get("files") or []) == 1 and (second.get("files") or [{}])[0].get("type") == "image/png", str(second))
        check("공유하기 제목/문구", "뿡밍아웃" in (second.get("title") or "") and "뿡뿡이 기록" in (second.get("text") or ""), str(second))
        await page_s.click("#shareClose")
        await page_s.wait_for_timeout(250)
        check("공유 시트 닫힘", await page_s.is_hidden("#shareWrap"))
        await ctx_s.close()

        # 이미지 저장 → 공유 시트가 없는 데스크톱 브라우저는 내려받기
        ctx_d, page_d = await new_page(browser, seed=seed_records(), who="mom")
        await goto(page_d, port)
        await open_share_card(page_d)
        try:
            async with page_d.expect_download(timeout=10000) as dl_info:
                await page_d.click("#shareSave")
            dl = await dl_info.value
            check("데스크톱 이미지 저장 = PNG 내려받기", dl.suggested_filename.endswith(".png"), dl.suggested_filename)
        except Exception as exc:
            check("데스크톱 이미지 저장 = PNG 내려받기", False, str(exc))
        await ctx_d.close()

        # ── 14. 가족 공유 (실제 Firebase) ──
        print("\n[14] 가족 실시간 공유 (Firebase /bbung_rooms)")
        try:
            await page.click("#linkBtn")
            await page.wait_for_timeout(200)
            check("가족 공유 시트 열림", await page.is_visible("#linkWrap .sheet"))
            check("기본은 로컬 전용", "이 기기에만" in (await page.inner_text("#linkStatus")),
                  await page.inner_text("#linkStatus"))
            await page.fill("#roomInput", room)
            await page.click("#linkSave")
            try:
                await page.wait_for_function(
                    "['live','polling'].includes(window.__bbung.mode)", timeout=20000)
            except Exception:
                pass
            mode = await page.evaluate("window.__bbung.mode")
            check("가족 방 연결", mode in ("live", "polling"), mode)
            await page.click(".tab[data-view='log']")
            await page.fill("#foodInput", "양파")
            await page.click(".stage[data-stage='triple']")
            await page.wait_for_timeout(1800)
            remote = http_json("GET", room_url)
            remote_records = list(((remote or {}).get("records") or {}).values())
            sent = [r for r in remote_records if r.get("food") == "양파" and r.get("who") == "mom"]
            check("서버에 기록 저장됨", len(sent) == 1, str(remote_records)[:200])

            ctx2, page2 = await new_page(browser, who="dad")
            await goto(page2, port, f"?room={room}")
            try:
                await page2.wait_for_function(
                    "window.__bbung.records.some(r => !r.deleted && r.food === '양파' && r.who === 'mom')",
                    timeout=15000)
                synced = True
            except Exception:
                synced = False
            check("초대 링크로 같은 기록 동기화", synced)
            if synced:
                check("초대 링크 자동 연결", (await page2.evaluate("window.__bbung.share.room")) == room)
                await page2.click(".tab[data-view='board']")
                await page2.wait_for_timeout(300)
                check("다른 기기 보드에 양파", await page2.locator(".chip").count() >= 1)
            await ctx2.close()
        except Exception as exc:
            warn("Firebase 실시간 공유", str(exc))
        finally:
            try:
                http_json("DELETE", room_url)
            except Exception as exc:
                warn("테스트 방 정리", str(exc))
            try:
                await page.click("#linkClose")
            except Exception:
                pass

        # ── 15. 레이아웃 ──
        print("\n[15] 모바일 390 · 데스크톱 1280 레이아웃")
        for w, h, label in [(390, 844, "390"), (1280, 900, "1280")]:
            ctx3, page3 = await new_page(browser, width=w, height=h, seed=seed_records(), who="mom")
            await goto(page3, port)
            overflow = await page3.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"{label} 기록 화면 가로 넘침 0", overflow <= 1, f"{overflow}px")
            face = await page3.evaluate("(() => { const r = document.getElementById('helloFace').getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right }; })()")
            check(f"{label} 기록하기 사진 크게(>=58px)", face["w"] >= 58 and face["h"] >= 58, str(face))
            check(f"{label} 사진이 화면 안", face["right"] <= w + 0.5, str(face))
            await page3.click(".tab[data-view='board']")
            await page3.wait_for_timeout(300)
            overflow2 = await page3.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"{label} 보드 화면 가로 넘침 0", overflow2 <= 1, f"{overflow2}px")
            check(f"{label} 칩 렌더", await page3.locator(".chip").count() == 8,
                  f"{await page3.locator('.chip').count()}개")
            if label == "1280":
                await page3.screenshot(path=os.path.join(SHOTS, "05_board_1280.png"), full_page=False)
            await ctx3.close()

        # ── 16. 스크린샷 ──
        print("\n[16] 스크린샷 저장")
        ctx4, page4 = await new_page(browser, seed=seed_records(), who="mom")
        await goto(page4, port)
        await page4.fill("#foodInput", "양파")
        await page4.wait_for_timeout(450)
        await page4.screenshot(path=os.path.join(SHOTS, "01_input_390.png"), full_page=False)
        check("01_input_390.png", os.path.getsize(os.path.join(SHOTS, "01_input_390.png")) > 20000)
        await page4.click(".tab[data-view='board']")
        await page4.wait_for_timeout(450)
        await page4.screenshot(path=os.path.join(SHOTS, "02_board_390.png"), full_page=False)
        check("02_board_390.png", os.path.getsize(os.path.join(SHOTS, "02_board_390.png")) > 20000)
        await page4.click(".col[data-stage='triple'] .chip")
        await page4.wait_for_timeout(500)
        await page4.screenshot(path=os.path.join(SHOTS, "06_detail_390.png"), full_page=False)
        check("06_detail_390.png", os.path.getsize(os.path.join(SHOTS, "06_detail_390.png")) > 20000)
        await ctx4.close()
        await ctx.close()
        await browser.close()
    srv.shutdown()

    # ── 콘솔 오류 ──
    print("\n[17] 콘솔 오류")
    real_errors = [e for e in ERRORS if "favicon" not in e.lower()]
    check("콘솔 오류 0", len(real_errors) == 0, " | ".join(real_errors[:4]))

    print("\n" + "─" * 58)
    print(f"통과 {len(PASS)} · 실패 {len(FAIL)} · 경고 {len(WARN)}")
    if WARN:
        for w in WARN:
            print("  ! ", w)
    if FAIL:
        print("\n실패 항목:")
        for f in FAIL:
            print("  ✗ ", f)
        sys.exit(1)
    print("🎉 모든 검증 통과!")
    print("스크린샷:", SHOTS)


if __name__ == "__main__":
    asyncio.run(run())

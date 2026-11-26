#!/usr/bin/env python3
"""뿡뿡이 기록 · 자동 검증

    LD_LIBRARY_PATH=/workspace/.browserlibs/lib python3 test_app.py

검증 항목
  · PWA 자원(manifest·sw·아이콘)과 첫 화면
  · 가족 4명 전환 · 기록 분리
  · 음식 입력 → 원형 미리보기 실시간 매칭(양파·사과·미지 음식)
  · 4단계 저장 · 저장 버튼 · 보드 이동
  · 같은 사람 안 음식 중복 방지(단계만 이동, 메모 보존, 다른 사람은 독립)
  · 칩 클릭 → 방귀 소리(Web Audio) + 상세 시트 · 메모 저장 · 단계 변경 · 삭제
  · 뿡밍아웃 PNG 카드(1080×1350) 생성 · 다운로드 · 공유 버튼
  · 가족 실시간 공유(선택) — 실제 Firebase 테스트 방으로 쓰기/읽기 확인 후 정리
  · 모바일 390 / 데스크톱 1280 가로 넘침 0 · 콘솔 오류 0
  · 스크린샷 downloads/bbung_note/01~04
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
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.async_api import async_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(os.path.dirname(os.path.dirname(BASE)), "downloads", "bbung_note")
FB = "https://baby-feeding-9f820-default-rtdb.asia-southeast1.firebasedatabase.app"
TODAY = datetime.now().strftime("%Y-%m-%d")

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


async def new_page(browser, width=390, height=844, seed=None, who=None, url_suffix=""):
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

        # ── 1. 첫 화면 · PWA ──
        print("\n[1] 첫 화면 · PWA")
        check("앱 제목", "뿡뿡이 기록" in (await page.title()))
        check("브랜드 표시", "뿡뿡이 기록" in (await page.inner_text(".brand-text")))
        check("기본 가족은 엄마", "엄마" in (await page.inner_text(".fam[aria-selected='true']")))
        check("가족 탭 4명", await page.locator(".fam").count() == 4)
        check("하단 탭 2개", await page.locator(".tabbar .tab").count() == 2)
        check("음식 사전 100종 이상", await page.evaluate("window.__bbung.foods") >= 100,
              f"{await page.evaluate('window.__bbung.foods')}종")
        manifest = await page.evaluate("fetch('./manifest.webmanifest').then(r => r.json())")
        check("manifest 이름", manifest.get("short_name") == "뿡뿡이 기록", str(manifest.get("short_name")))
        check("manifest 아이콘 3종", len(manifest.get("icons", [])) == 3)
        sw = await page.evaluate("fetch('./sw.js').then(r => r.text())")
        check("sw 캐시 이름 bbung-note-v1", "bbung-note-v1" in sw)
        for icon in ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg"]:
            ok = await page.evaluate(f"fetch('./{icon}').then(r => r.ok)")
            check(f"{icon} 제공", ok)

        # ── 2. 음식 미리보기 ──
        print("\n[2] 음식 입력 · 실시간 원형 미리보기")
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
        await page.fill("#foodInput", "뿡뿡푸딩")
        await page.wait_for_timeout(200)
        check("사전에 없는 음식은 첫 글자 배지",
              await page.inner_text("#previewEmoji") == "뿡"
              and "badge" in (await page.get_attribute("#previewEmoji", "class") or ""))
        await page.fill("#foodInput", "")
        await page.wait_for_timeout(200)
        check("입력 지우면 기본 그림", await page.inner_text("#previewEmoji") == "🍽️")

        # ── 3. 저장 (단계 버튼) ──
        print("\n[3] 4단계 저장 · 보드 전환")
        await page.fill("#foodInput", "양파")
        await page.click(".stage[data-stage='triple']")
        await page.wait_for_timeout(350)
        check("저장 후 보드로 전환", await page.is_visible("#viewBoard"))
        check("뿡뿡뿡 칸에 양파", await board_chip_count(page, ".col[data-stage='triple'] .chip") == 1)
        check("토스트 안내", "담았어요" in (await page.inner_text("#toast")))
        check("localStorage 저장", await page.evaluate("JSON.parse(localStorage.getItem('bbung.v1')).records.length") == 1)

        # ── 4. 저장 버튼 (마지막 단계) ──
        print("\n[4] 저장 버튼")
        await page.click(".tab[data-view='log']")
        await page.fill("#foodInput", "사과")
        await page.click("#saveBtn")
        await page.wait_for_timeout(300)
        check("저장 버튼도 보드로 전환", await page.is_visible("#viewBoard"))
        check("저장 버튼은 직전 단계(뿡뿡뿡) 칸에", await board_chip_count(page, ".col[data-stage='triple'] .chip") == 2)

        # ── 5. 같은 음식 중복 방지 ──
        print("\n[5] 같은 사람 안 음식 중복 방지")
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

        # 메모 넣고 같은 단계로 다시 저장 → 메모 보존
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

        # ── 6. 상세 · 소리 · 메모 · 단계 변경 ──
        print("\n[6] 칩 클릭 · 방귀 소리 · 상세/메모")
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

        # ── 7. 소리 끄기 ──
        print("\n[7] 소리 켜기/끄기")
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

        # ── 8. 가족 분리 ──
        print("\n[8] 가족 구성원별 기록 분리")
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

        # ── 9. 새로고침 유지 ──
        print("\n[9] 저장 유지 · 오프라인")
        await page.reload(wait_until="networkidle")
        await page.wait_for_function("document.documentElement.dataset.ready === '1'")
        check("새로고침 후 유지(3개)", await page.evaluate("window.__bbung.records.filter(r => !r.deleted).length") == 3)
        await page.click(".fam[data-who='mom']")
        await page.click(".tab[data-view='board']")
        await page.wait_for_timeout(250)
        check("새로고침 후 엄마 칩 2개", await page.locator(".chip").count() == 2)
        check("새로고침 후 메모 유지",
              await page.locator(".col[data-stage='calm'] .chip-memo").count() == 1)

        # ── 10. 삭제 ──
        print("\n[10] 기록 삭제")
        await page.click(".col[data-stage='calm'] .chip")
        await page.wait_for_timeout(300)
        await page.click("#detailDelete")
        await page.wait_for_timeout(150)
        check("삭제 전 한 번 더 확인", "정말 삭제" in (await page.inner_text("#detailDelete")))
        await page.click("#detailDelete")
        await page.wait_for_timeout(350)
        mom_left = await page.evaluate("window.__bbung.records.filter(r => !r.deleted && r.who === 'mom').length")
        check("삭제 후 엄마 기록 1개", mom_left == 1, str(mom_left))

        # ── 11. 뿡밍아웃 카드 ──
        print("\n[11] 뿡밍아웃 PNG 카드")
        await page.click("#shareCardBtn")
        await page.wait_for_function("(() => { const i = document.getElementById('shareImg'); return i && i.naturalWidth > 0; })()", timeout=10000)
        info = await page.evaluate("(() => { const i = document.getElementById('shareImg'); return { w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 30), len: i.src.length }; })()")
        check("카드 1080×1350 PNG", info["w"] == 1080 and info["h"] == 1350 and info["src"].startswith("data:image/png"), str(info))
        check("카드 이미지 용량 충분", info["len"] > 100000, str(info["len"]))
        data_url = await page.evaluate("document.getElementById('shareImg').src")
        card_path = os.path.join(SHOTS, "04_share_card.png")
        with open(card_path, "wb") as fh:
            fh.write(base64.b64decode(data_url.split(",", 1)[1]))
        check("04_share_card.png 저장", os.path.getsize(card_path) > 50000, card_path)
        try:
            async with page.expect_download(timeout=8000) as dl_info:
                await page.click("#shareSave")
            dl = await dl_info.value
            check("이미지 다운로드 파일명", dl.suggested_filename.endswith(".png"), dl.suggested_filename)
        except Exception as exc:
            check("이미지 다운로드", False, str(exc))
        await page.click("#shareClose")
        await page.wait_for_timeout(250)
        check("공유 시트 닫힘", await page.is_hidden("#shareWrap"))

        # ── 12. 가족 공유 (실제 Firebase) ──
        print("\n[12] 가족 실시간 공유 (Firebase /bbung_rooms)")
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

            # 다른 기기(새 컨텍스트)가 초대 링크(?room=)로 들어와 같은 표를 봄
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

        # ── 13. 레이아웃 ──
        print("\n[13] 모바일 390 · 데스크톱 1280 레이아웃")
        for w, h, label in [(390, 844, "390"), (1280, 900, "1280")]:
            ctx3, page3 = await new_page(browser, width=w, height=h, seed=seed_records(), who="mom")
            await goto(page3, port)
            overflow = await page3.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"{label} 기록 화면 가로 넘침 0", overflow <= 1, f"{overflow}px")
            await page3.click(".tab[data-view='board']")
            await page3.wait_for_timeout(250)
            overflow2 = await page3.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"{label} 보드 화면 가로 넘침 0", overflow2 <= 1, f"{overflow2}px")
            check(f"{label} 칩 렌더", await page3.locator(".chip").count() == 8,
                  f"{await page3.locator('.chip').count()}개")
            if label == "1280":
                await page3.screenshot(path=os.path.join(SHOTS, "05_board_1280.png"), full_page=False)
            await ctx3.close()

        # ── 14. 스크린샷 (시드 데이터) ──
        print("\n[14] 스크린샷 저장")
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
        await page4.screenshot(path=os.path.join(SHOTS, "03_detail_390.png"), full_page=False)
        check("03_detail_390.png", os.path.getsize(os.path.join(SHOTS, "03_detail_390.png")) > 20000)
        await ctx4.close()
        await ctx.close()
        await browser.close()
    srv.shutdown()

    # ── 콘솔 오류 ──
    print("\n[15] 콘솔 오류")
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

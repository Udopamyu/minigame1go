#!/usr/bin/env python3
"""Evaluation-team browser smoke checks for PIXEL TREBUCHET.

This does not prove all ten stages can be cleared or that game balance is good.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "games" / "catapult" / "index.html"
OUT = ROOT / "evaluation" / "catapult"

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

@contextmanager
def serving():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{httpd.server_port}/games/catapult/"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join()

def check(result, name, cond, details=None):
    result["checks"].append({"name": name, "passed": bool(cond), "details": details})
    if not cond:
        result["status"] = "failed"

def view(browser, url, name, width, height, result):
    context = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=1, reduced_motion="reduce")
    errors = []
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    page.locator("#game").wait_for(timeout=10000)
    check(result, f"{name}: short public game title", page.title() == "投石機")
    check(result, f"{name}: visible brand title", page.locator("header .brand b").inner_text() == "投石機")
    page.wait_for_timeout(800)
    check(result, f"{name}: game canvas", page.locator("#game").count() == 1)
    check(result, f"{name}: stage 1", "01 / 10" in page.locator("#stageText").inner_text())
    check(result, f"{name}: fire enabled", page.locator("#fire").is_enabled())
    dimensions = page.evaluate("""() => ({
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        canvasWidth: document.querySelector('#game').width,
        canvasHeight: document.querySelector('#game').height
    })""")
    check(result, f"{name}: no horizontal overflow",
          dimensions["width"] <= dimensions["viewport"] + 2, dimensions)
    page.screenshot(path=str(OUT / f"{name}-start.png"), full_page=True)
    # Keep stage HUD, target preview and the floating upgrade button separate.
    overlaps = page.evaluate("""() => {
      const rect = el => el.getBoundingClientRect();
      const overlap = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return Math.round(x * y);
      };
      const hud = rect(document.querySelector('.viewtop'));
      const target = rect(document.querySelector('.target-inset'));
      const upgrade = rect(document.querySelector('#openShop'));
      return {hud_target:overlap(hud,target),hud_upgrade:overlap(hud,upgrade),
              upgrade_target:overlap(upgrade,target)};
    }""")
    check(result, f"{name}: HUD does not cover target preview",
          overlaps["hud_target"] == 0, overlaps)
    if width < 880:
        check(result, f"{name}: mobile upgrade button does not cover HUD",
              overlaps["hud_upgrade"] == 0, overlaps)

    if width < 880:
        check(result, "mobile: upgrade button visible", page.locator("#openShop").is_visible())
        page.locator("#openShop").click()
        check(result, "mobile: upgrade panel opens",
              page.locator("#shop").evaluate("(el)=>el.classList.contains('open')"))
        page.locator("#closeShop").click()
        check(result, "mobile: upgrade panel closes",
              not page.locator("#shop").evaluate("(el)=>el.classList.contains('open')"))
        page.locator("#openShop").focus()
        page.keyboard.press("Space")
        check(result, "mobile: Space activates focused upgrade button",
              page.locator("#shop").evaluate("(el)=>el.classList.contains('open')"))
        check(result, "mobile: Space on upgrade does not fire",
              page.locator("#fire").is_enabled())
        page.locator("#closeShop").click()
    else:
        check(result, "desktop: upgrade panel visible", page.locator("#shop").is_visible())
        original_gold = page.locator("#goldText").inner_text()
        page.locator('[data-buy="cw"]').focus()
        page.keyboard.press("Space")
        check(result, "desktop: Space activates focused purchase button",
              page.locator("#goldText").inner_text() != original_gold)
        check(result, "desktop: purchase does not fire",
              page.locator("#fire").is_enabled())
    page.locator("#cameraSlide").evaluate("""el => {
        el.value = '80'; el.dispatchEvent(new Event('input', {bubbles: true}));
    }""")
    check(result, f"{name}: camera slider responds",
          int(page.locator("#cameraSlide").input_value()) >= 75)
    page.locator("#fire").click()
    page.wait_for_timeout(180)
    check(result, f"{name}: launch started",
          page.locator("#status").inner_text() in ("winding", "swing", "flight", "settle"))
    check(result, f"{name}: pin setting locked during shot",
          page.locator("#pin").is_disabled())
    check(result, f"{name}: wind setting locked during shot",
          page.locator("#wind").is_disabled())
    check(result, f"{name}: upgrades locked during shot",
          page.locator('[data-buy="cw"]').is_disabled())
    page.wait_for_timeout(1450)
    page.screenshot(path=str(OUT / f"{name}-firing.png"), full_page=True)
    if name == "desktop":
        # Verify the whole actual shot finishes, then controls unlock.
        try:
            page.wait_for_function(
                "() => !document.querySelector('#fire').disabled",
                timeout=35000)
            check(result, "desktop: shot completes and fire unlocks", True)
            check(result, "desktop: pin unlocks after shot",
                  page.locator("#pin").is_enabled())
            check(result, "desktop: wind unlocks after shot",
                  page.locator("#wind").is_enabled())
            shots = page.evaluate("""() => {
                const saved = JSON.parse(localStorage.getItem('pixel-trebuchet-v03'));
                return saved && saved.shots || 0;
            }""")
            check(result, "desktop: completed shot persisted", shots >= 1, shots)
        except Exception as exc:
            check(result, "desktop: shot completes and fire unlocks", False, str(exc))
    check(result, f"{name}: no JavaScript exceptions", len(errors) == 0, errors)
    context.close()

def stage_check(browser, url, stage_zero_based, result):
    context = browser.new_context(viewport={"width": 390, "height": 844},
                                  device_scale_factor=1, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(f"""(() => {{
      localStorage.setItem('pixel-trebuchet-v03', JSON.stringify({{stage:{stage_zero_based}}}));
    }})();""")
    page.goto(url, wait_until="domcontentloaded", timeout=20000)
    page.locator("#stageText").wait_for()
    page.wait_for_timeout(650)
    wanted = str(stage_zero_based + 1).zfill(2) + " / 10"
    check(result, f"stage {stage_zero_based+1}: state loads",
          wanted in page.locator("#stageText").inner_text())
    check(result, f"stage {stage_zero_based+1}: fire enabled", page.locator("#fire").is_enabled())
    if stage_zero_based >= 3:
        text = page.locator("#goalText").inner_text()
        label = "TANK" if stage_zero_based in (7, 9) else "🎈"
        check(result, f"stage {stage_zero_based+1}: moving target in objective",
              label in text, text)
    snapshot = page.evaluate("() => window.__catapultQA()")
    if stage_zero_based >= 5:
        expected_heights = [11, 14, 5, 10, 12]
        height = expected_heights[stage_zero_based - 5]
        check(result, f"stage {stage_zero_based+1}: real elevated target",
              snapshot["lowestTargetBlock"] >= height and height > 0,
              snapshot)
        check(result, f"stage {stage_zero_based+1}: physical raised ground",
              snapshot["targetGround"] == height, snapshot["targetGround"])
        check(result, f"stage {stage_zero_based+1}: nonzero wind physics",
              abs(snapshot["wind"]) > 0.05, snapshot["wind"])
        if stage_zero_based in (7, 9):
            targets = snapshot["movingTargets"]
            check(result, f"stage {stage_zero_based+1}: genuine tank objects",
                  bool(targets) and all(x["kind"] == "tank" for x in targets),
                  targets)
            if targets:
                original_x = targets[0]["x"]
                page.wait_for_timeout(1450)
                new_x = page.evaluate("() => window.__catapultQA().movingTargets[0].x")
                check(result, f"stage {stage_zero_based+1}: tanks physically move",
                      abs(new_x-original_x) > 0.2,
                      {"before": original_x, "after": new_x})
        page.screenshot(path=str(OUT / f"stage{stage_zero_based+1}-landscape.png"),
                        full_page=False)
        page.locator("#cameraSlide").evaluate("""el => {
            el.value = '100'; el.dispatchEvent(new Event('input', {bubbles: true}));
        }""")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f"stage{stage_zero_based+1}-target-view.png"),
                        full_page=False)
    check(result, f"stage {stage_zero_based+1}: no exceptions", not errors, errors)
    if stage_zero_based == 3:
        page.screenshot(path=str(OUT / "stage4-balloon.png"))
    context.close()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    result = {"game_id": "catapult", "source_sha256": sha256(GAME.read_bytes()).hexdigest(),
              "timestamp": datetime.now(timezone.utc).isoformat(),
              "status": "passed", "checks": [], "errors": [],
              "scope": "browser smoke checks only; full 10-stage balance not verified"}
    try:
        executable = os.environ.get("CHROMIUM_EXECUTABLE")
        with serving() as url, sync_playwright() as p:
            kw = dict(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
            if executable:
                kw["executable_path"] = executable
            browser = p.chromium.launch(**kw)
            try:
                view(browser, url, "mobile", 390, 844, result)
                view(browser, url, "narrow", 320, 700, result)
                view(browser, url, "tablet", 768, 1024, result)
                view(browser, url, "desktop", 1280, 800, result)
                for stage in range(10):
                    stage_check(browser, url, stage, result)
            finally:
                browser.close()
    except Exception as exc:
        result["status"] = "failed"
        result["errors"].append(f"{type(exc).__name__}: {exc}")
    path = OUT / "test-results.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = len(result["checks"])
    ok = sum(c["passed"] for c in result["checks"])
    print(json.dumps({"status": result["status"], "checks_passed": ok, "checks_total": total,
                      "report": str(path), "errors": result["errors"]}, ensure_ascii=False))
    return 0 if result["status"] == "passed" else 1

if __name__ == "__main__":
    sys.exit(main())

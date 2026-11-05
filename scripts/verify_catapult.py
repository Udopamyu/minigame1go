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
    if name == "mobile":
        check(result, "mobile: upgrade button visible", page.locator("#openShop").is_visible())
        page.locator("#openShop").click()
        check(result, "mobile: upgrade panel opens",
              page.locator("#shop").evaluate("(el)=>el.classList.contains('open')"))
        page.locator("#closeShop").click()
        check(result, "mobile: upgrade panel closes",
              not page.locator("#shop").evaluate("(el)=>el.classList.contains('open')"))
    else:
        check(result, "desktop: upgrade panel visible", page.locator("#shop").is_visible())
    page.locator("#cameraSlide").evaluate("""el => {
        el.value = '80'; el.dispatchEvent(new Event('input', {bubbles: true}));
    }""")
    check(result, f"{name}: camera slider responds",
          int(page.locator("#cameraSlide").input_value()) >= 75)
    page.locator("#fire").click()
    page.wait_for_timeout(180)
    check(result, f"{name}: launch started",
          page.locator("#status").inner_text() in ("winding", "swing", "flight", "settle"))
    page.wait_for_timeout(1450)
    page.screenshot(path=str(OUT / f"{name}-firing.png"), full_page=True)
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
                view(browser, url, "desktop", 1280, 800, result)
                stage_check(browser, url, 3, result)
                stage_check(browser, url, 9, result)
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

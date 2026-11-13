#!/usr/bin/env python3
"""Headless Chromium smoke tests for Robo Salvage 3D TPS.
A network connection is required to load the pinned Three.js module.
This is not a full playthrough or gameplay-balance validation.
"""
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS = ROOT / "evaluation" / "robo-salvage-tps"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

class QuietServer(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 8765), QuietServer)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8765/games/robo-salvage-tps/index.html"

def snapshot(page):
    return page.evaluate("window.__ROBO_TPS_QA__()")

def open_and_start(page, name):
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("document.getElementById('loader').style.display === 'none'", timeout=60000)
    page.screenshot(path=str(SCREENSHOTS / (name + "-start.png")))
    page.locator("#startBtn").click()
    page.wait_for_function("window.__ROBO_TPS_QA__ && window.__ROBO_TPS_QA__().phase === 'battle'", timeout=10000)
    data = snapshot(page)
    assert data["stage"] == 1 and data["enemyCount"] >= 2, data
    return errors

with sync_playwright() as p:
    options = {"headless": True, "args": [
        "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--disable-dev-shm-usage",
        "--no-sandbox"
    ]}
    browser_path = os.environ.get("CHROMIUM_EXECUTABLE")
    if browser_path:
        options["executable_path"] = browser_path
    browser = p.chromium.launch(**options)
    desktop = browser.new_context(viewport={"width": 1280, "height": 720})
    page = desktop.new_page()
    errors = open_and_start(page, "desktop")
    before = snapshot(page)["playerPos"]
    page.keyboard.down("w")
    page.wait_for_timeout(600)
    page.keyboard.up("w")
    after = snapshot(page)["playerPos"]
    assert after[1] < before[1] - 0.3, ("W movement failed", before, after)
    page.mouse.move(640, 360)
    page.mouse.down()
    page.wait_for_timeout(170)
    assert snapshot(page)["fireCd"] > 0, "Mouse fire failed"
    page.mouse.up()
    page.keyboard.press("p")
    page.wait_for_function("window.__ROBO_TPS_QA__().phase === 'pause'")
    page.get_by_role("button", name="RESUME / 再開").click()
    page.wait_for_function("window.__ROBO_TPS_QA__().phase === 'battle'")
    page.screenshot(path=str(SCREENSHOTS / "desktop-combat.png"))
    assert not errors, ("Desktop JS errors", errors)
    desktop.close()

    mobile = browser.new_context(viewport={"width": 430, "height": 932}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = mobile.new_page()
    errors = open_and_start(page, "mobile")
    assert page.locator("#touch").evaluate("(e) => getComputedStyle(e).display") != "none"
    page.locator("#dashBtn").tap()
    page.wait_for_timeout(80)
    assert snapshot(page)["dashCd"] > 0, "Mobile dash did not activate"
    page.locator("#fireBtn").tap()
    page.screenshot(path=str(SCREENSHOTS / "mobile-combat.png"))
    assert not errors, ("Mobile JS errors", errors)
    mobile.close()
    browser.close()
server.shutdown()
print("3D TPS smoke QA: desktop and mobile passed; screenshots saved.")

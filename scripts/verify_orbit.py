"""Real Chromium acceptance checks for #003 ORBIT SWITCH.
No game mock, external assets, score edits or video automation.
"""
import json
import os
from pathlib import Path
import shutil
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evaluation/orbit-switch"
OUTPUT.mkdir(parents=True, exist_ok=True)
SIZES = [(320, 700), (390, 844), (768, 1024), (1280, 800)]
report = {
    "status": "failed",
    "game": "#003 ORBIT SWITCH",
    "checks": [],
    "browser_errors": [],
    "external_requests": [],
    "manual_review": "NOT DONE — real devices, fun, and final public release require human approval",
    "release_approved": False
}

def check(label, condition, detail=None):
    item = {"name": label, "passed": bool(condition)}
    if detail is not None:
        item["detail"] = detail
    report["checks"].append(item)
    if not condition:
        raise AssertionError(label + (": " + str(detail) if detail is not None else ""))

def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = "http://127.0.0.1:" + str(server.server_address[1])
    try:
        with sync_playwright() as pw:
            chrome = os.environ.get("CHROMIUM_EXECUTABLE") or shutil.which("chromium")
            browser = pw.chromium.launch(headless=True, executable_path=chrome, args=["--no-sandbox", "--disable-dev-shm-usage"])
            def track(page):
                page.on("pageerror", lambda err: report["browser_errors"].append(str(err)))
                page.on("request", lambda req: report["external_requests"].append(req.url)
                        if urlsplit(req.url).scheme in ("http", "https") and urlsplit(req.url).netloc != urlsplit(origin).netloc else None)

            for width, height in SIZES:
                mobile = width < 800
                ctx = browser.new_context(viewport={"width":width, "height":height}, is_mobile=mobile, has_touch=mobile)
                page = ctx.new_page()
                track(page)
                response = page.goto(origin + "/games/orbit-switch/?e2e=1&seed=123")
                check("served_%sx%s" % (width, height), response is not None and response.ok)
                check("initial_state_%sx%s" % (width, height), page.locator("body").get_attribute("data-state") == "ready")
                check("no_horizontal_overflow_%sx%s" % (width, height), page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
                visible = page.evaluate("""() => {
                  let b=document.querySelector('#start-button').getBoundingClientRect();
                  let c=document.querySelector('#game').getBoundingClientRect();
                  return b.width>0&&b.height>0&&b.bottom<=innerHeight+2&&c.height>0&&c.width>0;
                }""")
                check("start_visible_%sx%s" % (width, height), visible)
                page.screenshot(path=str(OUTPUT / ("intro_%sx%s.png" % (width, height))), full_page=True)
                page.locator("#start-button").click()
                check("starts_%sx%s" % (width, height), page.locator("body").get_attribute("data-state") == "playing")
                check("thirty_seconds_%sx%s" % (width, height), page.locator("#time-left").inner_text() == "30")
                if width == 390:
                    page.screenshot(path=str(OUTPUT / "gameplay_mobile.png"))
                    check("initial_inner_lane", page.evaluate("window.__orbitTest.snapshot().lane") == 0)
                    page.locator("#game").tap(position={"x":180, "y":240})
                    check("touch_changes_to_outer", page.evaluate("window.__orbitTest.snapshot().lane") == 1)
                    page.evaluate("window.__orbitTest.advance(.25)")
                    page.keyboard.press("Space")
                    check("space_changes_to_inner", page.evaluate("window.__orbitTest.snapshot().lane") == 0)
                    # Rapid tapping must not apply a second switch.
                    page.locator("#game").tap(position={"x":180, "y":240})
                    page.locator("#game").tap(position={"x":180, "y":240})
                    check("rapid_double_tap_guard", page.evaluate("window.__orbitTest.snapshot().lane") == 0)
                ctx.close()

            ctx = browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
            win = ctx.new_page()
            track(win)
            win.goto(origin + "/games/orbit-switch/?e2e=1&seed=321")
            win.locator("#start-button").click()
            state = win.evaluate("""() => {
              for(let n=0;n<1000;n++){
                const s=window.__orbitTest.snapshot();
                if(s.state!=='playing')break;
                const gates=window.__orbitTest.gates();
                const g=gates.find(e=>!e.resolved&&e.at>s.progress);
                if(g&&g.at-s.progress<.38&&g.hazardLane===s.lane){
                  document.querySelector('#switch-button').click();
                }
                window.__orbitTest.advance(.05);
              }
              return window.__orbitTest.snapshot();
            }""")
            check("survival_with_real_switch_mechanics", state["state"]=="finished" and state["elapsed"] >= 29.99, state)
            check("stars_awarded_for_safe_lanes", state["score"]>=10 and state["stars"]>=1, state)
            check("lives_preserved_by_correct_switches", state["lives"]==3, state)
            check("win_overlay", win.locator("#result-title").inner_text()=="MISSION CLEAR")
            check("best_score_persisted", state["best"]==state["score"], state)
            win.screenshot(path=str(OUTPUT / "clear_mobile.png"), full_page=True)
            win.reload()
            check("best_score_after_reload", win.locator("#best-score").inner_text()==str(state["score"]).zfill(3))
            ctx.close()

            ctx = browser.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
            loss = ctx.new_page()
            track(loss)
            loss.goto(origin + "/games/orbit-switch/?e2e=1&seed=321")
            loss.locator("#start-button").click()
            missed = loss.evaluate("window.__orbitTest.advance(29)")
            check("three_hits_end_game", missed["state"]=="finished" and missed["lives"]==0, missed)
            check("gameover_overlay", loss.locator("#result-title").inner_text()=="GAME OVER")
            loss.screenshot(path=str(OUTPUT / "gameover_mobile.png"), full_page=True)
            loss.locator("#restart-button").click()
            check("restart_playing", loss.locator("body").get_attribute("data-state")=="playing")
            check("restart_resets_time_score_and_lives",
                  loss.evaluate("(()=>{let s=window.__orbitTest.snapshot();return s.elapsed<1&&s.score===0&&s.lives===3})()"))
            check("no_browser_js_errors", not report["browser_errors"], report["browser_errors"])
            check("no_external_requests", not report["external_requests"], report["external_requests"])
            ctx.close()
            browser.close()
            report["status"] = "passed"
    except Exception as exc:
        report["error"] = type(exc).__name__ + ": " + str(exc)
        raise
    finally:
        server.shutdown()
        (OUTPUT / "test-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps({"status":report["status"], "checks":len(report["checks"]), "error":report.get("error")}, ensure_ascii=False))

if __name__=="__main__":
    main()

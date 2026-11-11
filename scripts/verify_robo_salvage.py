#!/usr/bin/env python3
"""Independent Playwright QA of the #003 Robo Salvage browser game."""
from __future__ import annotations
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"evaluation/robo-salvage"
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(label,condition,detail=None):
    checks.append({"check":label,"passed":bool(condition),"detail":detail})
    print(("PASS" if condition else "FAIL")+" "+label+((": "+str(detail)[:300]) if not condition else ""),flush=True)

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def test(browser,url,label,size,mobile=False):
    ctx=browser.new_context(viewport=size,device_scale_factor=1,
                            is_mobile=mobile,has_touch=mobile,
                            reduced_motion="reduce")
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e: errors.append(str(e)))
    page.goto(url,wait_until="domcontentloaded")
    page.wait_for_function("()=>!!window.__roboQA",timeout=10000)
    check(label+" page title", "ロボ・サルベージ" in page.title())
    check(label+" initial modal", page.locator("#overlay").is_visible())
    check(label+" four starting parts",page.locator("#playerParts .partRow").count()==4)
    check(label+" randomized foe has four parts",page.locator("#enemyParts .partRow").count()==4)
    check(label+" start control",page.locator("#startBtn").is_visible())
    page.locator("#startBtn").click()
    page.wait_for_timeout(500)
    info=page.evaluate("()=>window.__roboQA()")
    check(label+" fighting started",info["state"]=="fight",info["state"])
    check(label+" round 1",info["wave"]==1,info["wave"])
    check(label+" differing robot positions",info["player"]["x"]<info["enemy"]["x"])
    check(label+" valid enemy loadout",set(info["enemy"]["load"])=={"weapon","armor","legs","core"})
    before=info["shotsFired"]
    if mobile:
        check("mobile joystick visible",page.locator("#joystick").is_visible())
        check("mobile FIRE button visible",page.locator("#fireTouch").is_visible())
        check("mobile DASH button visible",page.locator("#dashTouch").is_visible())
        rect=page.locator("#joystick").bounding_box()
        cx=rect["x"]+rect["width"]/2;cy=rect["y"]+rect["height"]/2
        page.mouse.move(cx,cy)
        page.mouse.down()
        page.mouse.move(cx+31,cy+2,steps=3)
        page.wait_for_timeout(700)
        page.mouse.up()
        moved=page.evaluate("()=>window.__roboQA().player.x")
        check("mobile joystick moves player",moved>info["player"]["x"]+5,(moved,info["player"]["x"]))
        btn=page.locator("#fireTouch").bounding_box()
        page.mouse.move(btn["x"]+btn["width"]/2,btn["y"]+btn["height"]/2)
        page.mouse.down()
        page.wait_for_timeout(560)
        page.mouse.up()
    else:
        page.keyboard.down("KeyD")
        page.wait_for_timeout(500)
        page.keyboard.up("KeyD")
        moved=page.evaluate("()=>window.__roboQA().player.x")
        check("desktop WASD moves player",moved>info["player"]["x"]+5,(moved,info["player"]["x"]))
        page.keyboard.down("Space")
        page.wait_for_timeout(540)
        page.keyboard.up("Space")
    after=page.evaluate("()=>window.__roboQA()")
    check(label+" firing shoots projectiles",after["shotsFired"]>before,
          {"before":before,"after":after["shotsFired"]})
    if not mobile:
        page.keyboard.press("ShiftLeft")
        page.wait_for_timeout(80)
        current=page.evaluate("()=>window.__roboQA()")
        check("desktop dash triggers cooldown",current["player"]["dashCooldown"]>0)
    page.wait_for_timeout(300)
    check(label+" JavaScript runtime errors",not errors,errors)
    check(label+" no page horizontal overflow",
          page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+2"),
          page.evaluate("()=>[document.documentElement.scrollWidth,innerWidth]"))
    page.screenshot(path=str(OUT/(label+"-prototype.png")),full_page=True)
    if not mobile:
        # Use the exact damage/victory path for an integration test, without
        # waiting for a potentially long random AI fight.
        current = page.evaluate("()=>window.__roboQA()")
        weapon_from_foe = current["enemy"]["load"]["weapon"]
        original_armor = current["player"]["load"]["armor"]
        hook_exists = page.evaluate("()=>!!window.__roboQATest?.defeatEnemy")
        check("QA victory test hook enabled only in automation", hook_exists)
        if hook_exists:
            page.evaluate("()=>window.__roboQATest.defeatEnemy()")
            page.wait_for_timeout(150)
            loot=page.evaluate("()=>window.__roboQA()")
            check("victory shows loot selection",loot["state"]=="loot",loot["state"])
            check("exactly four defeated enemy part choices",loot["lootCards"]==4,loot["lootCards"])
            page.screenshot(path=str(OUT/"loot-selection.png"),full_page=True)
            page.locator('[data-loot="weapon"]').click()
            page.wait_for_timeout(200)
            after_loot=page.evaluate("()=>window.__roboQA()")
            check("one loot selection advances round",after_loot["wave"]==2 and after_loot["state"]=="fight",
                  {"wave":after_loot["wave"],"state":after_loot["state"]})
            check("chosen weapon copied from defeated enemy",
                  after_loot["player"]["load"]["weapon"]==weapon_from_foe,
                  {"expected":weapon_from_foe,"actual":after_loot["player"]["load"]["weapon"]})
            check("other three parts not changed",
                  after_loot["player"]["load"]["armor"]==original_armor)
            check("loot selection is dismissed after one choice",
                  page.locator("#overlay").is_hidden())
    ctx.close()

def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url=f"http://127.0.0.1:{server.server_port}/games/robo-salvage/"
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=os.environ.get("CHROMIUM_EXECUTABLE") or None,args=["--no-sandbox","--disable-dev-shm-usage"])
            try:
                test(browser,url,"desktop",{"width":1366,"height":900})
                test(browser,url,"mobile",{"width":390,"height":844},True)
            finally: browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    result={"game_id":"robo-salvage","checks":checks,
            "passed":sum(c["passed"] for c in checks),
            "total":len(checks),"success":all(c["passed"] for c in checks),
            "scope":"basic browser controls only; full run balancing requires human play"}
    (OUT/"test-results.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in ["passed","total","success"]}),flush=True)
    return 0 if result["success"] else 1
if __name__=="__main__":
    sys.exit(main())

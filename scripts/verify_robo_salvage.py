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
    get=lambda:page.evaluate("()=>window.__roboQA()")
    hook=lambda name,*args:page.evaluate(
        "({name,args}) => window.__roboQATest[name](...args)",
        {"name":name,"args":list(args)})
    check(label+" page title","ロボ・サルベージ" in page.title())
    check(label+" initial modal",page.locator("#overlay").is_visible())
    check(label+" four player parts",page.locator("#playerParts .partRow").count()==4)
    check(label+" four enemy parts",page.locator("#enemyParts .partRow").count()==4)
    check(label+" start button",page.locator("#startBtn").is_visible())
    frame=page.locator("#arenaFrame").bounding_box()
    check(label+" full viewport arena",
          bool(frame) and abs(frame["x"])<2 and abs(frame["y"])<2 and
          abs(frame["width"]-size["width"])<2 and abs(frame["height"]-size["height"])<2,frame)
    page.locator("#startBtn").click()
    page.wait_for_timeout(200)
    start=get()
    check(label+" game starts on a three-way route",start["state"]=="route",start["state"])
    check(label+" exactly three offered nodes",len(start["routeOptions"])==3,
          start["routeOptions"])
    check(label+" normal battle always available","fight" in start["routeOptions"])
    check(label+" route converges after ten nodes",page.locator(".routeDot").count()==10)
    check(label+" starts with no gold",start["gold"]==0)
    check(label+" player HP doubled",start["player"]["maxHp"]>=240,
          start["player"]["maxHp"])
    check(label+" 15 available arena layouts",start["arenaLayoutCount"]==15)
    check(label+" each layout differs",len(set(hook("sampleLayouts")))==15)

    # Equipment drawer opens above the map and pauses combat.
    check(label+" hamburger visible",page.locator("#menuBtn").is_visible())
    page.locator("#menuBtn").click()
    page.wait_for_timeout(270)
    check(label+" drawer opens",page.locator("#sidePanel").is_visible())
    check(label+" menu pauses",get()["menuOpen"])
    check(label+" gold and progress visible inside drawer",
          page.locator("#goldText").is_visible() and page.locator("#depthText").is_visible())
    page.locator("#menuClose").click()
    check(label+" drawer closes",page.locator("#sidePanel").is_hidden())

    page.screenshot(path=str(OUT/(label+"-route.png")),full_page=True)
    page.locator('[data-route="fight"]').click()
    page.wait_for_timeout(350)
    fight=get()
    check(label+" selected battle started",fight["state"]=="fight")
    check(label+" enemy HP doubled",fight["enemy"]["maxHp"]>=180,
          fight["enemy"]["maxHp"])
    check(label+" enemy random four-part loadout",
          set(fight["enemy"]["load"])=={"weapon","armor","legs","core"})
    check(label+" combat screen lacks text HUD",page.locator(".controls").is_hidden())
    before=fight["shotsFired"]
    if mobile:
        check("mobile joystick visible",page.locator("#joystick").is_visible())
        check("mobile FIRE visible",page.locator("#fireTouch").is_visible())
        check("mobile DASH visible",page.locator("#dashTouch").is_visible())
        rect=page.locator("#joystick").bounding_box()
        cx=rect["x"]+rect["width"]/2;cy=rect["y"]+rect["height"]/2
        page.mouse.move(cx,cy);page.mouse.down()
        page.mouse.move(cx,cy-31,steps=3)
        page.wait_for_timeout(420);page.mouse.up()
        check("mobile joystick moves toward enemy",
              get()["player"]["x"]>fight["player"]["x"]+4)
        rect=page.locator("#fireTouch").bounding_box()
        page.mouse.move(rect["x"]+rect["width"]/2,rect["y"]+rect["height"]/2)
        page.mouse.down();page.wait_for_timeout(400);page.mouse.up()
    else:
        page.keyboard.down("KeyD");page.wait_for_timeout(330);page.keyboard.up("KeyD")
        check("desktop WASD moves robot",get()["player"]["x"]>fight["player"]["x"]+5)
        page.keyboard.down("Space");page.wait_for_timeout(400);page.keyboard.up("Space")
    check(label+" firing works",get()["shotsFired"]>before)
    page.screenshot(path=str(OUT/(label+"-fight.png")),full_page=True)

    # Heal 30% of MAX HP on winning, then obtain exactly one part.
    starting=get()
    hook("setHealth",starting["player"]["maxHp"]*.35)
    hurt=get()
    foe_weapon=hurt["enemy"]["load"]["weapon"]
    original_armor=hurt["player"]["load"]["armor"]
    hook("defeatEnemy")
    page.wait_for_timeout(130)
    result=get()
    expected=min(hurt["player"]["maxHp"],
                 hurt["player"]["hp"]+__import__("math").ceil(hurt["player"]["maxHp"]*.30))
    check(label+" win enters loot",result["state"]=="loot",result["state"])
    check(label+" 30% post-combat recovery",
          abs(result["player"]["hp"]-expected)<=1, (result["player"]["hp"],expected))
    check(label+" battle gold received",result["gold"]>0,result["gold"])
    check(label+" four available loot parts",result["lootCards"]==4)
    check(label+" skip-for-gold button exists",page.locator("#skipLoot").is_visible())
    page.locator('[data-loot="weapon"]').click()
    after=get()
    check(label+" taking one part advances route",after["depth"]==1 and after["state"]=="route",
          (after["depth"],after["state"]))
    check(label+" defeated weapon was equipped",
          after["player"]["load"]["weapon"]==foe_weapon)
    check(label+" other armor remains intact",
          after["player"]["load"]["armor"]==original_armor)

    # Second battle: salvage rather than equip; gets additional gold.
    page.locator('[data-route="fight"]').click()
    hook("defeatEnemy")
    page.wait_for_timeout(130)
    gold_before_skip=get()["gold"]
    page.locator("#skipLoot").click()
    after_skip=get()
    check(label+" skip advances one node",after_skip["depth"]==2 and after_skip["state"]=="route")
    check(label+" skip earns extra gold",after_skip["gold"]>gold_before_skip)

    # Shopping: buy upgrades, a replacement part, and a repair, then leave.
    hook("setGold",2000)
    hook("setHealth",get()["player"]["maxHp"]*.42)
    hook("selectNode","shop")
    check(label+" shop node opens",get()["state"]=="shop")
    check(label+" shop sells equipment upgrades",page.locator('[data-shop="upgrade"]').count()==4)
    check(label+" shop sells replacement parts",page.locator('[data-shop="offer"]').count()==2)
    check(label+" shop sells repairs",page.locator('[data-shop="repair"]').count()==1)
    first=get()
    page.screenshot(path=str(OUT/(label+"-shop.png")),full_page=True)
    page.locator('[data-shop="upgrade"][data-arg="weapon"]').click()
    upgraded=get()
    check(label+" upgrade increases weapon level",
          upgraded["player"]["load"]["weapon"]["lv"]==first["player"]["load"]["weapon"]["lv"]+1)
    check(label+" upgrade spends gold",upgraded["gold"]<first["gold"])
    page.locator('[data-shop="offer"][data-arg="0"]').click()
    purchased=get()
    check(label+" part replacement spends gold",purchased["gold"]<upgraded["gold"])
    before_heal=purchased["player"]["hp"]
    page.locator('[data-shop="repair"]').click()
    check(label+" repair heals robot",get()["player"]["hp"]>before_heal)
    page.locator("#leaveShop").click()
    check(label+" leaving shop advances route",get()["state"]=="route" and get()["depth"]==3)

    hook("setHealth",get()["player"]["maxHp"]*.3)
    hook("selectNode","rest")
    check(label+" rest reveals completion screen",get()["state"]=="nodeResult")
    check(label+" rest heals",get()["player"]["hp"]>=get()["player"]["maxHp"]*.70)
    page.locator("#nodeContinue").click()
    hook("selectNode","event")
    check(label+" three event rewards",page.locator('[data-event]').count()==3)
    previous=get()["player"]["load"]
    page.locator('[data-event="upgrade"]').click()
    upgraded=get()["player"]["load"]
    check(label+" event upgrades a single part",
          sum(upgraded[k]["lv"]>previous[k]["lv"] for k in previous)==1)
    page.locator("#nodeContinue").click()
    prev_gold=get()["gold"]
    hook("selectNode","cache")
    check(label+" supply cache gives gold",get()["gold"]>prev_gold)
    page.locator("#nodeContinue").click()
    hook("selectNode","elite")
    elite=get()
    check(label+" elite is a real harder encounter",elite["state"]=="fight"
          and elite["currentNode"]=="elite")
    hook("defeatEnemy")
    page.locator("#skipLoot").click()
    check(label+" seven nodes completed",get()["depth"]==7)

    # Finish the actual 10-node route, with three more normal encounters.
    # This checks natural convergence rather than cheating the route position.
    remaining_layouts=[]
    for step in range(7,10):
        before=get()
        remaining_layouts.append(before["arenaLayout"])
        page.locator('[data-route="fight"]').click()
        check(label+f" node {step+1}: actual fight started",get()["state"]=="fight")
        hook("defeatEnemy")
        check(label+f" node {step+1}: victory offers loot",get()["state"]=="loot")
        page.locator("#skipLoot").click()
        check(label+f" node {step+1}: completed",get()["depth"]==step+1)
    check(label+" last three arenas are distinct",len(set(remaining_layouts))==3)
    check(label+" naturally converges to one boss after ten nodes",
          get()["depth"]==10 and get()["routeOptions"]==["boss"])
    check(label+" boss is the only final choice",page.locator('[data-route="boss"]').count()==1)
    page.locator('[data-route="boss"]').click()
    check(label+" boss encounter started",get()["currentNode"]=="boss" and get()["state"]=="fight")
    hook("defeatEnemy")
    check(label+" boss victory finishes run",get()["state"]=="victory" and get()["bossCleared"])
    check(label+" final screen can start again",page.locator("#newRun").is_visible())

    check(label+" no JavaScript errors",not errors,errors)
    check(label+" no horizontal overflow",
          page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+2"))
    check(label+" no vertical overflow",
          page.evaluate("()=>document.documentElement.scrollHeight<=innerHeight+2"))
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

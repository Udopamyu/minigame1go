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
    if mobile:
        check(label+" joystick hidden behind route-selection modal",
              page.locator("#joystick").is_hidden())
        check(label+" fire button hidden while selecting route",
              page.locator("#fireTouch").is_hidden())
    check(label+" exactly three offered nodes",len(start["routeOptions"])==3,
          start["routeOptions"])
    check(label+" normal battle always available","fight" in start["routeOptions"])
    check(label+" map shows 10 tiers of five nodes",
          page.locator("#mapScroll .map-node:not(.boss)").count()==50)
    check(label+" graph has connected visible routes",
          page.locator("#mapScroll .map-edge").count()>=100)
    check(label+" boss shown at top",page.locator("#mapScroll .map-node.boss").count()==1)
    check(label+" three connected playable map nodes",
          page.locator("#mapScroll .map-node.current:not(.boss)").count()==3)
    check(label+" three legal adjacent choices",
          sorted(x["lane"] for x in start["routeCandidates"])==[1,2,3])
    check(label+" full run graph pre-generated",
          len(start["routeGraph"])==10 and all(len(row)==5 for row in start["routeGraph"]))
    check(label+" all map tiers offer ordinary fights",
          all(sum(t in ("fight","fight2") for t in row)>=3 for row in start["routeGraph"]))
    check(label+" all possible connected edges match adjacency",
          page.evaluate("""() => [...document.querySelectorAll('#mapScroll .map-edge')].length >= 125"""))
    check(label+" starts with no gold",start["gold"]==0)
    check(label+" player HP doubled",start["player"]["maxHp"]>=240,
          start["player"]["maxHp"])
    check(label+" 15 available arena layouts",start["arenaLayoutCount"]==15)
    check(label+" twenty synergies available",
          start["synergyCount"]==20,start["synergyCount"])
    check(label+" sixteen tactical enemy archetypes available",
          start["enemyArchetypeCount"]==16,start["enemyArchetypeCount"])
    builds=hook("enemyBuilds")
    check(label+" all enemy archetypes activate a combo",
          len(builds)==16 and all(len(b["combinations"])>=1 for b in builds),
          builds)
    check(label+" starting pulse+spark build activates synergy",
          "plasma-loop" in start["playerSynergies"],start["playerSynergies"])
    check(label+" pixel mode is active",start["pixelMode"] is True,start["pixelMode"])
    check(label+" fullscreen is rasterized to a smaller pixel grid",
          start["pixelBuffer"]["width"]>0
          and start["pixelBuffer"]["width"]<frame["width"]*.8,
          start["pixelBuffer"])
    for combo,parts in (
        ("moving-fortress",{"armor":"fortress","legs":"crawler"}),
        ("burn-engine",{"weapon":"burst","core":"blaze"}),
        ("missile-platform",{"weapon":"missile","legs":"tank"}),
        ("reactive-aegis",{"armor":"reactive","core":"aegis"}),
        ("light-escape",{"armor":"feather","legs":"spider"}),
        ("salvo-control",{"weapon":"burst","core":"rapid"}),
    ):
        info=hook("inspectBuild",parts)
        check(label+" synergy "+combo+" activates",
              info is not None and combo in info["ids"],info)
    basic=hook("inspectBuild",{"weapon":"burst","core":"spark"})
    offense=hook("inspectBuild",{"weapon":"burst","core":"blaze"})
    check(label+" build synergy actually changes weapon damage",
          offense["damage"]>basic["damage"],
          {"base":basic["damage"],"combo":offense["damage"]})
    check(label+" all seven weapons have distinct impact traits",
          set(start["weaponTraits"])=={"pulse","shot","rail","missile","micro","burst","slug"},
          start["weaponTraits"])
    check(label+" four interactive arena hazard types",
          set(start["hazardKinds"])=={"shock","frost","repair","rotor"})
    check(label+" all four hazard types appear across stages",
          set(hook("sampleHazardKinds"))=={"shock","frost","repair","rotor"})
    check(label+" expanded 28 distinct collectible parts",
          all(start["partCounts"].get(slot)==7 for slot in ("weapon","armor","legs","core")),
          start["partCounts"])
    check(label+" six tactical enemy roles available",
          set(start["roles"])=={"skirmisher","charger","sniper","flanker","guardian","boss"},
          start["roles"])
    check(label+" each layout differs",len(set(hook("sampleLayouts")))==15)
    shapes=hook("sampleLayoutShapes")
    check(label+" new arenas use significantly different topology",
          len(shapes)==15 and len({x["count"] for x in shapes})>=5
          and len({x["area"] for x in shapes})>=9,
          [(x["layout"],x["count"],x["area"]) for x in shapes])
    check(label+" no arena is just three crates",
          all(x["count"]>=5 for x in shapes),
          [x["count"] for x in shapes])
    access=hook("sampleArenaAccess")
    check(label+" five irregular playfield shapes",
          len(set(x["type"] for x in access))==5)
    check(label+" player and enemy safe at spawn for all arenas",
          all(x["playerSafe"] and x["enemySafe"] for x in access),access)
    check(label+" all fifteen arenas have continuous navigable combat routes",
          len(access)==15 and all(x["reachable"] for x in access),access)

    # Equipment drawer opens above the map and pauses combat.
    check(label+" hamburger visible",page.locator("#menuBtn").is_visible())
    page.locator("#menuBtn").click()
    page.wait_for_timeout(270)
    check(label+" drawer opens",page.locator("#sidePanel").is_visible())
    check(label+" active synergies shown in equipment menu",
          page.locator("#playerParts .synergyEntry").count()>=1)
    check(label+" synergy descriptions are readable",
          "プラズマ" in page.locator("#playerParts .synergySummary").inner_text())
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
    check(label+" chosen path is recorded",
          len(fight["chosenNodes"])==1 and fight["chosenNodes"][0]["depth"]==0,
          fight["chosenNodes"])
    check(label+" enemy HP doubled",fight["enemy"]["maxHp"]>=155,
          fight["enemy"]["maxHp"])
    check(label+" enemy random four-part loadout",
          set(fight["enemy"]["load"])=={"weapon","armor","legs","core"})
    check(label+" enemy has distinct tactical behaviour",
          fight["enemy"]["role"] in ("skirmisher","charger","sniper","flanker","guardian"),
          fight["enemy"]["role"])
    if fight["enemyArchetype"]:
        check(label+" encountered archetype has synergistic build",
              len(fight["enemySynergies"])>=1,fight["enemySynergies"])
    check(label+" combat screen lacks text HUD",page.locator(".controls").is_hidden())
    check(label+" battle spawns active hazards",len(fight["hazards"])>=2)
    check(label+" material-specific cover durability",
          len(fight["coverDurability"])>0 and
          all(0<c["hp"]<=c["maxHp"] and c["maxHp"]>=70
              for c in fight["coverDurability"]),
          fight["coverDurability"])
    breached=hook("testBreakCover")
    check(label+" shooting cover opens tactical passage",
          bool(breached) and breached["removed"] and
          breached["after"]==breached["before"]-1 and breached["unblocked"],
          breached)
    for name,key in (("pulse","stun"),("rail","sunder"),("micro","sunder"),
                     ("burst","burn"),("slug","stun"),("shot",None),("missile",None)):
        effect=hook("testWeaponTrait",name)
        check(label+" "+name+" weapon impact logic",
              effect is not None and (key is None or effect[key]>0),effect)
    for kind in ("shock","frost","repair","rotor"):
        effect=hook("testHazard",kind)
        passed=(effect["slow"]>0 if kind=="frost" else
                effect["hpDelta"]>0 if kind=="repair" else effect["hpDelta"]<0)
        check(label+" interactive "+kind+" stage hazard",passed,effect)
    dodge=hook("testEnemyDodge")
    check(label+" flanker AI reacts to incoming projectile",
          bool(dodge) and dodge["triggered"] and dodge["distance"]>1,dodge)
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
    check(label+" loot choices display live statistical comparisons",
          page.locator('[data-loot="weapon"] .compareStats').count()==1)
    check(label+" skip-for-gold button exists",page.locator("#skipLoot").is_visible())
    page.locator('[data-loot="weapon"]').click()
    after=get()
    check(label+" continuing shows connected next nodes",
          sorted(x["lane"] for x in after["routeCandidates"]) ==
          ([0,1,2] if after["currentLane"]<=1 else
           [2,3,4] if after["currentLane"]>=3 else
           [after["currentLane"]-1,after["currentLane"],after["currentLane"]+1]))
    check(label+" taken path appears highlighted",
          page.locator("#mapScroll .map-edge.done").count()>0)
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
    check(label+" shop offers show swap comparison",
          page.locator('[data-shop="offer"] .compareStats').count()==2)
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
    check(label+" ten connected choices recorded",
          len(get()["chosenNodes"])==10)
    check(label+" naturally converges to one boss after ten nodes",
          get()["depth"]==10 and get()["routeOptions"]==["boss"])
    check(label+" boss is the only final choice",page.locator('[data-route="boss"]').count()==1)
    page.locator('[data-route="boss"]').click()
    check(label+" boss encounter started",get()["currentNode"]=="boss" and get()["state"]=="fight")
    check(label+" boss has unique tactical profile",
          get()["enemy"]["role"]=="boss")
    check(label+" boss opens in first combat phase",get()["bossPhase"]==1)
    for pattern,minimum in (("fan",7),("ring",14),("beam",0),("salvo",5)):
        attack=hook("testBossPattern",pattern)
        check(label+" boss telegraphed "+pattern+" attack resolves",
              attack and attack["fired"]==1 and attack["bulletsAdded"]>=minimum,
              attack)
    check(label+" boss attack sequence counts four patterns",
          get()["bossAttackCount"]>=4,get()["bossAttackCount"])
    hook("setBossHpRatio",.42)
    check(label+" injured boss enters second phase",get()["bossPhase"]==2)
    hook("defeatEnemy")
    check(label+" boss victory finishes run",get()["state"]=="victory" and get()["bossCleared"])
    check(label+" final screen can start again",page.locator("#newRun").is_visible())

    # Every run is ironman: losing clears equipped parts and all gold.
    page.locator("#newRun").click()
    hook("selectNode","fight")
    check(label+" next run enters battle",get()["state"]=="fight")
    hook("setGold",430)
    hook("equipTestPart","weapon","rail")
    check(label+" test run had a rare weapon",
          get()["player"]["load"]["weapon"]["id"]=="rail")
    check(label+" test run had gold",
          get()["gold"]==430)
    check(label+" losing battle triggers permadeath",hook("defeatPlayer") is True)
    after_death=get()
    check(label+" death removes all gold",after_death["gold"]==0)
    check(label+" death resets all equipped parts",
          all(after_death["player"]["load"][slot]["lv"]==1 and
              after_death["player"]["load"][slot]["tier"]==1 for slot in
              ("weapon","armor","legs","core"))
          and after_death["player"]["load"]["weapon"]["id"]=="pulse")
    check(label+" death result states all gold and equipment lost",
          "すべて失いました" in page.locator("#dialog").inner_text())
    page.locator("#againBtn").click()
    check(label+" restarting after death begins new zero-gold run",
          get()["gold"]==0 and get()["depth"]==0 and get()["state"]=="route")

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

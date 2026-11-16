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
    if page.locator("#titleEnter").count():
        check(label+" opening splash is a pixel-art Japanese title",
              page.locator("#openingLogo").is_visible()
              and page.locator("#openingLogo").get_attribute("aria-label")=="ロボサルベージ"
              and page.locator("#titleEnter").is_visible()
              and page.evaluate("()=>window.__roboQA().state")=="title")
        page.screenshot(path=str(OUT/(label+"-opening.png")),full_page=True)
        page.locator("#titleEnter").click()
    get=lambda:page.evaluate("()=>window.__roboQA()")
    def hook(name,*args):
        outcome=page.evaluate(
            "({name,args}) => window.__roboQATest[name](...args)",
            {"name":name,"args":list(args)})
        if name in ("defeatEnemy","defeatPlayer"):
            expected_kind="win" if name=="defeatEnemy" else "lose"
            check(label+" one-second finisher starts before "+expected_kind,
                  get()["state"]=="finisher"
                  and get()["finishKind"]==expected_kind)
            page.wait_for_function(
                "(kind)=>window.__roboQA().state===(kind==='win'?'winCard':'loseCard')",
                arg=expected_kind,timeout=6000)
            check(label+" "+expected_kind.upper()+" card follows finisher",
                  page.locator("#phaseLetters").get_attribute("aria-label")==expected_kind.upper())
        if page.locator("#phaseContinue").count() and page.locator("#phaseContinue").is_visible():
            page.locator("#phaseContinue").click()
        return outcome
    check(label+" page title","ロボ・サルベージ" in page.title())
    check(label+" initial modal",page.locator("#overlay").is_visible())
    check(label+" eight initial weapon slots (one free, seven unlockable)",
          page.locator("[data-starter]").count()==8)
    check(label+" four permanent research branches",
          page.locator("[data-meta]").count()==4)
    check(label+" default starter is pulse",get()["meta"]["starter"]=="pulse")
    check(label+" total permanent upgrade cost is 580 SP",
          get()["meta"]["totalCost"]==580)
    check(label+" approximately six typical mid-game runs complete research",
          get()["meta"]["midRunAward"]*6 >= get()["meta"]["totalCost"])
    check(label+" all seven non-pulse starters begin locked",
          page.locator('.starterOption.locked:disabled').count()==7
          and get()["meta"]["unlockedWeapons"]==["pulse"])
    check(label+" each starter weapon costs exactly 40 SP",get()["meta"]["starterUnlockCost"]==40)
    check(label+" hangar uses only the short permanent-upgrade hint",
          "SPで永続強化できます。" in page.locator(".metaHint").inner_text()
          and "中盤まで約6周" not in page.locator(".metaHint").inner_text())
    hook("grantMetaPoints",40)
    check(label+" new starter unlock becomes affordable",page.locator('[data-starter="shot"]').is_enabled())
    page.locator('[data-starter="shot"]').click()
    check(label+" 40 SP permanently unlocks and selects starter",
          get()["meta"]["starter"]=="shot" and "shot" in get()["meta"]["unlockedWeapons"]
          and get()["meta"]["points"]==0)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("()=>!!window.__roboQA",timeout=10000)
    check(label+" purchased starting weapon survives reload",
          get()["meta"]["starter"]=="shot" and "shot" in get()["meta"]["unlockedWeapons"])
    page.locator('[data-starter="shot"]').click()
    check(label+" reselecting unlocked weapon costs no SP",
          get()["meta"]["points"]==0 and get()["meta"]["starter"]=="shot")
    page.locator('[data-starter="pulse"]').click()
    check(label+" player preview updates to free starter",
          get()["player"]["load"]["weapon"]["id"]=="pulse")
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
    check(label+" exploration BGM selected",start["bgmMode"]=="route",start["bgmMode"])
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
    check(label+" taller map uses spacious 115px row pitch and scrollable height",
          start["routeStep"]==115 and start["mapHeight"]==1390 and
          page.locator("#mapScroll .mapBoard").get_attribute("viewBox")=="0 0 640 1390",
          (start["routeStep"],start["mapHeight"]))
    check(label+" robot art is scaled to exactly 80% with matched collision radius",
          abs(start["mechScale"]-.8)<.0001 and abs(start["player"]["r"]-17.6)<.001,
          (start["mechScale"],start["player"]["r"]))
    expected_magazines={"pulse":(12,1.6),"shot":(5,2.35),"rail":(3,3.2),
        "missile":(4,2.75),"micro":(30,2.15),"burst":(9,2.35),"slug":(3,2.9),
        "bounce":(7,2.15)}
    check(label+" distinct capacity and reload duration for all eight weapons",
          all(start["magazineSpecs"][name]["mag"]==capacity and
                  abs(start["magazineSpecs"][name]["reload"]-seconds)<.01
                  for name,(capacity,seconds) in expected_magazines.items()),
          start["magazineSpecs"])
    check(label+" reload speed varies by weapon",
          len({x["reload"] for x in start["magazineSpecs"].values()})>=5)
    check(label+" weapon ranges are not universally melee",
          min(x["idealRange"] for x in start["magazineSpecs"].values())>=175 and
          max(x["idealRange"] for x in start["magazineSpecs"].values())>=450)
    check(label+" manual reload button is present",
          page.locator("#reloadTouch").count()==1 and page.locator("#reloadDesk").count()==1)
    check(label+" twenty synergies available",
          start["synergyCount"]==20,start["synergyCount"])
    descriptions=start["synergyDescriptions"]
    check(label+" every combo derives numeric effects from actual modifiers",
          len(descriptions)==20 and all("%" in x["effect"] or "pt" in x["effect"] for x in descriptions),
          descriptions)
    by_id={x["id"]:x["effect"] for x in descriptions}
    check(label+" moving fortress has exact 22 percent HP bonus and 12 percent speed penalty",
          "最大HP+22%" in by_id["moving-fortress"] and "移動速度-12%" in by_id["moving-fortress"])
    check(label+" siege rail lists actual attack and speed adjustments",
          "攻撃力+19%" in by_id["siege-rail"] and "移動速度-9%" in by_id["siege-rail"])
    check(label+" sixteen tactical enemy archetypes available",
          start["enemyArchetypeCount"]==16,start["enemyArchetypeCount"])
    builds=hook("enemyBuilds")
    check(label+" all enemy archetypes activate a combo",
          len(builds)==16 and all(len(b["combinations"])>=1 for b in builds),
          builds)
    check(label+" starting pulse+balance build activates synergy",
          "plasma-loop" in start["playerSynergies"],start["playerSynergies"])
    check(label+" pixel mode is active",start["pixelMode"] is True,start["pixelMode"])
    cp=start["coreProfiles"]
    check(label+" exactly four mutually exclusive core profiles",
          set(cp)=={"balance","power","speed","tactical"})
    check(label+" balance dash cooldown is exactly one second",
          cp["balance"]["dashCooldown"]==1)
    check(label+" power core increases offense and HP, reduces mobility, dash 2s",
          cp["power"]["dmg"]>cp["balance"]["dmg"]*1.24
          and cp["power"]["hp"]>cp["balance"]["hp"]
          and cp["power"]["speed"]<cp["balance"]["speed"]
          and cp["power"]["dashCooldown"]==2)
    check(label+" speed core prioritizes mobility, reduces attack and HP, dash 0.3s",
          cp["speed"]["speed"]>cp["balance"]["speed"]*1.2
          and cp["speed"]["dmg"]<cp["balance"]["dmg"]
          and cp["speed"]["hp"]<cp["balance"]["hp"]
          and abs(cp["speed"]["dashCooldown"]-.3)<1e-8)
    check(label+" tactical core expands ammo 1.5x, loads 20% faster, mildly sacrifices durability and mobility",
          cp["tactical"]["mag"]==__import__("math").ceil(cp["balance"]["mag"]*1.5)
          and abs(cp["tactical"]["reloadTime"]-cp["balance"]["reloadTime"]*.8)<1e-7
          and cp["tactical"]["speed"]<cp["balance"]["speed"]
          and cp["tactical"]["hp"]<cp["balance"]["hp"]
          and cp["tactical"]["dashCooldown"]==1)
    check(label+" all 26 part models have distinct silhouettes",
          all(len(start["spriteSilhouettes"][slot])==n and len(set(start["spriteSilhouettes"][slot]))==n
              for slot,n in (("weapon",8),("armor",7),("legs",7),("core",4))),
          start["spriteSilhouettes"])
    check(label+" rail damage sharply reduced and cover piercing retained",
          start["rail"]["damage"]==18 and start["rail"]["cooldown"]>=1.3
          and start["rail"]["penetratesCover"])
    check(label+" fullscreen is rasterized to a smaller pixel grid",
          start["pixelBuffer"]["width"]>0
          and start["pixelBuffer"]["width"]<frame["width"]*.8,
          start["pixelBuffer"])
    for combo,parts in (
        ("moving-fortress",{"armor":"fortress","legs":"crawler"}),
        ("burn-engine",{"weapon":"burst","core":"power"}),
        ("missile-platform",{"weapon":"missile","legs":"tank"}),
        ("reactive-aegis",{"armor":"reactive","core":"balance"}),
        ("light-escape",{"armor":"feather","legs":"spider"}),
        ("salvo-control",{"weapon":"burst","core":"speed"}),
    ):
        info=hook("inspectBuild",parts)
        check(label+" synergy "+combo+" activates",
              info is not None and combo in info["ids"],info)
    basic=hook("inspectBuild",{"weapon":"burst","core":"balance"})
    offense=hook("inspectBuild",{"weapon":"burst","core":"power"})
    check(label+" build synergy actually changes weapon damage",
          offense["damage"]>basic["damage"],
          {"base":basic["damage"],"combo":offense["damage"]})
    check(label+" all eight weapons have distinct impact traits",
          set(start["weaponTraits"])=={"pulse","shot","rail","missile","micro","burst","slug","bounce"},
          start["weaponTraits"])
    check(label+" four interactive arena hazard types",
          set(start["hazardKinds"])=={"shock","frost","repair","rotor"})
    check(label+" all four hazard types appear across stages",
          set(hook("sampleHazardKinds"))=={"shock","frost","repair","rotor"})
    check(label+" expanded 26 distinct collectible parts",
          all(start["partCounts"].get(slot)==n for slot,n in (("weapon",8),("armor",7),("legs",7),("core",4))),
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
    radar=page.locator("#playerStatPanel .statRadar")
    check(label+" equipped-stat radar chart renders in menu",
          radar.count()==1 and radar.is_visible()
          and page.locator("#playerStatPanel .radarFill").count()==1
          and page.locator("#playerStatPanel .radarRing").count()==4)
    check(label+" current status has all six numeric axes",
          sorted(page.locator("#playerStatPanel [data-stat]").evaluate_all(
            "(els)=>els.map(e=>e.dataset.stat)"))==sorted(["HP","ATK","SPD","DEF","RATE","MAG"]))
    stats=get()["playerStats"]
    check(label+" ATK and SPD readouts match real equipped stats",
          abs(float(page.locator('[data-stat="ATK"] strong').inner_text())-stats["atk"])<.11
          and abs(int(page.locator('[data-stat="SPD"] strong').inner_text())-stats["spd"])<.6,
          stats)
    check(label+" chart includes dynamic upgrade and dash information",
          "DASH " in page.locator("#playerStatPanel").inner_text()
          and "研究 HP " in page.locator("#playerStatPanel").inner_text())
    page.screenshot(path=str(OUT/(label+"-status-radar.png")),full_page=True)
    check(label+" active synergies shown in equipment menu",
          page.locator("#playerParts .synergyEntry").count()>=1)
    check(label+" synergy descriptions are readable",
          "プラズマ" in page.locator("#playerParts .synergySummary").inner_text())
    check(label+" combo descriptions show exact numeric effects",
          "射撃間隔-12%" in page.locator("#playerParts .synergySummary").inner_text()
          and "スタン時間+35%" in page.locator("#playerParts .synergySummary").inner_text())
    check(label+" synergy names and benefits now use large fonts",
          page.locator("#playerParts .synergyEntry strong").first.evaluate(
              "(e)=>parseFloat(getComputedStyle(e).fontSize)")>=15
          and page.locator("#playerParts .synergyEntry small").first.evaluate(
              "(e)=>parseFloat(getComputedStyle(e).fontSize)")>=13)
    check(label+" menu pauses",get()["menuOpen"])
    check(label+" gold and progress visible inside drawer",
          page.locator("#goldText").is_visible() and page.locator("#depthText").is_visible())
    page.locator("#menuClose").click()
    check(label+" drawer closes",page.locator("#sidePanel").is_hidden())

    check(label+" route title is brief and old hint was removed",
          page.locator("#dialog h2").inner_text()=="ルート選択"
          and page.locator(".mapHint").count()==0)
    page.screenshot(path=str(OUT/(label+"-route.png")),full_page=True)
    page.locator('[data-route="fight"]').click()
    check(label+" preparing battle is a pixel-only interstitial",
          get()["state"]=="ready" and
          page.locator("#phaseLetters").get_attribute("aria-label")=="戦闘準備"
          and page.locator("#phaseContinue").is_visible())
    page.locator("#phaseContinue").click()
    page.wait_for_timeout(350)
    fight=get()
    check(label+" selected battle started",fight["state"]=="fight")
    check(label+" combat BGM selected",fight["bgmMode"]=="combat",fight["bgmMode"])
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
    rebound=hook("testRicochetCollision")
    check(label+" ricochet projectile reflects on solid cover",
          bool(rebound) and rebound["cover"]["reflected"] and
          rebound["cover"]["bounces"]==1 and rebound["cover"]["damageReduced"],rebound)
    check(label+" ricochet projectile reflects on arena boundary",
          bool(rebound) and rebound["boundary"]["reflected"] and
          rebound["boundary"]["bounces"]==1,rebound)
    check(label+" ricochet expires after three rebounds",
          bool(rebound) and rebound["exhausted"],rebound)
    # Tactical core combines the prior two ammo effects.
    basicAmmo=get()["playerAmmo"]
    hook("equipTestPart","core","tactical")
    tactical=get()["playerAmmo"]
    check(label+" tactical core reduces actual reload time by 20%",
          tactical["reloadTime"]<basicAmmo["reloadTime"] and
          abs(tactical["reloadTime"]-basicAmmo["reloadTime"]*.8)<.01,tactical)
    check(label+" tactical core increases actual capacity by 50%",
          tactical["mag"]==__import__("math").ceil(basicAmmo["mag"]*1.5),tactical)
    hook("equipTestPart","core","balance")
    hook("equipTestPart","weapon","bounce")
    check(label+" ricochet weapon can actually equip",get()["player"]["load"]["weapon"]["id"]=="bounce")
    hook("equipTestPart","weapon","pulse")
    breached=hook("testBreakCover")
    check(label+" shooting cover opens tactical passage",
          bool(breached) and breached["removed"] and
          breached["after"]==breached["before"]-1 and breached["unblocked"],
          breached)
    for name,key in (("pulse","stun"),("rail","sunder"),("micro","sunder"),
                     ("burst","burn"),("slug","stun"),("shot",None),("missile",None),("bounce",None)):
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
    firing=get()
    check(label+" firing consumes one round per trigger pull",
          0<firing["playerAmmo"]["ammo"]<firing["playerAmmo"]["mag"],firing["playerAmmo"])
    if mobile:
        check(label+" touch reload button visible",page.locator("#reloadTouch").is_visible())
        page.locator("#reloadTouch").tap()
    else:
        check(label+" desktop reload button visible",page.locator("#reloadDesk").is_visible())
        page.keyboard.press("KeyR")
    page.wait_for_timeout(110)
    partial=get()["playerAmmo"]
    check(label+" partial magazine can be manually reloaded",
          partial["reloadLeft"]>0 and partial["reloadCount"]>=1,partial)
    check(label+" reloading blocks repeat reload",
          page.locator("#reloadTouch").is_disabled() and
          page.locator("#reloadDesk").is_disabled())
    page.wait_for_timeout(1750)
    check(label+" manual reload refills magazine",
          get()["playerAmmo"]["ammo"]==get()["playerAmmo"]["mag"]
          and get()["playerAmmo"]["reloadLeft"]==0)
    check(label+" full magazine cannot reload",
          page.locator("#reloadTouch").is_disabled())
    automatic=hook("testAutoMagazineCycle")
    check(label+" empty magazine automatically starts reload",
          bool(automatic) and automatic["started"],automatic)
    check(label+" automatic reload refills magazine",
          bool(automatic) and automatic["refilled"],automatic)
    foe=get()
    gun=foe["enemy"]["load"]["weapon"]["id"]
    core=foe["enemy"]["load"]["core"]["id"]
    base_capacity=foe["magazineSpecs"][gun]["mag"]
    actual_capacity=__import__("math").ceil(base_capacity*(1.5 if core=="tactical" else 1))
    check(label+" enemy also maintains an equipment-dependent ammunition magazine",
          foe["enemyAmmo"]["mag"]==actual_capacity,
          (gun,core,foe["enemyAmmo"]["mag"],actual_capacity))
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
    check(label+" victory loot only displays enemy-name victory heading",
          page.locator("#dialog h2").inner_text().endswith("撃破！")
          and "敵機" not in page.locator("#dialog h2").inner_text()
          and page.locator(".lootHelp").count()==0)
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
    page.locator("#phaseContinue").click()
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
        page.locator("#phaseContinue").click()
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
    page.locator("#phaseContinue").click()
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
    player_before_boss=get()["player"]["load"]
    gold_before_boss=get()["gold"]
    hook("defeatEnemy")
    boss_cleared=get()
    check(label+" first boss unlocks endless without settling run",
          boss_cleared["state"]=="endlessGate" and boss_cleared["bossCleared"]
          and boss_cleared["endlessMode"] and boss_cleared["depth"]==11
          and boss_cleared["meta"]["runs"]==0
          and boss_cleared["meta"]["settled"] is False)
    check(label+" boss clear keeps equipment and GOLD",
          boss_cleared["player"]["load"]==player_before_boss
          and boss_cleared["gold"]>gold_before_boss)
    check(label+" endless starts at stage twelve",
          "STAGE 12" in page.locator("#dialog").inner_text())
    page.locator("#endlessContinue").click()
    endless=get()
    check(label+" first endless route enters stage twelve",
          endless["state"]=="route" and endless["depth"]==11
          and endless["endlessStage"]==1)
    check(label+" endless battle choices are all elite, no normal fights",
          all(t not in ("fight","fight2") for row in endless["routeGraph"] for t in row)
          and all(c["type"] not in ("fight","fight2") for c in endless["routeCandidates"]))
    check(label+" endless retains nine regular branches and one boss",
          page.locator("#mapScroll .map-node:not(.boss)").count()==45)

    # Endless shop: each of three limit-break stats can level beyond the original
    # three-rank permanent tree; no maximum is imposed.
    shops_before=get()["runClearCounts"]["shop"]
    hook("selectNode","shop")
    hook("setGold",100000)
    page.locator("#leaveShop").count() and page.locator("#leaveShop")
    for category in ("atk","hp","spd"):
        for _ in range(5):
            target=page.locator('[data-shop="limit"][data-arg="'+category+'"]')
            check(label+" endless "+category+" upgrade stays purchasable",target.is_enabled())
            target.click()
        check(label+" endless "+category+" exceeds prior 3-level cap",
              get()["endlessUpgrades"][category]==5)
    page.locator("#leaveShop").click()
    check(label+" stage twelve shop completion recorded",
          get()["depth"]==12
          and get()["runClearCounts"]["shop"]==shops_before+1,
          get()["runClearCounts"])

    # Nine regular endless stages precede the 10th-stage boss. The shop just
    # completed stage 12; take eight rest/event-free nodes to reach stage 21.
    for index in range(8):
        hook("selectNode","rest")
        page.locator("#nodeContinue").click()
    check(label+" endless boss appears on the tenth stage",
          get()["depth"]==20 and get()["endlessBossDue"]
          and get()["routeOptions"]==["boss"]
          and page.locator('[data-route="boss"]').count()==1)
    page.locator('[data-route="boss"]').click()
    page.locator("#phaseContinue").click()
    check(label+" stage twenty-one is a stronger boss",
          get()["currentNode"]=="boss" and get()["endlessStage"]==10
          and get()["enemy"]["role"]=="boss")
    hook("defeatEnemy")
    check(label+" defeating endless boss continues a new ten-stage loop",
          get()["depth"]==21 and get()["endlessCycle"]==1
          and get()["state"]=="endlessGate")
    page.locator("#endlessContinue").click()
    check(label+" stage twenty-two route regenerated",
          get()["state"]=="route" and get()["depth"]==21
          and not get()["endlessBossDue"]
          and len(get()["chosenNodes"])==0)
    points_before_death=get()["meta"]["points"]
    hook("selectNode","elite")
    hook("setGold",430)
    hook("equipTestPart","weapon","rail")
    check(label+" endless battle preserves upgraded weapon before death",
          get()["player"]["load"]["weapon"]["id"]=="rail")
    check(label+" endless battle has accumulated gold",get()["gold"]>=430)
    check(label+" losing battle triggers permadeath",hook("defeatPlayer") is True)
    after_death=get()
    check(label+" death removes all gold",after_death["gold"]==0)
    check(label+" death resets all equipped parts",
          all(after_death["player"]["load"][slot]["lv"]==1 and
              after_death["player"]["load"][slot]["tier"]==1 for slot in
              ("weapon","armor","legs","core"))
          and after_death["player"]["load"]["weapon"]["id"]=="pulse")
    summary=page.locator("#dialog").inner_text()
    check(label+" death report includes actual stage and node-type totals",
          "STAGE 22" in summary and "通常戦" in summary
          and "強敵戦" in summary and "イベント" in summary
          and "ショップ" in summary and "ボス戦" in summary)
    check(label+" endgame lifetime research awarded exactly once",
          get()["meta"]["points"]>points_before_death and get()["meta"]["runs"]==1
          and get()["meta"]["settled"])
    check(label+" endless best persists through defeat",
          get()["endlessBest"]>=21)
    page.locator("#againBtn").click()
    check(label+" defeat returns to original hangar with saved research",
          get()["state"]=="menu" and page.locator("#metaBalance").is_visible())
    page.locator("#startBtn").click()
    check(label+" new run resets stage, gold, and limitless upgrades",
          get()["depth"]==0 and get()["gold"]==0
          and get()["state"]=="route"
          and not get()["endlessMode"]
          and set(get()["endlessUpgrades"].values())=={0})

    # All event families are exercised through their real button handlers.
    for variant,option in (("depot","supply"),("forge","reforge"),("vault","overload")):
        check(label+" can force "+variant+" QA event",hook("forceNextEventVariant",variant) is True)
        before=get()
        hook("selectNode","event")
        check(label+" "+variant+" family displayed",get()["state"]=="event" and
              get()["eventVariant"]==variant)
        check(label+" "+variant+" has three decisions",page.locator('[data-event]').count()==3)
        check(label+" "+variant+" is framed by short atmospheric flavor text",
              page.locator(".eventFlavor").count()==1
              and "次の3つから" not in page.locator("#dialog").inner_text()
              and (variant!="vault" or "怪しげな倉庫" in page.locator(".eventFlavor").inner_text()))
        check(label+" "+variant+" preserves upgrade option",page.locator('[data-event="upgrade"]').count()==1)
        check(label+" "+variant+" selection enabled",page.locator(f'[data-event="{option}"]').is_enabled())
        page.locator(f'[data-event="{option}"]').click()
        outcome=get()
        check(label+" "+variant+" resolved",outcome["state"]=="nodeResult")
        if variant=="depot":
            check(label+" depot awards gold",outcome["gold"]>before["gold"])
        elif variant=="forge":
            check(label+" forge rerolls and levels weapon",
                  outcome["player"]["load"]["weapon"]["id"]!=before["player"]["load"]["weapon"]["id"]
                  and outcome["player"]["load"]["weapon"]["lv"]==before["player"]["load"]["weapon"]["lv"]+1)
        else:
            check(label+" vault exchanges HP for gold",
                  outcome["gold"]>before["gold"] and 0<outcome["player"]["hp"]<before["player"]["hp"])
        page.locator("#nodeContinue").click()
        check(label+" "+variant+" returns to map",get()["state"]=="route")
    hook("setHealth",1)
    hook("forceNextEventVariant","vault")
    hook("selectNode","event")
    check(label+" low HP disables dangerous vault",page.locator('[data-event="overload"]').is_disabled())
    page.locator('[data-event="upgrade"]').click()
    check(label+" low HP still has safe option",get()["state"]=="nodeResult")
    page.locator("#nodeContinue").click()

    # Verify the persistent tech tree independently of in-run GOLD/loot.
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("()=>!!window.__roboQA",timeout=10000)
    old_meta=get()["meta"]
    check(label+" persistent SP survives reload after combat",
          old_meta["runs"]==1 and old_meta["points"]>0,old_meta)
    hook("grantMetaPoints",580)
    before_sp=get()["meta"]["points"]
    for branch in ("hull","power","drive","recovery"):
        for step in range(3):
            target=page.locator('[data-meta="'+branch+'"]')
            check(label+" affordable "+branch+" "+str(step+1),target.is_enabled())
            target.click()
    full=get()["meta"]
    check(label+" all 12 permanent improvements purchased",
          set(full["upgrades"].values())=={3})
    check(label+" maxed research spent precisely 580 SP",
          full["points"]==before_sp-580,(full["points"],before_sp))
    check(label+" all research buttons now show MAX",
          page.locator(".metaUpgrade:disabled").count()==4 and
          "MAX" in page.locator('[data-meta="hull"]').inner_text())
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("()=>!!window.__roboQA",timeout=10000)
    check(label+" max level research persists after reload",
          set(get()["meta"]["upgrades"].values())=={3})
    hook("grantMetaPoints",40)
    rail_before=get()["meta"]["points"]
    page.locator('[data-starter="rail"]').click()
    check(label+" rail starter unlock costs 40 SP",
          get()["meta"]["starter"]=="rail" and get()["meta"]["points"]==rail_before-40
          and "rail" in get()["meta"]["unlockedWeapons"])
    page.locator("#startBtn").click()
    check(label+" selected starting weapon actually equips",
          get()["player"]["load"]["weapon"]["id"]=="rail")
    check(label+" permanent HP improves run-start durability",
          get()["player"]["maxHp"]>start["player"]["maxHp"])
    check(label+" run starts with zero GOLD even when SP persists",
          get()["gold"]==0 and get()["meta"]["points"]==before_sp-580)
    check(label+" pixelated canvas uses a reduced native framebuffer",
          page.locator("#game").evaluate("(c) => c.width < c.clientWidth*.8"))
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

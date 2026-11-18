#!/usr/bin/env python3
"""Browser verification for PATROL x ROBO SALVAGE — HOVER COMBAT (v0.6).

Runs the real game in Chromium (WebGL2; SwiftShader is fine), drives it through
the normal flow and frame-stepped combat scenarios, and writes
games/patrol-robo-salvage/qa/results.json + qa/screenshots/*.png.

    python scripts/verify_patrol_salvage.py            # full run (~4-6 min)
    CHROMIUM_EXECUTABLE=/usr/bin/google-chrome python scripts/verify_patrol_salvage.py

Simulation is advanced with window.__b3QA.step() (fixed 1/60 s) so results do
not depend on the frame rate of the test machine. These are functional checks;
they do not replace a human play test on a real phone / GPU.
"""
import asyncio, collections, functools, http.server, json, math, os, pathlib, socketserver, sys, threading, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
GAME = ROOT / "games" / "patrol-robo-salvage"
OUT = GAME / "qa"
SHOTS = OUT / "screenshots"
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
BIOMES = ["waste", "desert", "snow", "mountain", "city", "river", "arena", "night"]
WEAPONS = ["pulse", "shot", "rail", "missile", "micro", "burst", "slug", "bounce"]
results = []


def check(cid, title, ok, detail):
    results.append({"id": cid, "title": title, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + cid + " — " + title + " :: " + json.dumps(detail, ensure_ascii=False)[:300])


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler = type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a, **k: None})
    handler = functools.partial(handler, directory=str(ROOT))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/games/patrol-robo-salvage/index.html"


async def open_page(p, url, w=1280, h=720, mobile=False, args=ARGS, scale=.5):
    exe = os.environ.get("CHROMIUM_EXECUTABLE") or ("/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None)
    b = await p.chromium.launch(executable_path=exe, headless=True, args=args)
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(url)
    await pg.wait_for_timeout(700)
    if await pg.evaluate("()=>!!window.__b3QA&&window.__b3QA.get().gl"):
        await pg.evaluate(f"()=>{{window.__b3QA.setTune('renderScale',{scale});window.__b3QA.setTune('autoQuality',false);window.__b3QA.setTune('autoFire',true);window.__b3QA.hold(true)}}")
    return b, pg, errs


async def step(pg, n):
    return await pg.evaluate(f"()=>window.__b3QA.step({n},1/60)")


async def frame(pg):
    return await pg.evaluate("()=>window.__b3QA.frame()")


async def to_fight(pg, tap=False):
    click = pg.tap if tap else pg.click
    await click("#titleEnter"); await click("#startBtn"); await pg.wait_for_timeout(150)
    await pg.evaluate("()=>window.__roboQATest.selectNode('fight')"); await pg.wait_for_timeout(150)
    await click("#phaseContinue"); await step(pg, 20)


async def shot(pg, name, scale=1.0):
    await pg.evaluate(f"()=>window.__b3QA.setTune('renderScale',{scale})")
    await step(pg, 1)
    await pg.screenshot(path=str(SHOTS / name))
    await pg.evaluate("()=>window.__b3QA.setTune('renderScale',.5)")


def hd(a, b):
    return math.hypot(a["x"] - b["x"], a["z"] - b["z"])


async def controls(p, url):
    b, pg, errs = await open_page(p, url)
    info = await pg.evaluate("()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c&&c.getExtension('WEBGL_debug_renderer_info');return c?c.getParameter(d?d.UNMASKED_RENDERER_WEBGL:c.RENDERER):null}")
    check("boot", "起動・WebGL2描画", await pg.evaluate("()=>window.__b3QA.get().gl") and not errs, {"renderer": info, "errors": errs})
    await shot(pg, "00_title.png")
    await to_fight(pg)
    await pg.evaluate("()=>window.__b3QA.freezeAI(true)")
    s0 = await step(pg, 60)
    check("flow", "タイトル→格納庫→ルート→戦闘準備→戦闘", s0["state"] == "fight", {"state": s0["state"], "biome": s0["biome"]})
    fr = await frame(pg)
    check("framing", "自機は画面下側、敵は中央付近", fr["visibleBoth"] and fr["playerLow"] and fr["enemyNearCenter"], fr)
    await shot(pg, "01_fight_start.png")
    yaw = s0["cam"]["yaw"]
    await pg.keyboard.down("KeyW"); s1 = await step(pg, 60); await pg.keyboard.up("KeyW")
    dx, dz = s1["player"]["x"] - s0["player"]["x"], s1["player"]["z"] - s0["player"]["z"]
    d = math.hypot(dx, dz)
    check("move_forward", "左スティック前＝視点方向へ前進", d > 150 and (dx * math.cos(yaw) + dz * math.sin(yaw)) / d > .95, {"moved": round(d), "cos": round((dx * math.cos(yaw) + dz * math.sin(yaw)) / max(d, 1), 3)})
    s2 = await step(pg, 20)
    sp = math.hypot(s2["player"]["v"][0], s2["player"]["v"][2])
    s3 = await step(pg, 60)
    drift = hd(s3["player"], s2["player"])
    check("stop", "手を離すと0.33秒以内に停止し空中静止", sp < 8 and drift < 3, {"speed_after_0.33s": round(sp, 1), "drift_1s": round(drift, 2)})
    yaw = s3["cam"]["yaw"]
    await pg.keyboard.down("KeyD"); s4 = await step(pg, 60); await pg.keyboard.up("KeyD")
    dx, dz = s4["player"]["x"] - s3["player"]["x"], s4["player"]["z"] - s3["player"]["z"]
    d = math.hypot(dx, dz); dot = (dx * -math.sin(yaw) + dz * math.cos(yaw)) / max(d, 1)
    fr = await frame(pg)
    check("strafe", "左スティック左右＝視点基準の平行移動（旋回しない）", d > 120 and dot > .9 and fr["visibleBoth"], {"moved": round(d), "dot_right": round(dot, 3), "frame": fr})
    await step(pg, 30)
    a0 = (await step(pg, 1))["player"]["alt"]
    await pg.keyboard.down("Space"); s5 = await step(pg, 45); await pg.keyboard.up("Space")
    await pg.keyboard.down("KeyC"); s6 = await step(pg, 60); await pg.keyboard.up("KeyC")
    check("rise_descend", "上昇（Space/▲）・下降（C/▼）", s5["player"]["alt"] > a0 + 80 and s6["player"]["alt"] < s5["player"]["alt"] - 80, {"alt": [round(a0), round(s5["player"]["alt"]), round(s6["player"]["alt"])]})
    await step(pg, 30)
    await pg.keyboard.down("ArrowUp"); s7 = await step(pg, 40)
    a1 = s7["player"]["alt"]
    await pg.keyboard.down("KeyW"); s8 = await step(pg, 40); await pg.keyboard.up("KeyW"); await pg.keyboard.up("ArrowUp")
    check("look_climb", "右スティック前＝上を向く／上を向いて前進で上昇", s7["cam"]["pitch"] > .3 and s7["cam"]["manual"] and s8["player"]["alt"] > a1 + 60, {"pitch": round(s7["cam"]["pitch"], 2), "alt": [round(a1), round(s8["player"]["alt"])]})
    await pg.keyboard.down("ArrowLeft"); s9 = await step(pg, 20); await pg.keyboard.up("ArrowLeft")
    turned = s9["cam"]["yaw"] - s8["cam"]["yaw"]
    s10 = await step(pg, 120); fr = await frame(pg)
    check("look_return", "右スティック左＝左を向く、離すと滑らかに敵追従へ戻る", turned < -.3 and not s10["cam"]["manual"] and fr["enemyNearCenter"], {"yaw_change": round(turned, 2), "manual_after_2s": s10["cam"]["manual"], "frame": fr})
    check("no_errors_controls", "操作テスト中のJS例外なし", not errs, errs)
    await b.close()


async def firing(p, url):
    # Deterministic layout: city field, fixed seed, open avenue along z=0 with towers beside it.
    b, pg, errs = await open_page(p, url)
    await pg.click("#titleEnter")
    await pg.evaluate("()=>{window.__b3QA.seed(4242);window.__b3QA.biome(4);window.__b3QA.freezeAI(true)}")
    await pg.evaluate("()=>{window.__b3QA.setWeapon('pulse');window.__b3QA.setLoad('enemy',{weapon:'pulse'})}")
    await step(pg, 5)
    obs = await pg.evaluate("()=>window.__b3QA.obstacles()")
    towers = sorted([o for o in obs if o["mat"] == "tower" and -700 < o["x"] < 100 and 80 < abs(o["z"]) < 420 and o["y1"] - o["y0"] > 110], key=lambda o: abs(o["z"]))
    T = towers[0]; sz = 1 if T["z"] > 0 else -1
    async def place(px, pz, ex, ez):
        await pg.evaluate(f"()=>{{window.__b3QA.place('player',{px},{pz},30);window.__b3QA.place('enemy',{ex},{ez},30)}}")
    # (1) Opponent hidden behind a tower: in the reticle but no line → no lock, no shots.
    await place(T["x"] - (T["br"] + 230), T["z"], T["x"] + T["br"] + 120, T["z"])
    a = await step(pg, 40); z = await step(pg, 60)
    check("cover_no_fire", "遮蔽物の陰：照準内でも射線が通らなければロックせず撃たない", z["lock"]["inReticle"] and not z["lock"]["los"] and not z["lock"]["lock"] and z["player"]["shots"] == a["player"]["shots"], {"lock": z["lock"], "shots": z["player"]["shots"] - a["player"]["shots"]})
    await shot(pg, "10_cover_blocked.png")
    # (2) Open avenue: lock → automatic fire → hits.
    await place(-620, 0, -120, 20)
    a = await step(pg, 40); z = await step(pg, 60)
    check("lock_fire", "照準内＋射線＋射程内で自動射撃し命中", z["lock"]["lock"] and z["player"]["shots"] > a["player"]["shots"] and z["stats"]["hitsP"] > a["stats"]["hitsP"], {"shots": z["player"]["shots"] - a["player"]["shots"], "hits": z["stats"]["hitsP"] - a["stats"]["hitsP"]})
    await shot(pg, "11_locked.png")
    # (3) Beyond weapon range on the same avenue.
    await place(-620, 0, 780, 20)
    a = await step(pg, 60); z = await step(pg, 60)
    check("range_no_fire", "射程外では自動射撃しない", z["lock"]["los"] and not z["lock"]["inRange"] and z["player"]["shots"] == a["player"]["shots"], {"lock": z["lock"]})
    await pg.keyboard.down("KeyJ"); m = await step(pg, 60); await pg.keyboard.up("KeyJ")
    check("manual_fire", "手動射撃（J／◎）はロック外でも照準方向へ撃てる", m["player"]["shots"] > z["player"]["shots"] and not m["lock"]["lock"], {"shots": m["player"]["shots"] - z["player"]["shots"]})
    # (4) Auto fire OFF: locked but no trigger → no shots.
    await place(-620, 0, -120, 20)
    await pg.evaluate("()=>window.__b3QA.setTune('autoFire',false)")
    a = await step(pg, 60); z = await step(pg, 60)
    check("autofire_off", "自動射撃OFF：ロック中でも手動入力なしでは撃たない", z["lock"]["lock"] and z["player"]["shots"] == a["player"]["shots"], {"shots": z["player"]["shots"] - a["player"]["shots"]})
    await pg.evaluate("()=>window.__b3QA.setTune('autoFire',true)")
    # (5) The player hides behind the tower; the opponent fires each weapon at it.
    rc = {}
    for wid in ("pulse", "burst", "slug", "rail"):
        await pg.evaluate(f"()=>window.__b3QA.setLoad('enemy',{{weapon:'{wid}'}})")
        await place(T["x"] - (T["br"] + 60), T["z"], T["x"] + T["br"] + 260, T["z"])
        await pg.evaluate("()=>window.__roboQATest.setHealth(9999)")
        z0 = await step(pg, 2); fired = 0
        for _ in range(6):
            fired += 1 if await pg.evaluate("()=>window.__b3QA.fireAt('enemy')") else 0
            z = await step(pg, 14)
        rc[wid] = {"volleys": fired, "blocked": z["stats"]["blocked"] - z0["stats"]["blocked"], "player_hits": z["stats"]["hitsE"] - z0["stats"]["hitsE"]}
    check("cover_blocks_enemy", "遮蔽物に隠れると敵弾が遮られる（通常弾・連射・重弾）", all(rc[w]["volleys"] > 0 and rc[w]["blocked"] > 0 and rc[w]["player_hits"] == 0 for w in ("pulse", "burst", "slug")), rc)
    check("rail_exception", "例外ルール：レールランサーは遮蔽物（建物・岩）を貫通する", rc["rail"]["player_hits"] > 0, rc["rail"])
    await pg.evaluate("()=>window.__b3QA.seed(null)")
    check("no_errors_fire", "射撃テスト中のJS例外なし", not errs, errs)
    await b.close()


async def ai_fields(p, url):
    b, pg, errs = await open_page(p, url)
    await pg.click("#titleEnter")
    summary = {}
    for bi, name in enumerate(BIOMES):
        await pg.evaluate(f"()=>window.__b3QA.biome({bi})")
        await step(pg, 10)
        n = vis = close = los = still = 0; lat = []; modes = collections.Counter(); prev = None; dist = []
        keys = ["KeyA", "KeyD"]
        for i in range(40):
            if i % 6 == 0:
                for k in keys + ["KeyW"]:
                    await pg.keyboard.up(k)
                await pg.keyboard.down(keys[(i // 6) % 2])
                if i % 18 == 0:
                    await pg.keyboard.down("KeyW")
            s = await step(pg, 30)
            if s["state"] != "fight":
                break
            fr = await frame(pg)
            P, E = s["player"], s["enemy"]; d = hd(P, E); dist.append(d); n += 1
            vis += fr["visibleBoth"]; close += d < 180; los += s["lock"]["los"]; modes[E["mode"]] += 1
            if prev:
                mx, mz = E["x"] - prev[0], E["z"] - prev[1]; ux, uz = (E["x"] - P["x"]) / d, (E["z"] - P["z"]) / d
                lat.append(abs(-uz * mx + ux * mz)); still += math.hypot(mx, mz) < 10
            prev = (E["x"], E["z"])
        for k in keys + ["KeyW"]:
            await pg.keyboard.up(k)
        await shot(pg, f"2{bi}_field_{name}.png")
        dist.sort()
        m = {"role": s["enemy"]["role"], "samples": n, "dist_p10_p50_p90": [round(dist[len(dist) // 10]), round(dist[len(dist) // 2]), round(dist[9 * len(dist) // 10])],
             "hug_lt180": round(close / max(n, 1), 3), "both_on_screen": round(vis / max(n, 1), 3), "player_los": round(los / max(n, 1), 3),
             "lateral_per_0.5s": round(sum(lat) / max(len(lat), 1)), "still_ratio": round(still / max(len(lat), 1), 3), "modes": dict(modes),
             "obstacles": s["obstacles"], "enemy_shots": s["stats"]["shotsE"], "enemy_hits": s["stats"]["hitsE"], "blocked_by_cover": s["stats"]["blocked"]}
        summary[name] = m
        check(f"ai_{name}", f"敵AI（{name}）：張り付かず横移動し、両機が画面内", m["hug_lt180"] < .1 and m["both_on_screen"] > .85 and m["lateral_per_0.5s"] > 20 and m["still_ratio"] < .3 and len(m["modes"]) >= 2, m)
    check("no_errors_ai", "AIテスト中のJS例外なし", not errs, errs)
    await b.close()
    return summary


async def weapons(p, url):
    b, pg, errs = await open_page(p, url, 960, 540)
    await pg.click("#titleEnter"); await pg.evaluate("()=>window.__b3QA.biome(4)"); await pg.evaluate("()=>window.__b3QA.freezeAI(true)")
    hits = {}
    for w in WEAPONS:
        await pg.evaluate(f"()=>window.__b3QA.setWeapon('{w}')")
        await pg.evaluate("()=>{window.__b3QA.place('player',-640,0,40);window.__b3QA.place('enemy',-60,40,60);}")
        a = await step(pg, 50)
        await pg.evaluate("()=>window.__b3QA.fireAt('player')")
        await step(pg, {"missile": 22, "slug": 8, "bounce": 10, "shot": 7}.get(w, 6))
        await shot(pg, f"3x_weapon_{w}.png")
        z = await step(pg, 70)
        hits[w] = z["stats"]["hitsP"] - a["stats"]["hitsP"]
    check("weapons", "8武器すべてが3D弾として発射・命中", all(v > 0 for v in hits.values()), hits)
    try:
        from PIL import Image
        tiles = [Image.open(SHOTS / f"3x_weapon_{w}.png").crop((330, 150, 630, 420)) for w in WEAPONS]
        sheet = Image.new("RGB", (1200, 540))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % 4) * 300, (i // 4) * 270))
        sheet.save(SHOTS / "30_weapons_sheet.png")
        for w in WEAPONS:
            (SHOTS / f"3x_weapon_{w}.png").unlink()
    except ImportError:
        pass
    await b.close()


async def finisher(p, url):
    b, pg, errs = await open_page(p, url, 960, 540, scale=1)
    await to_fight(pg); await pg.evaluate("()=>window.__b3QA.freezeAI(true)"); await step(pg, 20)
    await pg.evaluate("()=>window.__b3QA.finish('win')")
    frames = []; t = 0; states = []
    for i, target in enumerate([.12, .45, .9, 1.35, 1.8]):
        s = await step(pg, int(round((target - t) * 60))); t = target; states.append(s["state"])
        await pg.screenshot(path=str(SHOTS / f"_fin_w{i}.png")); frames.append(SHOTS / f"_fin_w{i}.png")
    s = await step(pg, 20)
    await pg.wait_for_timeout(200)
    win_ok = all(x == "finisher" for x in states) and s["state"] == "winCard"
    await pg.click("#phaseContinue"); await pg.wait_for_timeout(200)
    cards = await pg.evaluate("()=>document.querySelectorAll('[data-loot]').length")
    await pg.screenshot(path=str(SHOTS / "41_loot.png"))
    await pg.click("[data-loot='armor']"); await pg.wait_for_timeout(200)
    q = await pg.evaluate("()=>window.__roboQA()")
    check("finisher_win", "勝利：約2秒の3D分解演出→WIN→戦利品4択→ルートへ", win_ok and cards == 4 and q["state"] == "route" and q["depth"] == 1, {"states": states, "after": s["state"], "loot_cards": cards, "route_depth": q["depth"], "gold": q["gold"]})
    await shot(pg, "42_route_map.png")
    await pg.evaluate("()=>window.__roboQATest.selectNode('fight')"); await pg.wait_for_timeout(200)
    await pg.click("#phaseContinue"); await step(pg, 20)
    meta0 = (await pg.evaluate("()=>window.__roboQA()"))["meta"]["points"]
    await pg.evaluate("()=>window.__b3QA.finish('lose')")
    lf = []; t = 0
    for i, target in enumerate([.2, .8, 1.5, 1.85]):
        await step(pg, int(round((target - t) * 60))); t = target
        await pg.screenshot(path=str(SHOTS / f"_fin_l{i}.png")); lf.append(SHOTS / f"_fin_l{i}.png")
    s = await step(pg, 20); await pg.wait_for_timeout(200)
    await pg.click("#phaseContinue"); await pg.wait_for_timeout(200)
    q = await pg.evaluate("()=>window.__roboQA()")
    await pg.screenshot(path=str(SHOTS / "43_run_ended.png"))
    stored = await pg.evaluate("()=>JSON.parse(localStorage.getItem('roboSalvageMetaV1')||'null')")
    check("finisher_lose", "敗北：3D分解→LOSE→ラン終了。SPは保存キーroboSalvageMetaV1に加算", q["state"] == "dead" and q["meta"]["points"] > meta0 and stored and stored.get("points") == q["meta"]["points"], {"state": q["state"], "sp": [meta0, q["meta"]["points"]], "stored_points": stored and stored.get("points")})
    try:
        from PIL import Image
        for name, files in (("40_finisher_win_sheet.png", frames), ("44_finisher_lose_sheet.png", lf)):
            im = [Image.open(f).crop((120, 40, 840, 500)) for f in files]
            sheet = Image.new("RGB", (720 * len(im), 460))
            for i, x in enumerate(im):
                sheet.paste(x, (i * 720, 0))
            sheet.resize((360 * len(im), 230)).save(SHOTS / name)
    except ImportError:
        pass
    for f in frames + lf:
        f.unlink(missing_ok=True)
    check("no_errors_finisher", "決着テスト中のJS例外なし", not errs, errs)
    await b.close()


async def boss(p, url):
    b, pg, errs = await open_page(p, url)
    await pg.click("#titleEnter"); await pg.click("#startBtn"); await pg.wait_for_timeout(100)
    await pg.evaluate("()=>window.__roboQATest.jumpToBoss()"); await pg.wait_for_timeout(100)
    await pg.click("#mapScroll [data-route='boss']"); await pg.wait_for_timeout(100)
    await pg.click("#phaseContinue"); await step(pg, 20)
    kinds = collections.Counter(); snap = False
    for i in range(80):
        if i % 6 == 0:
            await pg.evaluate("()=>window.__roboQATest.setHealth(9999)")
        s = await step(pg, 15)
        q = await pg.evaluate("()=>window.__roboQA()")
        if q["bossPattern"]:
            kinds[q["bossPattern"]] += 1
        if q["bossPattern"] == "beam" and not snap:
            await shot(pg, "50_boss_beam_telegraph.png"); snap = True
        if s["state"] != "fight" or len(kinds) == 4 and q["bossAttackCount"] >= 4:
            break
    check("boss", "ボス：扇・全方位・ビーム（遮蔽で止まる3D判定）・誘導弾の4パターン", set(kinds) == {"fan", "ring", "beam", "salvo"}, {"patterns": dict(kinds), "attacks": q["bossAttackCount"]})
    await b.close()


async def mobile(p, url):
    for w, h, tag in ((390, 844, "portrait"), (844, 390, "landscape")):
        b, pg, errs = await open_page(p, url, w, h, mobile=True)
        await to_fight(pg, tap=True)
        await pg.evaluate("()=>window.__b3QA.freezeAI(true)"); await step(pg, 30)
        rects = await pg.evaluate("""()=>['b3MoveStick','b3LookStick','b3Fire','b3Dash','b3Rise','b3Desc','b3Reload','menuBtn','b3Lab'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height}})""")
        shown = await pg.evaluate("()=>getComputedStyle(document.getElementById('b3Touch')).display!=='none'")
        ov = [(a["id"], c["id"]) for i, a in enumerate(rects) for c in rects[i + 1:] if a["x"] < c["x"] + c["w"] and c["x"] < a["x"] + a["w"] and a["y"] < c["y"] + c["h"] and c["y"] < a["y"] + a["h"]]
        fr = await frame(pg); px, py = fr["player"]["x"] * w, fr["player"]["y"] * h
        cover_p = [r["id"] for r in rects if r["x"] - 8 < px < r["x"] + r["w"] + 8 and r["y"] - 8 < py < r["y"] + r["h"] + 8]
        cover_r = [r["id"] for r in rects if r["x"] < w / 2 < r["x"] + r["w"] and r["y"] < h / 2 < r["y"] + r["h"]]
        a = await step(pg, 1)
        await pg.evaluate("()=>window.__b3QA.touch({mx:1,my:0})"); z = await step(pg, 60); await pg.evaluate("()=>window.__b3QA.touch({mx:0,my:0})")
        moved = hd(z["player"], a["player"])
        await shot(pg, f"6{0 if tag == 'portrait' else 1}_mobile_{tag}.png")
        check(f"mobile_{tag}", f"スマホ{('縦' if tag == 'portrait' else '横')}：スティック・ボタンが重ならず、自機・照準を隠さない", shown and not ov and not cover_p and not cover_r and fr["visibleBoth"] and moved > 150,
              {"touch_ui": shown, "overlaps": ov, "player_covered_by": cover_p, "reticle_covered_by": cover_r, "frame": fr, "touch_move": round(moved)})
        await b.close()


async def fallback(p, url):
    b, pg, errs = await open_page(p, url, args=["--disable-webgl", "--disable-3d-apis"])
    gl = await pg.evaluate("()=>window.__b3QA.get().gl")
    await pg.click("#titleEnter"); await pg.click("#startBtn"); await pg.wait_for_timeout(150)
    await pg.evaluate("()=>window.__roboQATest.selectNode('fight')"); await pg.wait_for_timeout(150); await pg.click("#phaseContinue")
    await pg.keyboard.down("KeyD"); await pg.wait_for_timeout(600); await pg.keyboard.up("KeyD"); await pg.wait_for_timeout(300)
    q = await pg.evaluate("()=>window.__roboQA()")
    await pg.screenshot(path=str(SHOTS / "70_no_webgl_fallback_2d.png"))
    check("fallback", "WebGL2非対応ブラウザ：既存の2D戦闘で遊べる（代替）", gl is False and q["state"] == "fight" and q["player"]["x"] > 170 and not errs, {"gl": gl, "state": q["state"], "x": round(q["player"]["x"]), "errors": errs})
    await b.close()


async def main():
    from playwright.async_api import async_playwright
    SHOTS.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) == 1:
        for f in list(SHOTS.glob("*.png")) + list(SHOTS.glob("*.jpg")):
            f.unlink()
    import subprocess
    built = subprocess.run([sys.executable, str(ROOT / "scripts" / "build_patrol_salvage.py"), "--check"], capture_output=True, text=True)
    check("build", "index.html が src/ から再生成した内容と一致", built.returncode == 0, built.stdout.strip())
    srv, url = serve()
    t0 = time.time(); ai = None
    only = set(sys.argv[1:])
    async with async_playwright() as p:
        for name, fn in (("controls", controls), ("firing", firing), ("ai", ai_fields), ("weapons", weapons), ("finisher", finisher), ("boss", boss), ("mobile", mobile), ("fallback", fallback)):
            if only and name not in only:
                continue
            r = await fn(p, url)
            if name == "ai":
                ai = r
    srv.shutdown()
    try:  # keep the repository light: store screenshots as JPEG
        from PIL import Image
        for f in SHOTS.glob("*.png"):
            Image.open(f).convert("RGB").save(f.with_suffix(".jpg"), quality=86, optimize=True)
            f.unlink()
    except ImportError:
        pass
    ok = all(r["ok"] for r in results)
    report = {"game": "patrol-robo-salvage", "version": "0.6.0", "passed": ok, "checks": results, "ai_fields": ai,
              "environment": "Headless Chrome + SwiftShader (software WebGL2). Real-GPU frame rate and real phones are NOT covered.",
              "seconds": round(time.time() - t0)}
    (OUT / "results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{sum(r['ok'] for r in results)}/{len(results)} checks passed in {report['seconds']}s → {OUT.relative_to(ROOT)}/results.json")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

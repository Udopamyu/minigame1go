#!/usr/bin/env python3
"""Video department: capture a vertical gameplay clip of the PUBLIC PATROL × ROBO SALVAGE build.

Honest-capture rules (AGENTS.md):
  * the public index.html as shipped — no tuning panel, default parameters (renderScale etc. untouched)
  * fresh save, the starter weapon a new player has (pulse), the first fight picked by clicking the route map
  * no HP / gold / unlock / weapon changes, no enemy placement. The player is flown by keyboard input only
    (a small scripted pilot), auto-fire is the game's own default.
  * time is frame-stepped (2 × 1/60 s per video frame) only so that a software-rendered browser can produce
    smooth 30 fps footage; game logic is unchanged.

  python scripts/record_patrol_salvage.py            # capture + compose
  python scripts/record_patrol_salvage.py compose    # re-compose from the last capture

Output: videos/patrol-robo-salvage/gameplay.mp4 (1080×1920, 30 fps, silent), poster.jpg, recording.json
Frames are kept in videos/patrol-robo-salvage/.capture/ (git-ignored).
"""
from __future__ import annotations

import asyncio, hashlib, json, math, os, pathlib, shutil, subprocess, sys, time
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify_patrol_salvage import ARGS, ROOT, GAME, serve  # noqa: E402

OUT = ROOT / "videos" / "patrol-robo-salvage"
CAP = OUT / ".capture"
VIEW = (432, 768)          # CSS px, portrait
DPR = 2.5                  # → 1080 × 1920
FPS = 30
MAX_FIGHT_FRAMES = FPS * 60


async def capture():
    from playwright.async_api import async_playwright
    if CAP.exists():
        shutil.rmtree(CAP)
    CAP.mkdir(parents=True)
    srv, url = serve()
    log = {"frames": [], "errors": []}
    n = 0

    async def grab(pg, kind, info=None):
        nonlocal n
        await pg.screenshot(path=str(CAP / f"f{n:05d}.jpg"), type="jpeg", quality=93)
        log["frames"].append({"i": n, "kind": kind, **(info or {})})
        n += 1

    async with async_playwright() as p:
        exe = os.environ.get("CHROMIUM_EXECUTABLE") or ("/usr/bin/google-chrome" if pathlib.Path("/usr/bin/google-chrome").exists() else None)
        b = await p.chromium.launch(executable_path=exe, headless=True, args=ARGS)
        ctx = await b.new_context(viewport={"width": VIEW[0], "height": VIEW[1]}, device_scale_factor=DPR)
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: log["errors"].append(str(e)))
        await pg.goto(url)
        await pg.evaluate("()=>localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(900)
        info = await pg.evaluate("()=>({lab:!!document.getElementById('b3Lab'),tune:window.__b3QA.tune(),defaults:window.__b3QA.defaults()})")
        assert not info["lab"], "public build must not have the tuning button"
        assert all(info["tune"][k] == v for k, v in info["defaults"].items()), "parameters differ from shipped defaults"
        # title card (real opening screen, animated by the page itself)
        for _ in range(int(FPS * 1.6)):
            await grab(pg, "title")
            await pg.wait_for_timeout(1000 // FPS)
        await pg.click("#titleEnter"); await pg.wait_for_timeout(200)
        await pg.click("#startBtn"); await pg.wait_for_timeout(300)
        node = pg.locator('#mapScroll [data-route="fight"]')
        assert await node.count(), "first route row offers no fight node"
        await node.first.click(); await pg.wait_for_timeout(200)
        await pg.click("#phaseContinue"); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>window.__b3QA.hold(true)")
        start = await pg.evaluate("()=>window.__b3QA.step(1,1/60)")
        log["start"] = {"biome": start["biome"], "weapon": start["player"]["weapon"], "enemy_hp": start["enemy"]["maxHp"], "player_hp": start["player"]["maxHp"]}
        held = set()

        async def keys(want):
            for k in held - want:
                await pg.keyboard.up(k)
            for k in want - held:
                await pg.keyboard.down(k)
            held.clear(); held.update(want)

        side, flip, phase = "KeyD", 0, "fight"
        for f in range(MAX_FIGHT_FRAMES):
            s = await pg.evaluate("()=>window.__b3QA.step(2,1/60)")
            if s["state"] != "fight" and not s["finish"]:
                phase = "after"
                break
            if s["finish"]:
                await keys(set())
                await grab(pg, "finish")
                continue
            pl, en = s["player"], s["enemy"]
            want = set()
            if en and not en["dead"]:
                d = math.hypot(pl["x"] - en["x"], pl["z"] - en["z"])
                if d > 470:
                    want.add("KeyW")
                elif d < 230:
                    want.add("KeyS")
                flip += 1
                if flip > 75:
                    flip, side = 0, ("KeyA" if side == "KeyD" else "KeyD")
                if d < 560:
                    want.add(side)
                if en["h"] - pl["h"] > 90:
                    want.add("Space")
                elif pl["h"] - en["h"] > 140:
                    want.add("KeyC")
                if f % 150 == 40 and pl["en"] > .6:
                    want.add("ShiftLeft")
            await keys(want)
            lk = s["lock"]
            await grab(pg, "fight", {"t": round(f / FPS, 2), "lock": lk["lock"], "firing": lk["firing"], "enemy_hp": en and round(en["hp"], 1),
                                     "player_hp": round(pl["hp"], 1), "hits": s["stats"].get("hitsP"), "d": en and round(math.hypot(pl["x"] - en["x"], pl["z"] - en["z"]))})
        await keys(set())
        end = await pg.evaluate("()=>({state:window.__b3QA.get().state,hp:window.__b3QA.get().player.hp,dialog:document.querySelector('#dialog')?.innerText.slice(0,80)})")
        log["end"] = end
        # result screen after the fight (salvage / loot), real DOM as the player sees it
        for _ in range(int(FPS * 1.4)):
            await grab(pg, "result")
        await b.close()
    srv.shutdown()
    (CAP / "log.json").write_text(json.dumps(log, ensure_ascii=False), encoding="utf-8")
    print(f"captured {n} frames  start={log['start']}  end={log['end']}  errors={len(log['errors'])}")


def compose():
    log = json.loads((CAP / "log.json").read_text(encoding="utf-8"))
    fr = log["frames"]
    title = [x["i"] for x in fr if x["kind"] == "title"]
    fight = [x for x in fr if x["kind"] == "fight"]
    finish = [x["i"] for x in fr if x["kind"] == "finish"]
    result = [x["i"] for x in fr if x["kind"] == "result"]
    assert fight and finish, "capture must contain a fight that ends in the finisher"
    # opening: begin just before the first locked auto-fire, ~3 s
    first_fire = next((k for k, x in enumerate(fight) if x["firing"]), 0)
    a0 = max(0, first_fire - 8)
    opening = fight[a0:a0 + FPS * 3]
    # climax: the last ~6.5 s before the finisher (no overlap with the opening)
    tail_from = max(a0 + len(opening), len(fight) - int(FPS * 6.5))
    climax = fight[tail_from:]
    seq = [x["i"] for x in opening] + [x["i"] for x in climax] + finish + result[:int(FPS * 1.2)] + title[:int(FPS * 1.5)]
    cuts = {"opening": [opening[0]["t"], opening[-1]["t"]], "climax": [climax[0]["t"] if climax else None, climax[-1]["t"] if climax else None],
            "jump_cut": tail_from > a0 + len(opening), "finisher_frames": len(finish), "result_frames": min(len(result), int(FPS * 1.2)),
            "title_frames": min(len(title), int(FPS * 1.5))}
    lst = CAP / "concat.txt"
    lst.write_text("".join(f"file 'f{i:05d}.jpg'\nduration {1 / FPS:.6f}\n" for i in seq) + f"file 'f{seq[-1]:05d}.jpg'\n", encoding="utf-8")
    mp4 = OUT / "gameplay.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-vf", f"fps={FPS},scale=1080:1920:flags=lanczos,format=yuv420p",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", str(mp4)], check=True)
    poster_src = climax[len(climax) // 2]["i"] if climax else opening[len(opening) // 2]["i"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(CAP / f"f{poster_src:05d}.jpg"), "-vf", "scale=1080:1920", "-q:v", "3", str(OUT / "poster.jpg")], check=True)
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate", "-of", "json", str(mp4)],
                                      capture_output=True, text=True, check=True).stdout)
    fight_secs = round(len(fight) / FPS, 1)
    report = {
        "game": "patrol-robo-salvage", "build": "public index.html (no tuning UI)",
        "source_sha256": hashlib.sha256((GAME / "index.html").read_bytes()).hexdigest(),
        "recorded_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "capture": {"viewport_css": VIEW, "device_scale_factor": DPR, "fps": FPS, "time": "frame-stepped 2×1/60 s per frame",
                    "renderer": "Headless Chrome + SwiftShader (software WebGL2)", "audio": "none (headless capture; the game itself has sound)"},
        "honesty": {"save": "fresh (localStorage cleared)", "weapon": log["start"]["weapon"], "route": "first fight node clicked on the route map",
                    "cheats": "none — no HP/gold/unlock/weapon/placement changes", "input": "keyboard only (scripted pilot); auto-fire = game default"},
        "fight": {"biome": log["start"]["biome"], "seconds": fight_secs, "player_hp_end": fight[-1]["player_hp"], "player_hp_max": log["start"]["player_hp"],
                  "ended_with": log["end"]},
        "edit": cuts, "video": {"file": "gameplay.mp4", "seconds": round(float(probe["format"]["duration"]), 2), "stream": probe["streams"][0],
                                "sha256": hashlib.sha256(mp4.read_bytes()).hexdigest()},
        "page_errors": log["errors"],
    }
    (OUT / "recording.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"video_seconds": report["video"]["seconds"], "fight_seconds": fight_secs, "edit": cuts, "errors": len(log["errors"])}, ensure_ascii=False))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    if "compose" not in sys.argv:
        asyncio.run(capture())
    compose()

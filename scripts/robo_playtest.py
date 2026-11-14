#!/usr/bin/env python3
"""Non-cheating Robo Salvage combat playtest.

This agent reads public read-only telemetry and uses only visible buttons and
ordinary keyboard controls. It never calls __roboQATest or mutates game state.
Outcomes measure this deterministic scripted player's skill, not a human's.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evaluation" / "robo-salvage"
OUT.mkdir(parents=True, exist_ok=True)
STARTERS = ("pulse", "burst", "rail")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def telemetry(page):
    return page.evaluate("() => window.__roboQA()")


class Pilot:
    """WASD + Space + R + Shift controller. No mutation or test hooks."""

    def __init__(self, page):
        self.page = page
        self.keys = set()
        self.step = 0
        self.previous_position = None
        self.stuck_ticks = 0
        self.orbit = 1

    def controls(self, desired):
        next_keys = set(desired)
        for name in self.keys - next_keys:
            self.page.keyboard.up(name)
        for name in next_keys - self.keys:
            self.page.keyboard.down(name)
        self.keys = next_keys

    def release(self):
        self.controls(())

    def fight_step(self, q):
        p, e = q["player"], q["enemy"]
        dx, dy = e["x"] - p["x"], e["y"] - p["y"]
        d = max(1, math.hypot(dx, dy))
        ammo = q["playerAmmo"]
        reloading = ammo["reloadLeft"] > 0
        self.step += 1
        if self.step % 38 == 0:
            self.orbit *= -1
        # Move laterally while firing; retreat during either reload or proximity.
        away = 1 if (d < 245 or reloading and d < 410) else -1 if d > 485 else .14
        sidestep = self.orbit * (.8 if 235 < d < 490 else .45)
        vx, vy = -dx / d * away - dy / d * sidestep, -dy / d * away + dx / d * sidestep
        # Avoid running into the arena boundary for entire fights.
        if p["x"] < 105 and vx < 0: vx = .55
        if p["x"] > 890 and vx > 0: vx = -.55
        if p["y"] < 90 and vy < 0: vy = .55
        if p["y"] > 490 and vy > 0: vy = -.55
        if self.previous_position and math.hypot(
                p["x"] - self.previous_position[0],
                p["y"] - self.previous_position[1]) < 2.5:
            self.stuck_ticks += 1
        else:
            self.stuck_ticks = 0
        if self.stuck_ticks >= 7:
            self.orbit *= -1
            self.stuck_ticks = 0
        self.previous_position = (p["x"], p["y"])
        axes = set()
        if vx > .20: axes.add("KeyD")
        if vx < -.20: axes.add("KeyA")
        if vy > .20: axes.add("KeyS")
        if vy < -.20: axes.add("KeyW")
        axes.add("Space")  # auto aim in normal gameplay
        self.controls(axes)
        # Reload before running empty when reasonably safe.
        if not reloading and 0 < ammo["ammo"] <= max(1, ammo["mag"] // 4) and d > 320:
            self.page.keyboard.press("KeyR")
        # Try a normal dash when threatened, with a cooldown based on telemetry.
        if d < 225 and p["dashCooldown"] <= .05 and self.step % 7 == 0:
            self.page.keyboard.press("Shift")
        self.page.wait_for_timeout(200)


def choose_route(page, q, stage_log):
    choices = q["routeCandidates"]
    hp = q["player"]["hp"] / max(1, q["player"]["maxHp"])
    if q["depth"] >= 10:
        kind = "boss"
    elif hp < .56 and any(c["type"] == "rest" for c in choices):
        kind = "rest"
    elif hp < .42 and any(c["type"] == "shop" for c in choices) and q["gold"] > 95:
        kind = "shop"
    elif q["depth"] >= 3 and any(c["type"] == "event" for c in choices):
        kind = "event"
    elif q["gold"] > 240 and any(c["type"] == "shop" for c in choices):
        kind = "shop"
    elif q["depth"] >= 6 and any(c["type"] == "rest" for c in choices):
        kind = "rest"
    else:
        kind = next((name for name in ("fight", "fight2", "cache", "rest",
                                     "event", "shop", "elite")
                     if any(c["type"] == name for c in choices)), choices[0]["type"])
    loc = page.locator(f'#mapScroll [data-route="{kind}"]')
    loc.first.click(timeout=3500)
    stage_log.append({"node":q["depth"]+1, "type":kind, "hp":round(hp, 3)})
    return kind


def buy_hangar_upgrades(page):
    # Earned research points remain between attempts, bought via UI.
    for _ in range(12):
        affordable = page.locator(".metaUpgrade:not(:disabled)")
        if not affordable.count(): break
        affordable.first.click()


def finish_loot(page, q):
    if not q["player"] or not q["enemy"]: return "skip"
    own, enemy = q["player"]["load"], q["enemy"]["load"]
    # Prefer tangible upgrades: weapon level or armor durability.
    if enemy["weapon"]["lv"] > own["weapon"]["lv"] or (
        own["weapon"]["id"] == "pulse" and enemy["weapon"]["id"] in ("burst", "shot")):
        slot = "weapon"
    elif enemy["armor"]["lv"] > own["armor"]["lv"] or (
        own["armor"]["id"] == "mesh" and enemy["armor"]["id"] in ("fortress", "plated", "composite")):
        slot = "armor"
    elif enemy["core"]["lv"] > own["core"]["lv"]:
        slot = "core"
    else:
        slot = "skip"
    if slot == "skip":
        page.locator("#skipLoot").click()
    else:
        page.locator(f'[data-loot="{slot}"]').click()
    return slot


def run_attempt(page, number, max_seconds=125):
    starter = STARTERS[number % len(STARTERS)]
    page.locator(f'[data-starter="{starter}"]').click()
    buy_hangar_upgrades(page)
    beginning = telemetry(page)["meta"]
    page.locator("#startBtn").click()
    pilot = Pilot(page)
    started = time.monotonic()
    stages, fight_intervals, reloads = [], [], []
    max_depth, max_fights, closest_distance = 0, 0, 10000
    currently_fighting = False
    reached_boss = False
    fail_reason = None
    total_steps = 0
    while time.monotonic() - started < max_seconds:
        q = telemetry(page)
        state = q["state"]
        max_depth = max(max_depth, q["depth"])
        max_fights = max(max_fights, q["encountersWon"])
        if state == "route":
            pilot.release()
            choose_route(page, q, stages)
        elif state == "ready":
            pilot.release()
            page.locator("#phaseContinue").click()
            currently_fighting = True
        elif state == "fight":
            if q["currentNode"] == "boss": reached_boss = True
            closest_distance = min(closest_distance, q.get("enemyDistance") or 10000)
            if total_steps % 6 == 0:
                fight_intervals.append({
                    "node":q["depth"]+1,"t":round(time.monotonic()-started,1),
                    "distance":round(q.get("enemyDistance") or 0,1),
                    "hp":round(q["player"]["hp"],1),
                    "enemyHp":round(q["enemy"]["hp"],1),
                    "playerAmmo":q["playerAmmo"]["ammo"],
                    "enemyAmmo":q["enemyAmmo"]["ammo"],
                    "enemyMode":q["enemyAmmo"]["aiMode"]
                })
            if q["playerAmmo"]["reloadLeft"] > 0 or q["enemyAmmo"]["reloadLeft"] > 0:
                reloads.append({
                    "t":round(time.monotonic()-started,2),
                    "player":q["playerAmmo"]["reloadLeft"] > 0,
                    "enemy":q["enemyAmmo"]["reloadLeft"] > 0
                })
            pilot.fight_step(q)
            total_steps += 1
        elif state in ("winCard", "loseCard"):
            pilot.release()
            page.locator("#phaseContinue").click()
            if state == "loseCard": fail_reason = "defeated"
        elif state == "loot":
            pilot.release()
            finish_loot(page, q)
            currently_fighting = False
        elif state == "nodeResult":
            pilot.release()
            page.locator("#nodeContinue").click()
        elif state == "shop":
            pilot.release()
            # Spend in-run GOLD on repairs, then on a weapon upgrade when possible.
            heal = page.locator('[data-shop="repair"]')
            if heal.is_enabled() and q["player"]["hp"] / q["player"]["maxHp"] < .72:
                heal.click()
            power = page.locator('[data-shop="upgrade"][data-arg="weapon"]')
            if power.is_enabled(): power.click()
            page.locator("#leaveShop").click()
        elif state == "event":
            pilot.release()
            choice = page.locator('[data-event="heal"]')
            if q["player"]["hp"] < q["player"]["maxHp"]*.53 and choice.count() and choice.is_enabled():
                choice.click()
            else:
                preferred = page.locator('[data-event="upgrade"]')
                preferred.click() if preferred.is_enabled() else page.locator('[data-event]:not(:disabled)').first.click()
        elif state in ("dead", "victory"):
            pilot.release()
            fail_reason = "defeated" if state == "dead" else "boss_clear"
            break
        else:
            pilot.release()
            fail_reason = f"unexpected_state:{state}"
            break
    pilot.release()
    q = telemetry(page)
    result = {
        "attempt":number+1, "starter":starter, "seconds":round(time.monotonic()-started,1),
        "outcome":fail_reason or "time_limit",
        "max_completed_nodes":max_depth, "reached_boss":reached_boss,
        "battle_victories":max_fights,
        "hp_at_end":round(q["player"]["hp"],1) if q["player"] else None,
        "battle_gold_at_end":q["gold"],
        "research_points_at_end":q["meta"]["points"],
        "research_levels_at_start":beginning["upgrades"],
        "stages":stages,
        "combat_samples":fight_intervals,
        "reload_samples":reloads[::max(1,len(reloads)//60)],
        "observed_min_distance":round(closest_distance,1) if closest_distance < 10000 else None
    }
    page.screenshot(path=str(OUT/f"autoplay-run-{number+1}.png"),full_page=True)
    print("AUTOPLAY "+json.dumps({k:v for k,v in result.items()
        if k not in ("combat_samples","reload_samples","stages")},ensure_ascii=False),flush=True)
    return result


def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f"http://127.0.0.1:{server.server_port}/games/robo-salvage/"
    results=[];errors=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,
                executable_path=os.environ.get("CHROMIUM_EXECUTABLE") or None,
                args=["--no-sandbox","--disable-dev-shm-usage","--mute-audio"])
            try:
                # Reuse a context so research earned by dying carries into the next attempt.
                context=browser.new_context(viewport={"width":1366,"height":900},
                                            reduced_motion="reduce")
                page=context.new_page()
                page.on("pageerror",lambda e: errors.append(str(e)))
                page.goto(url,wait_until="domcontentloaded")
                page.wait_for_function("()=>!!window.__roboQA",timeout=10000)
                for i in range(3):
                    if i:
                        q=telemetry(page)
                        if q["state"] == "dead": page.locator("#againBtn").click()
                        elif q["state"] == "victory": page.locator("#newRun").click()
                        else:
                            # Timeout runs are incomplete and never receive free SP.
                            page.reload(wait_until="domcontentloaded")
                            page.wait_for_function("()=>!!window.__roboQA")
                    results.append(run_attempt(page,i,max_seconds=125))
                context.close()
            finally: browser.close()
    finally:
        server.shutdown();server.server_close();thread.join()
    report={"mode":"real UI keypresses, no defeat/jump/setHealth test hooks",
        "attempts":results,"max_completed_nodes":max(x["max_completed_nodes"] for x in results),
        "reached_boss":any(x["reached_boss"] for x in results),
        "boss_clears":sum(x["outcome"]=="boss_clear" for x in results),
        "javascript_errors":errors}
    (OUT/"autoplay-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("AUTOPLAY SUMMARY "+json.dumps({k:v for k,v in report.items() if k!="attempts"},ensure_ascii=False),flush=True)
    return 1 if errors else 0


if __name__=="__main__":
    sys.exit(main())

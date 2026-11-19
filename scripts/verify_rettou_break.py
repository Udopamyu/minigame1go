#!/usr/bin/env python3
"""Browser verification for 列島ブレイク (games/rettou-break).

Serves the repository over HTTP (the game fetches its data files), opens the
page at a phone-sized viewport in Chromium and plays three scenarios through
the normal phases: split (island), meteor, monster. Each run checks the
loading, the cut-in, the 1-year simulation, the result panel, the life story
and the share text, and fails on any page error.

    python scripts/verify_rettou_break.py
    CHROMIUM_EXECUTABLE=/usr/bin/google-chrome python scripts/verify_rettou_break.py

Results go to games/rettou-break/qa/results.json. These are functional
checks; they do not replace a play test on a real phone.
"""
import asyncio, functools, http.server, json, os, pathlib, socketserver, sys, threading, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "rettou-break" / "qa"

SCENARIOS = {
    "split_nara": """(()=>{const lb=window.__lb,wp=lb.wp;const poly=[[34.78,135.72],[34.78,136.08],[34.3,136.08],[34.0,135.9],[34.0,135.6],[34.4,135.62]].map(([a,b])=>wp(a,b));
        lb.setPhase('target');lb.startImpact([{t:'s',poly,dx:10,dy:150,fixed:true,sd:3}]);})()""",
    "meteor_osaka": """(()=>{const lb=window.__lb,o=lb.wp(34.69,135.5);lb.setPhase('target');lb.startImpact([{t:'m',x:o[0],y:o[1],r:25}]);})()""",
    "monster_honshu": """(()=>{const lb=window.__lb,wp=lb.wp;lb.setPhase('target');lb.startImpact([{t:'k',pts:[wp(35.75,136.0),wp(35.45,136.25),wp(35.2,136.45),wp(34.9,136.6)],r:4}]);})()""",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def run():
    from playwright.async_api import async_playwright
    srv = serve()
    url = f"http://127.0.0.1:{srv.server_address[1]}/games/rettou-break/index.html"
    results, ok_all = [], True
    async with async_playwright() as p:
        exe = os.environ.get("CHROMIUM_EXECUTABLE")
        browser = await p.chromium.launch(executable_path=exe or None, args=["--no-sandbox"])
        for name, script in SCENARIOS.items():
            ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            t0 = time.time()
            await page.goto(url)
            await page.wait_for_function("window.__lb&&window.__lb.phase==='title'", timeout=60000)
            load_s = round(time.time() - t0, 2)
            await page.click("#startBtn")
            await page.evaluate(script)
            await page.wait_for_timeout(600)
            cutin = await page.evaluate("!document.getElementById('cutLbl').classList.contains('hidden')")
            await page.wait_for_function("window.__lb.phase==='sim'", timeout=60000)
            await page.wait_for_timeout(3000)
            day_after_3s = await page.evaluate("window.__lb.G.day")
            await page.evaluate("document.getElementById('toRes').click()")
            await page.wait_for_function("window.__lb.phase==='result'", timeout=60000)
            res = await page.evaluate("""(()=>{const lb=window.__lb,G=lb.G;let e=0;lb.zones.forEach(z=>e+=z.E);
                return{day:G.day,evacLeft:e,islands:G.islands.map(i=>i.name),story:!!document.querySelector('.story .tl li'),
                  storyItems:document.querySelectorAll('.story .tl li').length,roads:G.events.filter(x=>x.kind==='road').length,
                  links:G.plans.filter(p=>p.big).map(p=>p.label)};})()""")
            await page.click("#storyNext")
            await page.click("#lineBtn")
            await page.click("#shareBtn")
            await page.wait_for_timeout(200)
            share = await page.eval_on_selector("#shareTxt", "e=>e.value")
            ok = (not errors and cutin and res["day"] == 365 and res["story"] and "#列島ブレイク" in share
                  and res["evacLeft"] < 50 and day_after_3s > 0)
            if name == "split_nara":
                ok = ok and "奈良島" in res["islands"]
            ok_all &= ok
            results.append({"scenario": name, "ok": ok, "load_s": load_s, "cutin_shown": cutin, "sim_day_after_3s": day_after_3s,
                            "page_errors": errors, **res, "share_text": share})
            print(("PASS" if ok else "FAIL"), name, json.dumps(res, ensure_ascii=False))
            await ctx.close()
        await browser.close()
    srv.shutdown()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "results.json").write_text(json.dumps({"checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "viewport": "390x844@2x",
                                                  "ok": ok_all, "results": results}, ensure_ascii=False, indent=2) + "\n")
    return ok_all


if __name__ == "__main__":
    sys.exit(0 if asyncio.run(run()) else 1)

"""V0.3 active dealer browser tests. Test-mode only: no video/publication approval."""
import json, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"evaluation"/"roulette-rogue-v03"
OUT.mkdir(parents=True, exist_ok=True)
report={"status":"failed","checks":[],"js_errors":[],"external_requests":[],
        "human_playtime_verified":False,"release_approved":False,
        "limitations":["QA includes test-only forced landing for accurate perk math; not a human playthrough.",
                       "Phone touch ergonomics, visual/audio quality, long-run balance and actual playtime require human review."]}
def check(label,ok,extra=None):
    item={"name":label,"passed":bool(ok)}
    if extra is not None:item["detail"]=extra
    report["checks"].append(item)
    if not ok:raise AssertionError(label+": "+str(extra))
def test():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            for width,height in [(320,700),(390,844),(768,1024),(1280,800)]:
                context=browser.new_context(viewport={"width":width,"height":height},is_mobile=width<800,has_touch=width<800)
                page=context.new_page()
                page.on("pageerror",lambda e:report["js_errors"].append(str(e)))
                page.on("request",lambda req:report["external_requests"].append(req.url)
                     if urlsplit(req.url).scheme in ("http","https") and urlsplit(req.url).netloc!=urlsplit(origin).netloc else None)
                k=f"{width}x{height}"
                rsp=page.goto(origin+"/games/roulette-rogue/v03.html?e2e=1")
                check(k+" main served",rsp is not None and rsp.ok)
                check(k+" CSS loaded",page.locator(".tactics").count()==1)
                check(k+" no horizontal overflow",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
                check(k+" 56 upgrades",page.evaluate("new Set(window.__rouletteTest.perkIds()).size") == 56)
                page.screenshot(path=str(OUT/f"title-{k}.png"),full_page=True)
                page.locator("#modal-main").click()
                check(k+" shows three upgrades",page.locator("#choices .card").count()==3)
                page.locator("#choices .card").first.click()
                if page.locator(".placement button").count():page.locator(".placement button").first.click()
                check(k+" battle starts",page.evaluate("window.__rouletteTest.snapshot().mode")=="battle")
                check(k+" strategy buttons visible",page.locator("#tactics").is_visible() and page.locator(".tactic").count()==3)
                page.locator('[data-tactic="greed"]').click()
                check(k+" greed selected",page.locator('[data-tactic="greed"]').get_attribute("class").find("selected")!=-1)
                page.locator("#numbers button").first.click()
                check(k+" target selected",page.locator("#numbers button.focused").count()==1)
                page.screenshot(path=str(OUT/f"strategy-{k}.png"),full_page=True)
                page.locator("#main").click()
                check(k+" wheel spins",page.evaluate("window.__rouletteTest.snapshot().phase")=="spinning")
                page.evaluate("window.__rouletteTest.toJudge()")
                check(k+" judge appears",page.locator("#judge-tools").is_visible())
                check(k+" prediction shows outcome",page.locator("#pred-outcome").inner_text() in ("客の的中","客のハズレ"))
                page.locator("#reroll").click()
                check(k+" reroll spins",page.evaluate("window.__rouletteTest.snapshot().phase")=="spinning")
                page.evaluate("window.__rouletteTest.toJudge()")
                check(k+" reroll consumed",page.locator("#reroll").is_disabled())
                page.locator("#settle").click()
                check(k+" detailed receipt shown",page.locator("#receipt-screen").is_visible())
                receipt=page.evaluate("window.__rouletteTest.receipt()")
                check(k+" receipt contains named money events",len(receipt["rows"])>=2,receipt)
                check(k+" receipt balances reconcile",sum(row["delta"] for row in receipt["rows"])==receipt["end"]-receipt["start"],receipt)
                check(k+" reroll cost item exists",any("再抽選" in row["name"] and row["delta"]==-22 for row in receipt["rows"]))
                page.screenshot(path=str(OUT/f"receipt-start-{k}.png"),full_page=True)
                page.locator("#receipt-next").click()
                check(k+" receipt advances",page.evaluate("window.__rouletteTest.receipt().index")==1)
                page.locator("#receipt-skip").click()
                check(k+" receipt shows final net",page.evaluate("window.__rouletteTest.receipt().index==window.__rouletteTest.receipt().rows.length"))
                page.screenshot(path=str(OUT/f"receipt-final-{k}.png"),full_page=True)
                page.locator("#receipt-next").click()
                check(k+" receipt can close",page.locator("#receipt-screen").is_hidden())
                check(k+" autosave exists",page.evaluate("window.__rouletteTest.hasSave()"))
                context.close()

            context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
            page=context.new_page()
            page.on("pageerror",lambda e:report["js_errors"].append(str(e)))
            page.goto(origin+"/games/roulette-rogue/v03.html?e2e=1")
            page.locator("#modal-main").click();page.locator("#choices .card").first.click()
            if page.locator(".placement button").count():page.locator(".placement button").first.click()
            # QA-only perk injection, to check actual transfer attribution for separate cards.
            page.evaluate("""() => {let t=window.__rouletteTest;t.givePerk('g04');t.givePerk('p01',1);}""")
            page.locator('[data-tactic="greed"]').click()
            page.locator("#main").click();page.evaluate("window.__rouletteTest.toJudge()")
            page.evaluate("window.__rouletteTest.setNumber(1)")
            page.locator("#settle").click()
            row=page.evaluate("window.__rouletteTest.receipt()")
            check("red global perk represented separately",any(r["name"]=="赤の呪術" and r["delta"]>0 for r in row["rows"]),row)
            check("pocket-specific perk represented separately",any(r["name"]=="鉄の徴収機" and r["delta"]>0 for r in row["rows"]),row)
            check("per-upgrade final sum equals bank movement",sum(r["delta"] for r in row["rows"])==row["end"]-row["start"],row)
            check("no JS exceptions",not report["js_errors"],report["js_errors"])
            check("no external requests",not report["external_requests"],report["external_requests"])
            report["upgrade_receipt_example"]=row
            browser.close()
            report["status"]="passed"
    except Exception as e:
        report["failure"]=type(e).__name__+": "+str(e)
        raise
    finally:
        server.shutdown()
        (OUT/"test-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"status":report["status"],"count":len(report["checks"]),"error":report.get("failure")},ensure_ascii=False))
if __name__=="__main__":test()

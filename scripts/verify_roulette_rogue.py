"""Chromium acceptance tests for #003 Roulette Rogue. Not a release approval."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evaluation" / "roulette-rogue"
OUT.mkdir(parents=True, exist_ok=True)
report = {"game": "#003 roulette-rogue", "status": "failed", "checks": [],
          "browser_errors": [], "external_requests": [],
          "human_review": "pending: physical phone, enjoyment, balance, release, and real gameplay video",
          "release_approved": False}

def check(name, ok):
    report["checks"].append({"name": name, "passed": bool(ok)})
    if not ok:
        raise AssertionError(name)

def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            for width,height in [(320,700),(390,844),(768,1024),(1280,800)]:
                ctx=browser.new_context(viewport={"width":width,"height":height},
                                        is_mobile=width<800,has_touch=width<800)
                page=ctx.new_page()
                page.on("pageerror",lambda e:report["browser_errors"].append(str(e)))
                page.on("request",lambda r: report["external_requests"].append(r.url)
                        if urlsplit(r.url).scheme in ("http","https")
                        and urlsplit(r.url).netloc!=urlsplit(origin).netloc else None)
                response=page.goto(origin+"/games/roulette-rogue/?e2e=1&seed=12345")
                prefix=f"{width}x{height}"
                check(prefix+" page served",response is not None and response.ok)
                check(prefix+" 30 unique upgrades",
                      page.evaluate("new Set(window.__rouletteTest.perkNames()).size") == 30)
                check(prefix+" no horizontal overflow",
                      page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
                check(prefix+" title",page.locator("#modal-title").inner_text()=="ROULETTE ROGUE")
                page.screenshot(path=str(OUT/f"intro_{prefix}.png"),full_page=True)
                page.locator("#modal-main").click()
                check(prefix+" three perk choices",page.locator(".card").count()==3)
                page.screenshot(path=str(OUT/f"upgrade_{prefix}.png"),full_page=True)
                page.locator(".card").first.click()
                if page.locator(".pick").count():
                    page.locator(".pick").first.click()
                check(prefix+" first customer",
                      page.evaluate("window.__rouletteTest.snapshot().wave")==1)
                check(prefix+" hidden judge buttons",page.locator("#judge-actions").is_hidden())
                page.screenshot(path=str(OUT/f"game_{prefix}.png"),full_page=True)
                page.locator("#spin-button").click()
                check(prefix+" spinning",page.evaluate("window.__rouletteTest.snapshot().phase")=="spinning")
                page.evaluate("window.__rouletteTest.goToJudge()")
                check(prefix+" judging",page.evaluate("window.__rouletteTest.snapshot().phase")=="judge")
                before=page.evaluate("window.__rouletteTest.snapshot().landed")
                page.locator("#nudge-right").click()
                check(prefix+" nudge right",page.evaluate("window.__rouletteTest.snapshot().landed")==((before+1)%13))
                check(prefix+" nudge spent",page.evaluate("window.__rouletteTest.snapshot().shiftUses")==0)
                page.locator("#resolve").click()
                check(prefix+" settled",page.evaluate("window.__rouletteTest.snapshot().phase")=="result")
                check(prefix+" purse and bank are finite",page.evaluate("""() => {
                  const s=window.__rouletteTest.snapshot();
                  return Number.isFinite(s.bank)&&Number.isFinite(s.guest.wallet);
                }"""))
                ctx.close()

            # Simulates 6 complete encounters via deterministic test helpers, not an actual play recording.
            ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
            page=ctx.new_page()
            page.on("pageerror",lambda e:report["browser_errors"].append(str(e)))
            page.goto(origin+"/games/roulette-rogue/?e2e=1&seed=20261106")
            final=page.evaluate("""() => {
                const $=id=>document.getElementById(id),t=window.__rouletteTest;
                $('modal-main').click();
                let spins=0;
                for(let i=0;i<230;i++){
                    const s=t.snapshot();
                    if(['gameover','victory'].includes(s.mode))break;
                    if(s.mode==='upgrade'){
                        const c=document.querySelector('.card');if(!c)throw Error('missing upgrade');
                        c.click();
                        if(t.snapshot().mode==='placement')document.querySelector('.pick').click();
                        continue;
                    }
                    if(s.mode==='battle'){
                        if(s.phase==='bet'){$('spin-button').click();t.goToJudge();spins++;continue;}
                        if(s.phase==='judge'){$('resolve').click();continue;}
                        if(s.phase==='result'){$('spin-button').click();continue;}
                    }
                    throw Error('invalid state '+JSON.stringify(s));
                }
                return {...t.snapshot(),spins};
            }""")
            check("6-guest flow reaches an ending",final["mode"] in ("victory","gameover"))
            check("encounters advance",final["wave"]>=1 and final["spins"]>=1)
            report["simulation_outcome"]=final
            check("no JS exceptions",not report["browser_errors"])
            check("no external calls",not report["external_requests"])
            ctx.close()
            browser.close()
            report["status"]="passed"
    except Exception as e:
        report["error"]=type(e).__name__+": "+str(e)
        raise
    finally:
        server.shutdown()
        (OUT/"test-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"status":report["status"],"checks":len(report["checks"]),
                          "error":report.get("error")},ensure_ascii=False))

if __name__=="__main__":
    main()

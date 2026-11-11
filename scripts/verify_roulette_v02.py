"""ROULETTE ROGUE DX v0.2 — real Chromium acceptance, deterministic QA only.
Tests do not represent a human full-run playthrough or a release approval.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import threading, json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"evaluation"/"roulette-rogue-v02"
OUT.mkdir(parents=True,exist_ok=True)
report={"status":"failed","game":"ROULETTE ROGUE DX / long-run alpha",
        "checks":[],"errors":[],"external_requests":[],
        "release_approved":False,"real_time_60_minute_run":"NOT VERIFIED",
        "manual_review":"NOT DONE: PC, real mobile, balancing, 1-hour pacing, fun, video"}
def check(name,ok,details=None):
    obj={"name":name,"passed":bool(ok)}
    if details is not None:obj["details"]=details
    report["checks"].append(obj)
    if not ok:raise AssertionError(name+" "+str(details or ""))

def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base="http://127.0.0.1:"+str(server.server_port)
    url=base+"/games/roulette-rogue/v02.html?e2e=1"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            for width,height in [(320,700),(390,844),(768,1024),(1280,800)]:
                context=browser.new_context(viewport={"width":width,"height":height},
                    is_mobile=width<800,has_touch=width<800)
                page=context.new_page()
                page.on("pageerror",lambda err: report["errors"].append(str(err)))
                page.on("request",lambda req:report["external_requests"].append(req.url)
                    if urlsplit(req.url).scheme in ("http","https")
                    and urlsplit(req.url).netloc!=urlsplit(base).netloc else None)
                resp=page.goto(url)
                k=str(width)+"x"+str(height)
                check(k+": served",resp is not None and resp.ok)
                check(k+": 56 unique upgrades",page.evaluate("new Set(window.__rouletteTest.perkIds()).size") == 56)
                check(k+": no horizontal overflow",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
                check(k+": title visible",page.locator("#mtitle").is_visible())
                page.screenshot(path=str(OUT/("title-"+k+".png")),full_page=True)
                page.locator("#modal-main").click()
                check(k+": upgrade 3 offers",page.locator("#choices .card").count()==3)
                page.screenshot(path=str(OUT/("upgrades-"+k+".png")),full_page=True)
                page.locator("#choices .card").first.click()
                if page.locator("#choices .placement button").count():
                    page.locator("#choices .placement button").first.click()
                snap=page.evaluate("window.__rouletteTest.snapshot()")
                check(k+": guest 1 starts",snap["wave"]==1 and snap["mode"]=="battle",snap)
                page.screenshot(path=str(OUT/("battle-"+k+".png")),full_page=True)
                page.locator("#main").click()
                check(k+": spinning",page.evaluate("window.__rouletteTest.snapshot().phase")=="spinning")
                page.evaluate("window.__rouletteTest.toJudge()")
                check(k+": judge state",page.evaluate("window.__rouletteTest.snapshot().phase")=="judge")
                old=page.evaluate("window.__rouletteTest.snapshot().landed")
                page.locator("#left").click()
                new=page.evaluate("window.__rouletteTest.snapshot().landed")
                check(k+": nudge works",old != new)
                page.locator("#settle").click()
                check(k+": result state",page.evaluate("window.__rouletteTest.snapshot().phase") in ("result","finished"))
                check(k+": autosave available",page.evaluate("window.__rouletteTest.hasSave()"))
                page.reload()
                check(k+": resume appears",page.locator("#choices button").filter(has_text="CONTINUE").count()==1)
                page.locator("#choices button").filter(has_text="CONTINUE").click()
                check(k+": save restored",page.evaluate("window.__rouletteTest.snapshot().wave")==1)
                context.close()

            # Deterministic state-machine test; forces landing number 0 after real spin button.
            # Not a claim that any human can win 50 customers without tuning.
            ctx=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
            page=ctx.new_page()
            page.on("pageerror",lambda err: report["errors"].append(str(err)))
            page.goto(url+"&seed=99")
            page.locator("#modal-main").click()
            outcome=page.evaluate("""() => {
              const q=window.__rouletteTest,$=id=>document.getElementById(id);
              let cycles=0,upgrades=0,spins=0,stages=[];
              while(cycles++<1800){
                const s=q.snapshot();
                if(!s)throw Error("missing state");
                if(s.mode==="victory"||s.mode==="gameover")break;
                if(s.mode==="upgrade"){
                  const card=document.querySelector("#choices .card");
                  if(!card)throw Error("missing upgrade card");
                  card.click();upgrades++;continue;
                }
                if(s.mode==="slot"){
                  const slot=document.querySelector("#choices .placement button");
                  if(!slot)throw Error("missing slot choice");
                  slot.click();continue;
                }
                if(s.mode==="rest"){
                  const card=document.querySelector("#choices .card");
                  if(!card)throw Error("missing intermission");
                  card.click();stages.push(s.wave);continue;
                }
                if(s.mode==="battle"){
                  if(s.phase==="bet"){$("main").click();q.toJudge();q.setNumber(0);spins++;continue;}
                  if(s.phase==="judge"){$("settle").click();continue;}
                  if(s.phase==="result"){$("main").click();continue;}
                }
                throw Error("unexpected mode "+JSON.stringify(s));
              }
              return {...q.snapshot(),cycles,spins,upgrades,stages};
            }""")
            check("full-run state-machine reaches terminal state",outcome["mode"] in ("victory","gameover"),outcome)
            check("long-run simulation progresses beyond 6 guests",outcome["wave"]>=7,outcome)
            check("multiple upgrades available",outcome["upgrades"]>=5,outcome)
            check("20+ spins possible",outcome["spins"]>=20,outcome)
            report["deterministic_state_machine"]=outcome
            check("no browser JS exceptions",not report["errors"],report["errors"])
            check("no external requests",not report["external_requests"],report["external_requests"])
            ctx.close();browser.close()
            report["status"]="passed"
    except Exception as exc:
        report["failure"]=type(exc).__name__+": "+str(exc)
        raise
    finally:
        server.shutdown()
        (OUT/"test-results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"status":report["status"],"count":len(report["checks"]),"failure":report.get("failure")},ensure_ascii=False))

if __name__=="__main__":main()

#!/usr/bin/env python3
"""Smoke tests for the original-UI TPS port. Runs headless Chromium, no cheats for movement."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, subprocess, tempfile, os

ROOT=Path(__file__).resolve().parents[0]
HTML=ROOT/'games/robo-salvage-tps-preserved/index.html'
if not HTML.exists():
    HTML=Path('games/robo-salvage-tps-preserved/index.html').resolve()
SAMPLES=Path('evaluation/robo-tps-preserved')
SAMPLES.mkdir(parents=True, exist_ok=True)
text=HTML.read_text(encoding='utf-8')
js=re.findall(r'<script[^>]*>(.*?)</script\s*>',text,re.S|re.I)
assert len(js)==1,f"expected one inline script, got {len(js)}"
with tempfile.TemporaryDirectory() as d:
    source=Path(d)/'game.js'
    source.write_text(js[0],encoding='utf-8')
    subprocess.run(['node','--check',str(source)],check=True)

results=[]
with sync_playwright() as p:
    path=os.environ.get('CHROMIUM_EXECUTABLE')
    kwargs={'headless':True, 'args':['--no-sandbox','--disable-gpu-sandbox']}
    if path: kwargs['executable_path']=path
    browser=p.chromium.launch(**kwargs)
    for label, viewport, mobile in [('desktop',{'width':1280,'height':720},False),('portrait',{'width':390,'height':844},True),('landscape',{'width':844,'height':390},True)]:
        ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(HTML.as_uri(),wait_until='domcontentloaded',timeout=25000)
        page.wait_for_timeout(350)
        # The original title screen and original hangar must exist.
        if page.locator('#titleEnter').count() and page.locator('#titleEnter').is_visible():
            page.locator('#titleEnter').click()
        assert page.locator('.hangarDialog').count()==1, f'{label}: original hangar missing'
        assert page.locator('[data-starter]').count()==8, f'{label}: eight original starter weapons missing'
        assert page.locator('[data-meta]').count()==4, f'{label}: original research upgrades missing'
        page.screenshot(path=str(SAMPLES/f'{label}-hangar.png'))
        page.locator('#startBtn').click()
        page.wait_for_timeout(200)
        assert page.locator('.routeDialog').count()==1,f'{label}: route map missing'
        assert page.locator('.mapBoard').count()==1,f'{label}: exact original SVG route map missing'
        assert page.locator('.map-node').count()>=50,f'{label}: original map nodes missing'
        page.screenshot(path=str(SAMPLES/f'{label}-route.png'))
        # First row always has a center fight node in the original progression.
        fight=page.locator('#mapScroll [data-route="fight"]').first
        assert fight.count()==1,f'{label}: no fight node on route'
        fight.click(force=True)
        page.wait_for_timeout(200)
        assert page.locator('#phaseContinue').count()==1,f'{label}: original ready card missing'
        page.locator('#phaseContinue').click()
        page.wait_for_timeout(450)
        data=page.evaluate('window.__roboTPS')
        stats=page.evaluate('window.__roboQA()')
        assert data['active'] and data['state']=='fight',f'{label}: not in TPS combat: {data}'
        assert stats['playerStats']['spd']>=215, f'{label}: speed lower than original starter spec: {stats["playerStats"]["spd"]}'
        assert page.locator('#tpsLook').is_visible(),f'{label}: camera stick absent'
        assert page.locator('#fireTouch').is_hidden(),f'{label}: unwanted FIRE button visible'
        # Compare original 2D movement speed used by TPS implementation.
        old=stats['player']
        page.keyboard.down('w')
        page.wait_for_timeout(420)
        page.keyboard.up('w')
        # Quality upgrade: 7 deterministic outdoor/indoor themes and speed trails.
        quality=page.evaluate('window.__roboTPSV04')
        assert quality['originalUI'], f'{label}: original UI integration missing'
        assert quality['fields']==['荒野','砂原','雪山','山岳','市街地','川','スタジアム'], f'{label}: field catalog mismatch'
        assert quality['field']=='荒野', f'{label}: first field should be wasteland'
        assert quality['trailCount']>0, f'{label}: motion trail not emitted while moving'
        moving=page.evaluate('window.__roboQA().player')
        distance=((moving['x']-old['x'])**2+(moving['y']-old['y'])**2)**.5
        assert distance>35,f'{label}: sluggish movement: {distance}'
        page.wait_for_timeout(160)
        stopped=page.evaluate('window.__roboQA().player')
        stop_delta=((stopped['x']-moving['x'])**2+(stopped['y']-moving['y'])**2)**.5
        assert stop_delta<3,f'{label}: did not stop when input released: {stop_delta}'
        yaw=page.evaluate('window.__roboTPS.aim.yaw')
        page.keyboard.down('ArrowRight');page.wait_for_timeout(280);page.keyboard.up('ArrowRight')
        yaw2=page.evaluate('window.__roboTPS.aim.yaw')
        assert yaw2-yaw>.3,f'{label}: camera input not responsive'
        # Verify dash visual state after a real Shift key press.
        page.keyboard.down('Shift')
        page.wait_for_timeout(85)
        dash=page.evaluate('window.__roboTPSV04')
        page.keyboard.up('Shift')
        assert dash['dashKick']>0.1, f'{label}: dash speed visual absent'
        page.screenshot(path=str(SAMPLES/f'{label}-battle.png'))
        if label=='desktop':
            # Visual regression references for every TPS field without changing game menus.
            field_names=['waste','desert','snow','mountain','city','river','arena']
            field_labels=['荒野','砂原','雪山','山岳','市街地','川','スタジアム']
            for n,name in enumerate(field_names):
                actual=page.evaluate('(i)=>window.__roboTPSPreviewField(i)',n)
                assert actual==field_labels[n], f'Biome switching failed {n}: {actual}'
                page.wait_for_timeout(95)
                page.screenshot(path=str(SAMPLES/f'biome-{n+1:02d}-{name}.png'))
        assert not errors, f'{label}: JavaScript errors: {errors[:4]}'
        results.append({'screen':label,'hangar_weapons':8,'route_nodes':page.locator('.map-node').count(),'speed':stats['playerStats']['spd'],'movement_420ms':round(distance,1),'stopped_drift':round(stop_delta,2),'yaw_delta':round(yaw2-yaw,2),'JS_errors':len(errors),'field':quality['field'],'trails':quality['trailCount'],'dashKick':round(dash['dashKick'],2)})
        ctx.close()
    browser.close()
Path('evaluation/robo-tps-preserved/results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))

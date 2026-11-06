#!/usr/bin/env python3
"""Video team's verified capture of real browser gameplay for PIXEL TREBUCHET."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright
from verify_catapult import serving

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "games/catapult/index.html"
EVAL = ROOT / "evaluation/catapult"
OUT = ROOT / "videos/catapult"
SIZE = (540, 960)

def probe(path):
    p=subprocess.run(["ffprobe","-v","error","-show_entries",
                      "format=duration:stream=codec_name,width,height",
                      "-of","json",str(path)],text=True,capture_output=True,check=True)
    return json.loads(p.stdout)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    accepted=json.loads((EVAL/"review.json").read_text(encoding="utf-8"))
    source_hash=hashlib.sha256(GAME.read_bytes()).hexdigest()
    if accepted["technical_smoke_gate"]!="passed" or accepted["source_sha256"]!=source_hash:
        raise RuntimeError("Evaluation team has not approved this exact source")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("FFmpeg and ffprobe required")
    shots=0
    errors=[]
    with tempfile.TemporaryDirectory() as td, serving() as url, sync_playwright() as pw:
        opts={"headless":True,"args":["--no-sandbox","--disable-dev-shm-usage"]}
        if os.environ.get("CHROMIUM_EXECUTABLE"):
            opts["executable_path"]=os.environ["CHROMIUM_EXECUTABLE"]
        browser=pw.chromium.launch(**opts)
        context=browser.new_context(viewport={"width":SIZE[0],"height":SIZE[1]},
                                    device_scale_factor=1, reduced_motion="reduce",
                                    record_video_dir=td,
                                    record_video_size={"width":SIZE[0],"height":SIZE[1]})
        page=context.new_page()
        page.on("pageerror",lambda error: errors.append(str(error)))
        # Record from fresh stage 1, with naturally available equipment and gold.
        # Do not fabricate progress or unlocked upgrades using localStorage.
        page.goto(url,wait_until="domcontentloaded",timeout=20000)
        page.locator("#fire").wait_for()
        page.wait_for_timeout(800)
        if "01 / 10" not in page.locator("#stageText").inner_text():
            raise RuntimeError("Expected first stage without fabricated progression")
        # Predictive ballistics: pin=114, wind=85 lands near the first target.
        # The ensuing destruction must be measured from the real game.
        page.locator("#pin").evaluate("""el => {
            el.value = "114"; el.dispatchEvent(new Event("input", {bubbles: true}));
        }""")
        page.locator("#fire").click()
        shots+=1
        page.wait_for_timeout(6500)
        if page.locator("#fire").is_enabled():
            page.locator("#fire").click()
            shots+=1
        page.wait_for_timeout(8500)
        state=page.locator("#status").inner_text()
        percent=page.locator("#percentText").inner_text()
        if int(percent.rstrip("%")) <= 0:
            raise RuntimeError("Gameplay footage had 0% destruction; retune the aim")
        video=page.video
        context.close()
        if errors:
            browser.close()
            raise RuntimeError("JavaScript errors during capture: "+repr(errors))
        raw=Path(video.path())
        if not raw.exists() or raw.stat().st_size==0:
            browser.close()
            raise RuntimeError("Chromium did not save real browser recording")
        output=OUT/"gameplay.mp4"
        cmd=["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(raw),
             "-t","15.0",
             "-vf","fps=24,scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2",
             "-an","-c:v","libx264","-preset","veryfast","-crf","24",
             "-pix_fmt","yuv420p","-movflags","+faststart",str(output)]
        subprocess.run(cmd,check=True,timeout=120)
        browser.close()
    info=probe(output)
    duration=float(info["format"]["duration"])
    streams=[s for s in info["streams"] if s["codec_name"]=="h264"]
    if not streams or streams[0]["width"]!=540 or streams[0]["height"]!=960:
        raise RuntimeError("Wrong codec or frame size")
    if not (10<=duration<=20):
        raise RuntimeError(f"Duration outside target: {duration}")
    report={
        "game_id":"catapult","timestamp":datetime.now(timezone.utc).isoformat(),
        "source_sha256":source_hash,"status":"passed",
        "capture_method":"Playwright Chromium record_video of the real game",
        "stage_recorded":"01 / 10 (unmodified starter progression; no cheats)",
        "shots_fired":shots,"final_status_display":state,
        "final_destruction_percentage_display":percent,
        "file":"videos/catapult/gameplay.mp4",
        "video_sha256":hashlib.sha256(output.read_bytes()).hexdigest(),
        "duration_seconds":round(duration,3),"width":540,"height":960,"codec":"h264",
        "human_review":"pending","game_public_url":None,"x_post":"not_published",
        "note":"Technical recording success is not a gameplay balance or publication approval."
    }
    (OUT/"recording.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("status","duration_seconds","shots_fired","file","human_review")},ensure_ascii=False))
    return 0

if __name__=="__main__":
    try: sys.exit(main())
    except Exception as exc:
        print(f"Video capture failed: {type(exc).__name__}: {exc}",file=sys.stderr)
        sys.exit(1)

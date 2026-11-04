#!/usr/bin/env python3
"""Record actual Chromium gameplay after the game team's checks have passed."""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
import uuid

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 540, 960


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def capture(url: str, temporary: Path) -> dict:
    from playwright.async_api import async_playwright

    executable = os.environ.get("CHROMIUM_EXECUTABLE") or shutil.which("chromium") or shutil.which("chromium-browser")
    frames: list[tuple[float, Path]] = []
    operations: list[dict] = []
    errors: list[str] = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=executable,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            context = await browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
            page = await context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(url, wait_until="networkidle", timeout=15000)
            await page.locator("body[data-state='ready']").wait_for()
            client = await context.new_cdp_session(page)
            started = time.monotonic()

            async def on_frame(event: dict) -> None:
                received = time.monotonic()
                frame_path = temporary / f"frame-{len(frames):06d}.jpg"
                frame_path.write_bytes(base64.b64decode(event["data"]))
                frames.append((received, frame_path))
                await client.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})

            client.on("Page.screencastFrame", on_frame)
            await client.send("Page.startScreencast", {
                "format": "jpeg", "quality": 90,
                "maxWidth": WIDTH, "maxHeight": HEIGHT, "everyNthFrame": 2,
            })
            await asyncio.sleep(1.0)
            await page.locator("#start-button").click()
            operations.append({"action": "start", "at_seconds": round(time.monotonic() - started, 3)})
            gameplay_started = time.monotonic()
            while time.monotonic() - gameplay_started < 11.5:
                if await page.locator("body").get_attribute("data-state") != "playing":
                    break
                await page.locator("#target").click(timeout=1500)
                operations.append({
                    "action": "target_click", "at_seconds": round(time.monotonic() - started, 3),
                    "score_after": int((await page.locator("#score").inner_text()).strip()),
                })
                await asyncio.sleep(0.34)
            await page.locator("body[data-state='finished']").wait_for(timeout=3000)
            await page.locator("#result").wait_for(state="visible")
            score = int((await page.locator("#score").inner_text()).strip())
            result_text = await page.locator("#result").inner_text()
            operations.append({"action": "result_visible", "at_seconds": round(time.monotonic() - started, 3), "score": score})
            await asyncio.sleep(max(0.0, 16.0 - (time.monotonic() - started)))
            ended = time.monotonic()
            await client.send("Page.stopScreencast")
            if errors:
                raise RuntimeError(f"録画中の JavaScript エラー: {errors}")
            if len(frames) < 30 or score < 2:
                raise RuntimeError("録画フレームまたは実操作による得点が不足しています。")
            if not 10 <= ended - started <= 20:
                raise RuntimeError("録画実時間が 10〜20 秒の範囲外です。")
            # Chromium emits changed screen frames. Preserve the observed real-time
            # intervals instead of playing every captured frame at an arbitrary rate.
            concat = temporary / "frames.txt"
            entries: list[str] = []
            for index, (received, frame_path) in enumerate(frames):
                frame_start = started if index == 0 else received
                next_time = frames[index + 1][0] if index + 1 < len(frames) else ended
                duration = max(0.001, next_time - frame_start)
                entries.extend([f"file '{frame_path.name}'", f"duration {duration:.6f}"])
            entries.append(f"file '{frames[-1][1].name}'")
            concat.write_text("\n".join(entries) + "\n", encoding="utf-8")
            return {
                "concat": concat,
                "duration_seconds": round(ended - started, 3),
                "captured_frames": len(frames),
                "operations": operations,
                "final_score": score,
                "result_text": result_text,
                "javascript_errors": errors,
                "browser": browser.version,
            }
        finally:
            await browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--game", default="tap-spark")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.game):
        parser.error("--game は英小文字・数字・ハイフンの ID にしてください。")
    parsed = urlparse(args.base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        parser.error("--base-url にはローカル検証用 HTTP サーバーを指定してください。")
    output = ROOT / "videos" / args.game
    output.mkdir(parents=True, exist_ok=True)
    movie = output / "gameplay.mp4"
    # Old results must never make a failed rerun appear to have passed.
    movie.unlink(missing_ok=True)
    pending_movie = output / "gameplay.pending.mp4"
    pending_movie.unlink(missing_ok=True)
    report = {
        "status": "recording", "game_id": args.game, "run_id": str(uuid.uuid4()),
        "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
        "capture_method": "Chromium CDP Page.startScreencast; real-time browser input",
        "public_url": None, "human_review": "pending", "x_posted": False,
    }
    checklist = {"status": "pending", "game_id": args.game, "public_url": None, "human_review": "pending"}
    write_json(output / "recording.json", report)
    write_json(output / "checklist.json", checklist)
    try:
        for command in ("ffmpeg", "ffprobe"):
            if not shutil.which(command):
                raise RuntimeError(f"{command} がありません。")
        source = ROOT / "games" / args.game / "index.html"
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        report["source_sha256"] = source_hash
        test_path = source.parent / "test-results.json"
        tests = json.loads(test_path.read_text(encoding="utf-8"))
        if tests.get("status") != "passed" or tests.get("game_id") != args.game or tests.get("source_sha256") != source_hash:
            raise RuntimeError("同じゲームソースの合格テスト結果がありません。ゲームチームに差し戻してください。")
        report["game_test_status"] = "passed"
        report["game_test_results"] = test_path.relative_to(ROOT).as_posix()
        url = args.base_url.rstrip("/") + f"/games/{args.game}/index.html"
        with tempfile.TemporaryDirectory(prefix="minigame1go-capture-") as temporary_name:
            captured = asyncio.run(capture(url, Path(temporary_name)))
            concat = captured.pop("concat")
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "concat", "-safe", "0", "-i", str(concat),
                "-vf", f"scale={WIDTH}:{HEIGHT},setsar=1,fps=30",
                "-t", str(captured["duration_seconds"]),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(pending_movie),
            ], check=True, timeout=90, capture_output=True, text=True)
        probe = json.loads(subprocess.run([
            "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(pending_movie),
        ], check=True, timeout=15, capture_output=True, text=True).stdout)
        video = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
        duration = float(probe["format"]["duration"])
        checks = {
            "game_tests_passed_for_same_source": True,
            "real_browser_gameplay": True,
            "multiple_scored_inputs": captured["final_score"] >= 2,
            "result_screen_captured": bool(captured["result_text"]),
            "duration_10_to_20_seconds": 10 <= duration <= 20,
            "portrait_9_by_16": video["width"] * 16 == video["height"] * 9,
            "h264": video["codec_name"] == "h264",
            "yuv420p": video["pix_fmt"] == "yuv420p",
            "source_unchanged_during_recording": hashlib.sha256(source.read_bytes()).hexdigest() == source_hash,
            "script_exists": (output / "script.md").is_file(),
            "post_draft_exists": (output / "post-draft.md").is_file(),
        }
        if not all(checks.values()):
            raise RuntimeError(f"動画チェック不合格: {checks}")
        pending_movie.replace(movie)
        report.update(captured)
        report.update({
            "status": "passed", "video_path": movie.relative_to(ROOT).as_posix(),
            "video_sha256": hashlib.sha256(movie.read_bytes()).hexdigest(),
            "video": {"duration_seconds": duration, "width": video["width"], "height": video["height"], "codec": video["codec_name"], "pixel_format": video["pix_fmt"], "audio": "none"},
        })
        checklist.update({"status": "passed", "source_sha256": source_hash, "checks": checks, "publication_status": "not_published", "x_policy_review": "pending"})
        write_json(output / "recording.json", report)
        write_json(output / "checklist.json", checklist)
        print(f"動画検証 PASS: {movie.relative_to(ROOT)} ({duration:.2f}s, {video['width']}x{video['height']}, 得点 {captured['final_score']})")
        return 0
    except Exception as error:
        pending_movie.unlink(missing_ok=True)
        movie.unlink(missing_ok=True)
        message = str(error)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            message += ": " + error.stderr[-2000:]
        report.update({"status": "failed", "error": message})
        checklist.update({"status": "failed", "error": message})
        write_json(output / "recording.json", report)
        write_json(output / "checklist.json", checklist)
        print(f"動画検証 FAIL: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

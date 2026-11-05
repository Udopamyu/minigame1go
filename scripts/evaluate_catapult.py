#!/usr/bin/env python3
"""Game-evaluation team's explicit release decision, separate from smoke pass."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/"evaluation/catapult/test-results.json"
GAME=ROOT/"games/catapult/index.html"
OUTPUT=ROOT/"evaluation/catapult/review.json"

def main():
    tests=json.loads(REPORT.read_text(encoding="utf-8"))
    current=hashlib.sha256(GAME.read_bytes()).hexdigest()
    text=GAME.read_text(encoding="utf-8")
    required_controls=['id="game"','id="fire"','id="cameraSlide"','id="openShop"','id="upgrades"','id="pin"','id="wind"']
    missing=[x for x in required_controls if x not in text]
    automation_gate=tests["status"]=="passed" and tests["source_sha256"]==current and not missing
    output={
        "game_id":"catapult",
        "timestamp":datetime.now(timezone.utc).isoformat(),
        "source_sha256":current,
        "technical_smoke_gate":"passed" if automation_gate else "failed",
        "checks_passed":sum(x["passed"] for x in tests["checks"]),
        "checks_total":len(tests["checks"]),
        "missing_controls":missing,
        "human_review_required":True,
        "release_status":"blocked_pending_manual_evaluation",
        "unverified":[
            "all 10 stages genuinely clearable without modifying localStorage",
            "upgrade and projectile progression balance",
            "mobile control comfort, text and target visibility",
            "video is entertaining and accurately represents actual gameplay",
            "game URL is publicly accessible and correct"
        ],
        "handoff":"video team may record *only* if technical smoke gate passed; publishing is still blocked"
    }
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"technical_smoke_gate":output["technical_smoke_gate"],
                      "release_status":output["release_status"]},ensure_ascii=False))
    return 0 if automation_gate else 1
if __name__=="__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Static release checks for the public PATROL × ROBO SALVAGE single-file HTML.

Technical packaging only — it does not stand in for human play-testing, real devices or a live URL.

  python scripts/patrol_release_preflight.py      # writes games/patrol-robo-salvage/qa/release-preflight.json
"""
from __future__ import annotations

import hashlib, json, re, subprocess, sys, tempfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_patrol_salvage import ROOT, build  # noqa: E402

GAME = ROOT / "games" / "patrol-robo-salvage"
OUTPUT = GAME / "qa" / "release-preflight.json"


class Inspection(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = self.styles = 0
        self.meta = {}
        self.title = ""
        self._in_title = False
        self.icon = False
        self.external = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script":
            self.scripts += 1
        if tag == "style":
            self.styles += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta" and a.get("content"):
            self.meta[a.get("name") or a.get("property") or ""] = a["content"]
        if tag == "link" and "icon" in (a.get("rel") or ""):
            self.icon = True
        for attr in ("src", "href"):
            v = a.get(attr) or ""
            if tag in {"script", "link", "img", "source", "audio", "video", "iframe"} and v.startswith(("http:", "https:", "//", "/")):
                self.external.append(f"{tag}.{attr}={v[:100]}")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def main() -> int:
    html = (GAME / "index.html").read_text(encoding="utf-8")
    p = Inspection()
    p.feed(html)
    js = "\n".join(re.findall(r"<script\b[^>]*>(.*?)</script\s*>", html, flags=re.S | re.I))
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
    node = subprocess.run(["node", "--check", f.name], capture_output=True, text=True) if js else None
    checks = {
        "source_html_matches_bundler": html == build(),
        "javascript_syntax": bool(node) and node.returncode == 0,
        "exactly_one_inline_script_and_style": p.scripts == 1 and p.styles == 1,
        "no_external_or_root_relative_assets": not p.external,
        "no_remote_fetch_or_import": not re.search(r"\bfetch\s*\(|\bimport\s*\(|XMLHttpRequest|@import\s+url", html),
        "search_and_share_metadata": all(p.meta.get(k) for k in ("description", "og:title", "og:description")) and p.icon,
        "public_title": p.title.strip() == "PATROL × ROBO SALVAGE | ミニゲーム1GO",
        "tuning_ui_disabled": "const B3_LAB=false;" in html and "const B3_LAB=true;" not in html,
        "qa_hooks_only_for_automation": "if(navigator.webdriver)window.__b3QA=" in html,
        "no_ricochet_weapon": not re.search(r"id:'bounce'", html),
        "shared_progress_storage": "roboSalvageMetaV1" in html,
        "no_secrets": not re.search(r"(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{12,}", html, re.I),
        "reference_builds_not_linked": "reference/" not in html,
    }
    report = {
        "game": "patrol-robo-salvage",
        "kind": "static release packaging preflight",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "success": all(checks.values()),
        "checks": checks,
        "html_bytes": len(html.encode("utf-8")),
        "html_sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "not_covered": ["human play-testing / difficulty", "real phones and real GPUs", "the GitHub Pages URL after merge"],
    }
    if node and node.returncode:
        report["node_error"] = node.stderr[-600:]
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for k, v in checks.items():
        print(("PASS " if v else "FAIL ") + k)
    print(f"{sum(checks.values())}/{len(checks)} → {OUTPUT.relative_to(ROOT)}")
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())

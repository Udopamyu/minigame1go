#!/usr/bin/env python3
"""Static release checks for the standalone Robo Salvage HTML.

Reports technical packaging only. Does not claim human review or a live URL.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from build_robo_salvage import ROOT, build

GAME=ROOT/"games"/"robo-salvage"
OUTPUT=ROOT/"evaluation"/"robo-salvage"/"release-preflight.json"


class Inspection(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts=0
        self.styles=0
        self.description=False
        self.og_title=False
        self.og_description=False
        self.external_assets=[]

    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="script":
            self.scripts+=1
        if tag=="style":
            self.styles+=1
        if tag=="meta":
            if attrs.get("name")=="description" and attrs.get("content"):
                self.description=True
            if attrs.get("property")=="og:title" and attrs.get("content"):
                self.og_title=True
            if attrs.get("property")=="og:description" and attrs.get("content"):
                self.og_description=True
        for attr in ("src","href"):
            value=attrs.get(attr,"")
            if tag in {"script","link","img","source","audio","video"} and value:
                if value.startswith(("http:","https:","//","/")):
                    self.external_assets.append(f"{tag}.{attr}={value[:120]}")


def main():
    template=(GAME/"src"/"template.html").read_text(encoding="utf-8")
    actual=(GAME/"index.html").read_text(encoding="utf-8")
    expected=build()
    parser=Inspection()
    parser.feed(actual)
    tests={
        "source_html_matches_bundler": actual==expected,
        "exactly_one_inline_script": parser.scripts==1,
        "exactly_one_inline_stylesheet": parser.styles==1,
        "no_external_or_root_relative_assets": not parser.external_assets,
        "search_and_share_metadata": parser.description and parser.og_title and parser.og_description,
        "no_unresolved_source_markers": all(x not in actual for x in
            ("<!-- @inline-css -->","<!-- @inline-js -->","/* @include-synergies */",
             "/* @include-pixel-art */")),
        "release_branding_without_prototype_label": "MINIGAME 1GO / PROTOTYPE" not in template,
        "permanent_progress_local_storage": "roboSalvageMetaV1" in actual,
        "latest_gameplay_features_bundled": all(x in actual for x in
            ("renderStatRadar","synergyEffectText","STARTER_UNLOCK_COST=40","handleRicochet",
             "showOpeningScreen","startFinisher","drawDestroyedMech","isEndlessBoss",
             "endlessUpgrades","clearedSummary")),
        "no_external_css_imports": not bool(re.search(r"@import\s+(?:url\s*\(|['\"])?\s*https?://",
                                              actual,re.IGNORECASE))
    }
    report={
        "game":"robo-salvage",
        "kind":"static release packaging preflight",
        "checked_at_utc":datetime.now(timezone.utc).isoformat(),
        "success":all(tests.values()),"checks":tests,
        "html_bytes":len(actual.encode("utf-8")),
        "external_asset_violations":parser.external_assets,
        "live_site_checked":False,
        "human_gameplay_review_complete":False
    }
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for check,passed in tests.items():
        print(("PASS" if passed else "FAIL")+" release: "+check,flush=True)
    print(f"Release packaging checks {sum(tests.values())}/{len(tests)}",flush=True)
    return 0 if report["success"] else 1


if __name__=="__main__":
    sys.exit(main())

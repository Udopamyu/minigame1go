#!/usr/bin/env python3
"""Build a portable single-file Robo Salvage HTML from editable source files.

Usage:
  python scripts/build_robo_salvage.py
  python scripts/build_robo_salvage.py --check
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "games" / "robo-salvage"
SOURCE = GAME / "src"
CSS_MARKER = "<!-- @inline-css -->"
JS_MARKER = "<!-- @inline-js -->"


def build() -> str:
    template = (SOURCE / "template.html").read_text(encoding="utf-8")
    css = (SOURCE / "game.css").read_text(encoding="utf-8")
    js = (SOURCE / "game.js").read_text(encoding="utf-8")
    # Modules are pasted *inside* the game IIFE. This keeps local file://
    # execution and avoids module loaders / CORS / external dependencies.
    modules = {
        "/* @include-synergies */": "synergies.js",
        "/* @include-pixel-art */": "pixel-art.js",
    }
    for marker, name in modules.items():
        if js.count(marker) != 1:
            raise ValueError(f"Expected exactly one {marker} in game.js")
        fragment = (SOURCE / name).read_text(encoding="utf-8")
        if "<script" in fragment.lower():
            raise ValueError(f"Unsafe script tag inside source module {name}")
        js = js.replace(marker, fragment)
    for marker in (CSS_MARKER, JS_MARKER):
        if template.count(marker) != 1:
            raise ValueError(f"Expected exactly one {marker} placeholder")
    return (
        template.replace(CSS_MARKER, "<style>" + css + "</style>")
        .replace(JS_MARKER, "<script>" + js + "</script>")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if index.html is stale")
    args = parser.parse_args()

    html = build()
    outfile = GAME / "index.html"
    if args.check:
        if not outfile.exists() or outfile.read_text(encoding="utf-8") != html:
            print("Robo Salvage HTML is stale; run python scripts/build_robo_salvage.py")
            return 1
        print(f"Verified: generated {outfile.relative_to(ROOT)} is current.")
        return 0
    outfile.write_text(html, encoding="utf-8")
    print(f"Built {outfile.relative_to(ROOT)} ({len(html.encode('utf-8')):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

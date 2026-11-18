#!/usr/bin/env python3
"""Build the single-file PATROL x ROBO SALVAGE hover-combat game.

games/patrol-robo-salvage/src/core.html  : Robo Salvage progression core (hangar,
                                           route, loot, shop, SP) carried over from v0.5
src/b3-world.js, b3-render.js, b3-game.js, b3-ui.js : the v0.6 3D combat module
src/tail.html                            : boot code

Usage:
  python scripts/build_patrol_salvage.py           # public build -> games/patrol-robo-salvage/index.html
  python scripts/build_patrol_salvage.py --check   # verify index.html matches the sources
  python scripts/build_patrol_salvage.py --dev     # tuning build (⚙ panel, saved values) -> dist/ (not published)
"""
import hashlib, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
GAME = ROOT / "games" / "patrol-robo-salvage"
SRC = GAME / "src"
PARTS = ["b3-world.js", "b3-render.js", "b3-game.js", "b3-ui.js"]

def build(dev: bool = False) -> str:
    core = (SRC / "core.html").read_text(encoding="utf-8")
    js = "\n".join((SRC / p).read_text(encoding="utf-8") for p in PARTS)
    tail = (SRC / "tail.html").read_text(encoding="utf-8")
    out = core.rstrip("\n") + "\n" + js.rstrip("\n") + "\n" + tail
    if dev:
        assert "const B3_LAB=false;" in out
        out = out.replace("const B3_LAB=false;", "const B3_LAB=true;", 1)
    title = "PATROL × ROBO SALVAGE — TUNING" if dev else "PATROL × ROBO SALVAGE | ミニゲーム1GO"
    out = re.sub(r"<title>.*?</title>", "<title>" + title + "</title>", out, count=1)
    return out

def main() -> int:
    dev = "--dev" in sys.argv
    out = build(dev)
    target = ROOT / "dist" / "patrol-robo-salvage-tuning.html" if dev else GAME / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    if "--check" in sys.argv:
        same = target.exists() and target.read_text(encoding="utf-8") == out
        print("index.html is up to date" if same else "index.html differs from sources")
        return 0 if same else 1
    target.write_text(out, encoding="utf-8")
    print(f"wrote {target.relative_to(ROOT)}  lines={out.count(chr(10))}  sha256={hashlib.sha256(out.encode()).hexdigest()[:16]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())

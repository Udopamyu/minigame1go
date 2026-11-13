#!/usr/bin/env python3
"""Count first-party Robo Salvage source separately from generated files and tests."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "games/robo-salvage/src"
TEST_FILES = [ROOT / "scripts/verify_robo_salvage.py"]


def count(path: Path) -> dict[str, int]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return {
        "physical": len(lines),
        "nonblank": sum(bool(s.strip()) for s in lines),
    }


def main() -> None:
    files = sorted(
        p for p in SOURCE.rglob("*")
        if p.is_file() and p.suffix.lower() in {".js", ".css", ".html"}
    )
    if not files:
        raise RuntimeError("No Robo Salvage source files found")
    summary = {str(f.relative_to(ROOT)): count(f) for f in files}
    tests = {str(f.relative_to(ROOT)): count(f) for f in TEST_FILES if f.exists()}
    result = {
        "target_source_lines": 10000,
        "source_lines": sum(v["nonblank"] for v in summary.values()),
        "files": summary,
        "test_lines": sum(v["nonblank"] for v in tests.values()),
        "tests": tests,
        "generated_html_excluded": "games/robo-salvage/index.html",
    }
    result["remaining_source_lines"] = max(0, result["target_source_lines"] - result["source_lines"])
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

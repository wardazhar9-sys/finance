#!/usr/bin/env python3
"""Run all FinTrack test suites against a local server. Default: http://localhost:8888"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8888"

SUITES = [
    ["python3", "tests/test-v7-comprehensive.py", BASE],
    ["python3", "tests/test-full-suite.py"],
    ["python3", "tests/test-notifications.py"],
    ["python3", "tests/test-chatbot-ui-suite.py", BASE],
]


def main() -> int:
    print(f"Running all FinTrack suites against {BASE}\n")
    failed = 0
    for cmd in SUITES:
        print("\n" + "#" * 64)
        print(" ".join(cmd))
        print("#" * 64)
        # full-suite hardcodes localhost:8888 — only run if BASE matches or rewrite env
        if "test-full-suite.py" in cmd[1] and "8888" not in BASE and "localhost" not in BASE:
            print("  (skip full-suite — expects localhost:8888)")
            continue
        rc = subprocess.call(cmd, cwd=ROOT)
        if rc != 0:
            failed += 1
            print(f"SUITE FAILED: {cmd[1]} (exit {rc})")
        else:
            print(f"SUITE OK: {cmd[1]}")

    # optional node notifications unit test
    node = subprocess.call(["bash", "-lc", "command -v node"], cwd=ROOT, stdout=subprocess.DEVNULL)
    if node == 0:
        print("\n" + "#" * 64)
        print("node tests/test-notifications.js")
        print("#" * 64)
        rc = subprocess.call(["node", "tests/test-notifications.js"], cwd=ROOT)
        if rc != 0:
            failed += 1
        else:
            print("SUITE OK: test-notifications.js")
    else:
        print("\n(skip node test-notifications.js — node not installed)")

    print(f"\n{'=' * 64}")
    print("ALL SUITES:" , "PASS" if failed == 0 else f"FAIL ({failed} suite(s))")
    print("=" * 64)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

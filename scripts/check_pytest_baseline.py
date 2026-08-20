from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASELINE_FILE = PROJECT_ROOT / "tests" / "pytest_baseline.txt"


def read_baseline() -> int:
    raw = BASELINE_FILE.read_text(encoding="utf-8").strip()
    if not raw.isdigit():
        raise ValueError(f"Invalid baseline in {BASELINE_FILE}: {raw!r}")
    return int(raw)


def collect_test_count() -> int:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "--collect-only", "-q"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    output = f"{result.stdout}\n{result.stderr}"
    match = re.search(r"(\d+) tests collected", output)
    if not match:
        raise RuntimeError(
            "Could not parse pytest collection output:\n"
            f"{output.strip() or '(empty)'}"
        )
    return int(match.group(1))


def main() -> int:
    if not BASELINE_FILE.is_file():
        print(f"ERROR: baseline file not found: {BASELINE_FILE}", file=sys.stderr)
        return 1

    baseline = read_baseline()
    collected = collect_test_count()
    print(f"pytest baseline: {baseline} | collected: {collected}")

    if collected < baseline:
        print(
            f"ERROR: test count regressed ({collected} < {baseline}). "
            "Restore removed tests or lower tests/pytest_baseline.txt intentionally.",
            file=sys.stderr,
        )
        return 1

    if collected > baseline:
        print(
            f"NOTICE: test count increased ({collected} > {baseline}). "
            "Update tests/pytest_baseline.txt after adding tests.",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

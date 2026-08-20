from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = PROJECT_ROOT / "coverage.json"

MIN_TOTAL_LINES = 70.0
MIN_SERVICES_LINES = 80.0

SERVICES_DIR = "src/services/"
SERVICES_OMIT_SUFFIXES = {
    "src/services/interfaces.py",
}


def _line_rate(summary: dict) -> float:
    total = summary.get("num_statements", 0)
    covered = summary.get("covered_lines", 0)
    if total == 0:
        return 100.0
    return covered / total * 100.0


def _services_summary(files: dict) -> tuple[int, int]:
    statements = 0
    covered = 0
    for path, data in files.items():
        normalized = path.replace("\\", "/")
        if not normalized.startswith(SERVICES_DIR):
            continue
        if normalized in SERVICES_OMIT_SUFFIXES:
            continue
        summary = data.get("summary", {})
        statements += summary.get("num_statements", 0)
        covered += summary.get("covered_lines", 0)
    return statements, covered


def main() -> int:
    report_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_REPORT
    if not report_path.is_file():
        print(f"ERROR: coverage report not found: {report_path}", file=sys.stderr)
        return 1

    payload = json.loads(report_path.read_text(encoding="utf-8"))
    totals = payload.get("totals", {})
    total_rate = _line_rate(totals)

    service_statements, service_covered = _services_summary(payload.get("files", {}))
    if service_statements == 0:
        print("ERROR: no src/services files in coverage report", file=sys.stderr)
        return 1
    services_rate = service_covered / service_statements * 100.0

    print(
        f"Coverage total lines: {total_rate:.1f}% "
        f"(required >= {MIN_TOTAL_LINES:.0f}%)"
    )
    print(
        f"Coverage src/services lines: {services_rate:.1f}% "
        f"(required >= {MIN_SERVICES_LINES:.0f}%)"
    )

    failed = False
    if total_rate + 1e-9 < MIN_TOTAL_LINES:
        print(
            f"ERROR: total line coverage {total_rate:.1f}% < {MIN_TOTAL_LINES:.0f}%",
            file=sys.stderr,
        )
        failed = True
    if services_rate + 1e-9 < MIN_SERVICES_LINES:
        print(
            f"ERROR: services line coverage {services_rate:.1f}% < "
            f"{MIN_SERVICES_LINES:.0f}%",
            file=sys.stderr,
        )
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

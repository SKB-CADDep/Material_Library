"""
Переименовывает материалы без суффикса версии
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.services.material_versioning import apply_v1_renames  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Добавить суффикс _v1 к JSON материалов без версии",
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=str(ROOT / "data"),
        help="Каталог материалов (по умолчанию data/)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Выполнить rename.",
    )
    args = parser.parse_args()

    directory = Path(args.directory)
    dry_run = not args.apply
    try:
        planned, errors = apply_v1_renames(directory, dry_run=dry_run)
    except (NotADirectoryError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    prefix = "[dry] " if dry_run else ""
    if not planned and not errors:
        print("Нечего переименовывать")
        return 0

    for source_name, dest_name in planned:
        print(f"{prefix}{source_name} -> {dest_name}")
    for message in errors:
        print(f"ERROR {message}", file=sys.stderr)

    print(
        f"Done. renames={len(planned)}, errors={len(errors)}"
        + (" (dry-run, добавьте --apply)" if dry_run and planned else "")
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

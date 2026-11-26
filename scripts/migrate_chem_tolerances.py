"""
Миграция химсостава: досчёт ABS ↔ REL допусков по п.39.

  (min + ABS min) → REL min
  (max + ABS max) → REL max
  (min + REL min) → ABS min
  (max + REL max) → ABS max

Пример:
  python scripts/migrate_chem_tolerances.py
  python scripts/migrate_chem_tolerances.py data --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.chem_element_tolerances import migrate_material_data  # noqa: E402
from src.core.schema_keys import Schema  # noqa: E402


def migrate_file(path: Path, dry_run: bool = False) -> tuple[bool, int]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return False, 0
    if Schema.METADATA not in data and "material_id" not in data:
        return False, 0

    changed, updated = migrate_material_data(data)
    if not changed:
        return False, 0
    if not dry_run:
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    return True, updated


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Досчитать ABS/REL допуски химсостава в JSON материалов",
    )
    parser.add_argument("paths", nargs="*", default=[str(ROOT / "data")])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files: list[Path] = []
    for raw in args.paths:
        p = Path(raw)
        if p.is_dir():
            files.extend(sorted(p.glob("*.json")))
        elif p.is_file():
            files.append(p)

    changed_files = 0
    skipped = 0
    elements_total = 0
    for path in files:
        if path.name.lower() in {"source.json", "sources.json"}:
            skipped += 1
            continue
        try:
            ok, updated = migrate_file(path, dry_run=args.dry_run)
            if ok:
                prefix = "[dry] " if args.dry_run else ""
                print(f"{prefix}migrated: {path.name} (elements={updated})")
                changed_files += 1
                elements_total += updated
            else:
                skipped += 1
        except Exception as exc:
            print(f"ERROR {path}: {exc}")

    print(
        f"Done. files_changed={changed_files}, "
        f"elements_updated={elements_total}, skipped={skipped}"
    )


if __name__ == "__main__":
    main()

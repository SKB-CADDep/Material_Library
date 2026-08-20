
from __future__ import annotations

import shutil
from pathlib import Path

from tests.fixtures.workspace_paths import WORKSPACE_MIN_DIR


def prepare_smoke_workspace(target: Path) -> Path:
    if not WORKSPACE_MIN_DIR.is_dir():
        raise FileNotFoundError(f"Fixture workspace not found: {WORKSPACE_MIN_DIR}")

    target.mkdir(parents=True, exist_ok=True)
    copied = 0
    for item in sorted(WORKSPACE_MIN_DIR.iterdir()):
        if item.is_file() and item.suffix.lower() == ".json":
            shutil.copy2(item, target / item.name)
            copied += 1

    if copied == 0:
        raise FileNotFoundError(f"No JSON files in fixture workspace: {WORKSPACE_MIN_DIR}")

    return target.resolve()

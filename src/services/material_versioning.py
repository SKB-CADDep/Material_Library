from __future__ import annotations

import re
from pathlib import Path

from src.infrastructure.storage_backend import SOURCE_JSON_NAME

VERSION_SUFFIX_RE = re.compile(r"^(.+)_v(\d+)$", re.IGNORECASE)


def _json_stem(filename: str) -> str:
    name = Path(filename).name
    if name.lower().endswith(".json"):
        return name[:-5]
    return name


def parse_material_filename(filename: str) -> tuple[str, int]:
    stem = _json_stem(filename)
    match = VERSION_SUFFIX_RE.match(stem)
    if not match:
        return (stem, 1)
    return (match.group(1), int(match.group(2)))


def has_version_suffix(filename: str) -> bool:
    return VERSION_SUFFIX_RE.match(_json_stem(filename)) is not None


def with_v1_suffix(filename: str) -> str:
    name = Path(filename).name
    if has_version_suffix(name):
        return name
    return f"{_json_stem(name)}_v1.json"


def plan_v1_renames(filenames: list[str]) -> tuple[list[tuple[str, str]], list[str]]:
    names = [Path(name).name for name in filenames]
    reserved_lower = {name.lower() for name in names}
    planned: list[tuple[str, str]] = []
    errors: list[str] = []

    for name in names:
        if name.lower() == SOURCE_JSON_NAME.lower():
            continue
        if not name.lower().endswith(".json"):
            continue
        if has_version_suffix(name):
            continue

        dest = with_v1_suffix(name)
        if dest.lower() in reserved_lower:
            errors.append(f"{name} -> {dest}: файл уже существует")
            continue

        planned.append((name, dest))
        reserved_lower.add(dest.lower())

    return planned, errors


def apply_v1_renames(directory: Path, *, dry_run: bool = True) -> tuple[list[tuple[str, str]], list[str]]:
    directory = Path(directory)
    if not directory.is_dir():
        raise NotADirectoryError(f"Нет каталога: {directory}")

    names = [path.name for path in directory.glob("*.json")]
    planned, errors = plan_v1_renames(names)
    if dry_run:
        return planned, errors

    for source_name, dest_name in planned:
        source = directory / source_name
        dest = directory / dest_name
        if dest.exists():
            errors.append(f"{source_name} -> {dest_name}: файл уже существует")
            continue
        source.rename(dest)

    return planned, errors


def latest_material_filename(filenames: list[str]) -> list[str]:
    best: dict[str, tuple[int, str]] = {}
    for name in filenames:
        family, version = parse_material_filename(name)
        key = family.lower()
        if key not in best or version > best[key][0]:
            best[key] = (version, name)
    return [pair[1] for pair in best.values()]

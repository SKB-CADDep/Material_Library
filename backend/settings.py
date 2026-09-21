"""Пути к mutable-данным (файловый сервер / workspace)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

MATERIALS_DIR_ENV = "MATERIALS_DIR"
SOURCE_JSON_PATH_ENV = "SOURCE_JSON_PATH"


class DataPathsConfigError(ValueError):
    """Некорректное значение переменной окружения для путей данных."""

    pass


@dataclass(frozen=True)
class DataPathsConfig:
    """Каталог материалов и путь к source.json из env"""

    materials_dir: Path | None
    source_json_path: Path | None
    errors: tuple[str, ...] = ()


def _read_env(name: str) -> str | None:
    raw = os.environ.get(name, "").strip()
    return raw or None


def validate_materials_dir(path: Path) -> Path:
    """MATERIALS_DIR: существует и является каталогом."""
    resolved = path.expanduser().resolve()
    if not resolved.exists():
        raise DataPathsConfigError(
            f"{MATERIALS_DIR_ENV}: каталог не существует: {resolved}"
        )
    if not resolved.is_dir():
        raise DataPathsConfigError(
            f"{MATERIALS_DIR_ENV}: указан не каталог: {resolved}"
        )
    return resolved


def validate_source_json_path(path: Path) -> Path:
    """SOURCE_JSON_PATH: файл или путь, который можно создать в существующем каталоге."""
    raw = path.expanduser()
    try:
        resolved = raw.resolve()
    except OSError:
        resolved = raw

    for candidate in (resolved, raw):
        try:
            if candidate.exists() and candidate.is_file():
                return candidate
        except OSError:
            continue

    parent = resolved.parent
    try:
        parent_ok = parent.exists() and parent.is_dir()
    except OSError:
        parent_ok = False
    if not parent_ok:
        try:
            parent = raw.parent
            parent_ok = parent.exists() and parent.is_dir()
        except OSError:
            parent_ok = False
    if not parent_ok:
        raise DataPathsConfigError(
            f"{SOURCE_JSON_PATH_ENV}: родительский каталог не существует: {raw.parent}"
        )
    return resolved if resolved.suffix else raw


def load_data_paths_from_env() -> DataPathsConfig:
    """
    Читает MATERIALS_DIR и SOURCE_JSON_PATH.
    """
    errors: list[str] = []
    materials_dir: Path | None = None
    source_json_path: Path | None = None

    materials_raw = _read_env(MATERIALS_DIR_ENV)
    if materials_raw is not None:
        try:
            materials_dir = validate_materials_dir(Path(materials_raw))
        except DataPathsConfigError as exc:
            errors.append(str(exc))

    source_raw = _read_env(SOURCE_JSON_PATH_ENV)
    if source_raw is not None:
        try:
            source_json_path = validate_source_json_path(Path(source_raw))
        except DataPathsConfigError as exc:
            errors.append(str(exc))

    config = DataPathsConfig(
        materials_dir=materials_dir,
        source_json_path=source_json_path,
        errors=tuple(errors),
    )

    for message in config.errors:
        logger.error("Конфигурация путей данных: %s", message)

    return config


def _source_json_size(path: Path) -> int:
    try:
        if path.is_file():
            return path.stat().st_size
    except OSError:
        return -1
    return -1


def pick_best_source_json(candidates: list[Path]) -> Path | None:
    """Prefer an existing non-empty source.json (skip ~84-byte empty stubs)."""
    best: Path | None = None
    best_size = -1
    for raw in candidates:
        path = Path(raw)
        size = _source_json_size(path)
        if size > best_size:
            best = path
            best_size = size
    if best is None or best_size < 0:
        return None
    return best.resolve()


def resolve_source_json_path(
    workspace_dir: Path | None = None,
    *,
    data_paths: DataPathsConfig | None = None,
    search_roots: list[Path] | None = None,
) -> Path | None:
    """
    Путь к source.json:
    SOURCE_JSON_PATH >
    непустой {workspace|MATERIALS_DIR}/source.json >
    непустой файл рядом с приложением (search_roots) >
    {workspace}/source.json (даже если ещё нет файла).

    None — legacy (корень приложения), только если нет workspace и env.
    """
    if data_paths and data_paths.source_json_path is not None:
        return data_paths.source_json_path

    primary: list[Path] = []
    if workspace_dir is not None:
        primary.append(Path(workspace_dir) / "source.json")
    if data_paths and data_paths.materials_dir is not None:
        primary.append(Path(data_paths.materials_dir) / "source.json")

    for path in primary:
        if _source_json_size(path) > 100:
            return path.resolve()

    fallback: list[Path] = []
    for root in search_roots or ():
        root = Path(root)
        fallback.append(root / "data" / "source.json")
        fallback.append(root / "source.json")
        fallback.append(root.parent / "data" / "source.json")
        fallback.append(root.parent / "source.json")

    found = pick_best_source_json(fallback)
    if found is not None and _source_json_size(found) > 100:
        return found

    if workspace_dir is not None:
        return Path(workspace_dir).resolve() / "source.json"

    if data_paths and data_paths.materials_dir is not None:
        return Path(data_paths.materials_dir) / "source.json"

    return found

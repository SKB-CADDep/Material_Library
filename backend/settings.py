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
    resolved = path.expanduser().resolve()
    if resolved.exists():
        if not resolved.is_file():
            raise DataPathsConfigError(
                f"{SOURCE_JSON_PATH_ENV}: указан не файл: {resolved}"
            )
        return resolved

    parent = resolved.parent
    if not parent.exists():
        raise DataPathsConfigError(
            f"{SOURCE_JSON_PATH_ENV}: родительский каталог не существует: {parent}"
        )
    if not parent.is_dir():
        raise DataPathsConfigError(
            f"{SOURCE_JSON_PATH_ENV}: родительский путь не каталог: {parent}"
        )
    return resolved


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


def resolve_source_json_path(
    workspace_dir: Path | None = None,
    *,
    data_paths: DataPathsConfig | None = None,
) -> Path | None:
    """
    Путь к source.json: SOURCE_JSON_PATH > {workspace}/source.json > MATERIALS_DIR/source.json.

    None — legacy (корень приложения), только если нет workspace и env.
    """
    if data_paths and data_paths.source_json_path is not None:
        return data_paths.source_json_path

    if workspace_dir is not None:
        return workspace_dir.resolve() / "source.json"

    if data_paths and data_paths.materials_dir is not None:
        return data_paths.materials_dir / "source.json"

    return None

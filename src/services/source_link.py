from __future__ import annotations

import re
from pathlib import Path

from src.infrastructure.paths import get_app_directory

SOURCES_ATTACHMENTS_DIR_NAME = "Источники"
_EXTERNAL_URL_RE = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)


def is_external_url(link: str) -> bool:
    """http(s), normacs:// и прочие URL-схемы (не локальный путь)."""
    return bool(_EXTERNAL_URL_RE.match(link.strip()))


def collect_sources_attachment_directories(
    *,
    source_json_path: Path,
    workspace_dir: Path | None = None,
    materials_dir: Path | None = None,
) -> list[Path]:
    directories: list[Path] = []
    seen: set[Path] = set()

    def add_root(base: Path | None) -> None:
        if base is None:
            return
        candidate = (base.expanduser().resolve() / SOURCES_ATTACHMENTS_DIR_NAME)
        if not candidate.is_dir() or candidate in seen:
            return
        seen.add(candidate)
        directories.append(candidate)

    add_root(get_app_directory())
    add_root(workspace_dir)
    add_root(source_json_path.parent)
    add_root(materials_dir)
    return directories


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def resolve_local_file_path(link: str, attachment_dirs: list[Path]) -> Path:
    raw = link.strip()
    if not raw:
        raise FileNotFoundError("Ссылка не указана")

    path = Path(raw)
    if path.is_absolute():
        resolved = path.expanduser().resolve()
        if resolved.is_file():
            return resolved
        raise FileNotFoundError(f"Файл не найден: {raw}")

    for base in attachment_dirs:
        candidate = (base / raw).resolve()
        if not _is_relative_to(candidate, base):
            continue
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(f"Файл не найден: {raw}")

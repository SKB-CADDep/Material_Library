from __future__ import annotations

from pathlib import Path

from src.core.models.material import Material
from src.infrastructure.storage_backend import LocalDirectoryStorage
from src.services.material_repository import MaterialRepository


def resolve_materials_directories(
    repository: MaterialRepository | None,
    source_json_path: Path,
) -> list[Path]:
    directories: list[Path] = []
    seen: set[Path] = set()

    def add_directory(path: Path | None) -> None:
        if path is None:
            return
        resolved = path.expanduser().resolve()
        if not resolved.is_dir() or resolved in seen:
            return
        storage = LocalDirectoryStorage(resolved)
        if not storage.list_material_paths():
            return
        seen.add(resolved)
        directories.append(resolved)

    if repository is not None and repository.work_dir:
        add_directory(Path(repository.work_dir))

    add_directory(source_json_path.parent)
    return directories


def find_material_display_names_using_source(
    directories: list[Path],
    source_id: str,
) -> list[str]:
    if not source_id:
        return []

    found: list[str] = []
    seen_names: set[str] = set()

    for directory in directories:
        storage = LocalDirectoryStorage(directory)
        for material_path in storage.list_material_paths():
            try:
                material = Material(filepath=str(material_path))
            except Exception:
                continue
            if not material.uses_source_ref(source_id):
                continue
            display_name = material.get_display_name()
            if display_name in seen_names:
                continue
            seen_names.add(display_name)
            found.append(display_name)

    found.sort(key=str.casefold)
    return found


def format_source_in_use_detail(used_in: list[str], *, example_limit: int = 3) -> str:
    detail = f"Источник используется в {len(used_in)} материалах"
    examples = ", ".join(used_in[:example_limit])
    if examples:
        detail += f", например: {examples}"
        if len(used_in) > example_limit:
            detail += " ..."
    return detail

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.models.material import Material  # noqa: E402
from src.infrastructure.atomic_io import atomic_write_json  # noqa: E402


DEFAULT_DATABASE_DIR = ROOT / "АКТУАЛЬНАЯ БД ОТ ОР" / "БД Материалов"
DEFAULT_DATA_DIR = ROOT / "data"
# Ограничение количества обновляемых файлов.
# None — обработать все соответствующие файлы.
value: int | None = None
SOURCE_JSON_NAME = "source.json"
LEGACY_KEYS = (
    "physical_properties",
    "mechanical_properties",
    "chemical_properties",
)


def _material_family(stem: str) -> str:
    """Вернуть имя материала без версии и случайного завершающего ``_``."""
    if stem.lower().endswith("_v1"):
        stem = stem[:-3]
    return stem.rstrip("_").casefold()


def _material_files(directory: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in directory.glob("*.json")
            if path.name.casefold() != SOURCE_JSON_NAME
        ),
        key=lambda path: path.name.casefold(),
    )


def _read_json(path: Path):
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def _to_data_format(database_payload: dict, data_payload: dict) -> dict:
    """Преобразовать один материал БД в схему файлов ``data``.

    ``property_groups`` берутся из существующего файла data как шаблон. В них
    проектируются актуальные значения из старой схемы БД. Это не создаёт новую
    структуру и не меняет формат файлов data.
    """
    material = Material(data=copy.deepcopy(database_payload))
    material.data["property_groups"] = copy.deepcopy(data_payload["property_groups"])
    material._project_physical_into_property_groups()
    material._project_chemical_into_property_groups()
    material._project_mechanical_into_property_groups()

    for key in LEGACY_KEYS:
        material.data.pop(key, None)
    return material.data


def update_database(
    database_dir: Path = DEFAULT_DATABASE_DIR,
    data_dir: Path = DEFAULT_DATA_DIR,
    *,
    value: int | None = None,
) -> None:
    database_paths = _material_files(Path(database_dir))
    data_paths = _material_files(Path(data_dir))
    data_by_family = {
        _material_family(path.stem): path
        for path in data_paths
    }

    if value is not None:
        database_paths = database_paths[:value]

    for database_path in database_paths:
        target_path = data_by_family[_material_family(database_path.stem)]
        converted = _to_data_format(
            _read_json(database_path),
            _read_json(target_path),
        )
        atomic_write_json(target_path, converted)


def main() -> int:
    update_database(value=value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.core.models.material import Material
from src.core.schema_keys import Schema
from src.services.material_repository import MaterialRepository
from src.services.material_versioning import (
    apply_v1_renames,
    has_version_suffix,
    latest_material_filename,
    parse_material_filename,
    plan_v1_renames,
    with_v1_suffix,
)


def _minimal_material_json(material_id: str, name: str = "Сталь") -> dict:
    return {
        "material_id": material_id,
        Schema.METADATA: {
            Schema.NAME_STD: name,
            Schema.NAME_ALT: [],
            Schema.APP_AREA: [],
        },
        Schema.PHYSICAL: {},
        Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
        Schema.CHEMICAL: {Schema.COMPOSITION: []},
    }


def _write_material(directory: Path, filename: str, material_id: str) -> None:
    path = directory / filename
    path.write_text(
        json.dumps(_minimal_material_json(material_id), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

@pytest.mark.parametrize(
    "filename, family, version",
    [
        ("сталь_v2.json", "сталь", 2),
        ("сталь.json", "сталь", 1),
        ("нержавеющая-сталь_v10.json", "нержавеющая-сталь", 10),
    ],
)
def test_parse_material_filename(filename, family, version):
    assert parse_material_filename(filename) == (family, version)

@pytest.mark.parametrize(
    "filenames, expected",
    [
        (["сталь.json"], ["сталь.json"]),
        (["сталь.json", "сталь_v2.json", "сталь_v10.json"], ["сталь_v10.json"]),
        (["сталь.json", "сталь_v2.json", "сталь_v10.json", "аллюминий.json"], ["сталь_v10.json", "аллюминий.json"]),
    ],
)
def test_latest_material_filename(filenames, expected):
    assert set(latest_material_filename(filenames)) == set(expected)


def test_repository_load_keeps_latest_version_only(tmp_path: Path) -> None:
    _write_material(tmp_path, "сталь.json", "id-v1")
    _write_material(tmp_path, "сталь_v2.json", "id-v2")

    repo = MaterialRepository()
    repo.load_materials_from_dir(tmp_path)

    summary = repo.list_summary()
    assert len(summary) == 1
    assert summary[0]["filename"] == "сталь_v2.json"
    assert summary[0]["id"] == "id-v2"
    assert (tmp_path / "сталь.json").is_file()


def test_repository_save_reloads_and_keeps_latest_version(tmp_path: Path) -> None:
    _write_material(tmp_path, "сталь.json", "id-v1")

    repo = MaterialRepository()
    repo.load_materials_from_dir(tmp_path)
    assert len(repo.list_summary()) == 1

    material = Material(data=_minimal_material_json("id-v2"))
    material.filepath = str(tmp_path / "сталь_v2.json")
    repo.save_material(material)

    summary = repo.list_summary()
    assert len(summary) == 1
    assert summary[0]["filename"] == "сталь_v2.json"
    assert summary[0]["id"] == "id-v2"
    assert (tmp_path / "сталь.json").is_file()
    assert (tmp_path / "сталь_v2.json").is_file()


@pytest.mark.parametrize(
    "filename, expected",
    [
        ("сталь.json", False),
        ("сталь_v1.json", True),
        ("сталь_v10.json", True),
        ("source.json", False),
    ],
)
def test_has_version_suffix(filename: str, expected: bool) -> None:
    assert has_version_suffix(filename) is expected


def test_with_v1_suffix_skips_already_versioned() -> None:
    assert with_v1_suffix("сталь.json") == "сталь_v1.json"
    assert with_v1_suffix("сталь_v2.json") == "сталь_v2.json"


def test_plan_v1_renames_skips_source_and_versioned() -> None:
    planned, errors = plan_v1_renames(
        ["source.json", "сталь.json", "сталь_v2.json", "алюминий.json"],
    )
    assert ("сталь.json", "сталь_v1.json") in planned
    assert ("алюминий.json", "алюминий_v1.json") in planned
    assert all(source != "source.json" for source, _ in planned)
    assert all(source != "сталь_v2.json" for source, _ in planned)
    assert errors == []


def test_plan_v1_renames_reports_collision() -> None:
    planned, errors = plan_v1_renames(["сталь.json", "сталь_v1.json"])
    assert planned == []
    assert errors
    assert "сталь.json" in errors[0]


def test_apply_v1_renames_dry_run_does_not_touch_files(tmp_path: Path) -> None:
    _write_material(tmp_path, "сталь.json", "id-v1")
    planned, errors = apply_v1_renames(tmp_path, dry_run=True)
    assert planned == [("сталь.json", "сталь_v1.json")]
    assert errors == []
    assert (tmp_path / "сталь.json").is_file()
    assert not (tmp_path / "сталь_v1.json").is_file()


def test_apply_v1_renames_renames_and_keeps_existing_version(tmp_path: Path) -> None:
    _write_material(tmp_path, "сталь.json", "id-v1")
    _write_material(tmp_path, "сталь_v2.json", "id-v2")
    planned, errors = apply_v1_renames(tmp_path, dry_run=False)
    assert planned == [("сталь.json", "сталь_v1.json")]
    assert errors == []
    assert not (tmp_path / "сталь.json").is_file()
    assert (tmp_path / "сталь_v1.json").is_file()
    assert (tmp_path / "сталь_v2.json").is_file()
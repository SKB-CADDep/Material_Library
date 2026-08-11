import pytest
from pathlib import Path

from backend.settings import (
    MATERIALS_DIR_ENV,
    SOURCE_JSON_PATH_ENV,
    load_data_paths_from_env,
    validate_materials_dir,
    validate_source_json_path,
)


def test_load_data_paths_empty_env(monkeypatch):
    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)
    monkeypatch.delenv(SOURCE_JSON_PATH_ENV, raising=False)

    config = load_data_paths_from_env()

    assert config.materials_dir is None
    assert config.source_json_path is None
    assert config.errors == ()


def test_validate_materials_dir_ok(tmp_path):
    assert validate_materials_dir(tmp_path) == tmp_path.resolve()


def test_validate_materials_dir_missing(tmp_path):
    missing = tmp_path / "missing"
    with pytest.raises(ValueError, match="не существует"):
        validate_materials_dir(missing)


def test_validate_materials_dir_not_dir(tmp_path):
    file_path = tmp_path / "file.json"
    file_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="не каталог"):
        validate_materials_dir(file_path)


def test_load_materials_dir_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(tmp_path))
    monkeypatch.delenv(SOURCE_JSON_PATH_ENV, raising=False)

    config = load_data_paths_from_env()

    assert config.materials_dir == tmp_path.resolve()
    assert config.errors == ()


def test_load_invalid_materials_dir_records_error(monkeypatch, tmp_path):
    bad = tmp_path / "nope"
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(bad))
    monkeypatch.delenv(SOURCE_JSON_PATH_ENV, raising=False)

    config = load_data_paths_from_env()

    assert config.materials_dir is None
    assert len(config.errors) == 1
    assert MATERIALS_DIR_ENV in config.errors[0]


def test_validate_source_json_existing_file(tmp_path):
    source_file = tmp_path / "source.json"
    source_file.write_text("{}", encoding="utf-8")
    assert validate_source_json_path(source_file) == source_file.resolve()


def test_validate_source_json_new_file_in_existing_dir(tmp_path):
    target = tmp_path / "source.json"
    assert validate_source_json_path(target) == target.resolve()


def test_load_source_json_path_from_env(monkeypatch, tmp_path):
    source_file = tmp_path / "source.json"
    source_file.write_text("{}", encoding="utf-8")
    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)
    monkeypatch.setenv(SOURCE_JSON_PATH_ENV, str(source_file))

    config = load_data_paths_from_env()

    assert config.source_json_path == source_file.resolve()
    assert config.errors == ()

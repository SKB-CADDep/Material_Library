from pathlib import Path

import pytest

from backend.settings import DataPathsConfig, resolve_source_json_path
from src.services.source_service import SourceService


def test_resolve_source_json_env_override(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    override = tmp_path / "custom" / "source.json"
    override.parent.mkdir()
    override.write_text("{}", encoding="utf-8")

    data_paths = DataPathsConfig(
        materials_dir=None,
        source_json_path=override.resolve(),
    )

    assert resolve_source_json_path(workspace, data_paths=data_paths) == override.resolve()


def test_resolve_source_json_workspace(tmp_path):
    workspace = tmp_path / "materials"
    workspace.mkdir()

    path = resolve_source_json_path(workspace, data_paths=DataPathsConfig(None, None))

    assert path == workspace.resolve() / "source.json"


def test_resolve_source_json_materials_dir_env(tmp_path):
    materials = tmp_path / "mount"
    materials.mkdir()

    data_paths = DataPathsConfig(materials_dir=materials.resolve(), source_json_path=None)

    path = resolve_source_json_path(None, data_paths=data_paths)

    assert path == materials.resolve() / "source.json"


def test_source_service_set_filepath(tmp_path):
    first = tmp_path / "a" / "source.json"
    second = tmp_path / "b" / "source.json"
    first.parent.mkdir(parents=True)
    second.parent.mkdir(parents=True)
    first.write_text(
        '{"property_sources":[{"id_source":"1","name_source":"A"}],"strength_sources":[],"chemical_sources":[]}',
        encoding="utf-8",
    )
    second.write_text(
        '{"property_sources":[],"strength_sources":[],"chemical_sources":[]}',
        encoding="utf-8",
    )

    service = SourceService(first)
    assert len(service.get_all("property_sources")) == 1

    service.set_filepath(second)
    assert service.filepath_path == second.resolve()
    assert service.get_all("property_sources") == []


def test_source_service_save_creates_parent_dir(tmp_path):
    target = tmp_path / "nested" / "source.json"
    service = SourceService(target)
    service.add_source("Тест FS2", group="property_sources")

    assert target.is_file()
    data = target.read_text(encoding="utf-8")
    assert "Тест FS2" in data


def test_open_workspace_binds_source_json_to_workspace(tmp_path):
    from backend.dependencies import AppState, open_workspace
    from backend.settings import DataPathsConfig
    from src.services.source_service import SourceService

    workspace = tmp_path / "materials"
    workspace.mkdir()

    state = AppState(
        sources=SourceService(),
        data_paths=DataPathsConfig(materials_dir=None, source_json_path=None),
    )
    open_workspace(state, workspace)

    assert state.sources.filepath_path == (workspace / "source.json").resolve()
    state.sources.add_source("Из workspace", group="property_sources")
    assert (workspace / "source.json").is_file()

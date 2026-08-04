from dataclasses import dataclass
from functools import lru_cache
import logging

from fastapi import Depends, HTTPException
from pathlib import Path

from backend.settings import (
    DataPathsConfig,
    load_data_paths_from_env,
    resolve_source_json_path,
)
from src.infrastructure.storage_backend import LocalDirectoryStorage
from src.services.material_repository import MaterialRepository
from src.services.properties_catalog import PropertiesCatalog
from src.services.hardness_table import HardnessTable
from src.services.source_service import SourceService

logger = logging.getLogger(__name__)

@dataclass
class AppState:
    properties: PropertiesCatalog | None = None
    hardness: HardnessTable | None = None
    sources: SourceService | None = None

    storage: LocalDirectoryStorage | None = None
    repository: MaterialRepository | None = None
    data_paths: DataPathsConfig | None = None

def configure_source_storage(
    state: AppState,
    workspace_dir: Path | None = None,
) -> None:
    if state.sources is None:
        return

    source_path = resolve_source_json_path(
        workspace_dir,
        data_paths=state.data_paths,
    )
    if source_path is not None:
        state.sources.set_filepath(source_path)
        logger.info("source.json → %s", source_path)

@lru_cache
def get_app_state() -> AppState:
    """Один экземпляр AppState на процесс uvicorn."""
    data_paths = load_data_paths_from_env()
    if data_paths.materials_dir is not None:
        logger.info(
            "MATERIALS_DIR=%s",
            data_paths.materials_dir,
        )
    if data_paths.source_json_path is not None:
        logger.info(
            "SOURCE_JSON_PATH=%s",
            data_paths.source_json_path,
        )

    sources = SourceService()
    state = AppState(
        properties=PropertiesCatalog(),
        hardness=HardnessTable(),
        sources=sources,
        data_paths=data_paths,
    )
    configure_source_storage(
        state,
        workspace_dir=data_paths.materials_dir,
    )
    return state

def get_state() -> AppState:
    return get_app_state()

def get_repository(state: AppState = Depends(get_state)) -> MaterialRepository:
    if state.repository is None:
        raise HTTPException(status_code = 409, detail="Workspace не открыт")
    return state.repository

def open_workspace(state: AppState, directory: Path) -> MaterialRepository:
    directory = directory.expanduser().resolve()
    configure_source_storage(state, workspace_dir=directory)
    state.storage = LocalDirectoryStorage(directory)
    state.repository = MaterialRepository(source_service=state.sources, storage=state.storage)
    state.repository.load_materials_from_dir(directory)
    return state.repository


def try_auto_open_workspace(state: AppState) -> bool:
    """
    Возвращает True, если workspace открыт.
    """
    if state.repository is not None:
        return True

    data_paths = state.data_paths
    if data_paths is None or data_paths.materials_dir is None:
        return False

    directory = data_paths.materials_dir
    try:
        repo = open_workspace(state, directory)
        logger.info(
            "Workspace auto-open из MATERIALS_DIR: %s (%s материалов)",
            directory,
            len(repo.materials),
        )
        return True
    except Exception as exc:
        logger.error(
            "MATERIALS_DIR=%s: не удалось открыть workspace при старте: %s",
            directory,
            exc,
            exc_info=True,
        )
        state.repository = None
        state.storage = None
        return False
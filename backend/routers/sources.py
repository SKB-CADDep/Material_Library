from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
import mimetypes
from pathlib import Path

from backend.dependencies import AppState, get_state, try_auto_open_workspace
from backend.schemas import (
    OkResponse,
    SourceCreateRequest,
    SourceItem,
    SourcesResponse,
    SourceUpdateRequest,
    SourceUsageResponse,
)
from src.services.source_link import (
    collect_sources_attachment_directories,
    is_external_url,
    resolve_local_file_path,
)
from src.services.source_usage import (
    find_material_display_names_using_source,
    format_source_in_use_detail,
    resolve_materials_directories,
)

router = APIRouter(tags=["Sources"])

_USAGE_EXAMPLE_LIMIT = 3


def _source_items(raw_items: list[dict]) -> list[SourceItem]:
    return [SourceItem.from_dict(item) for item in raw_items]


def _require_source(state: AppState, source_id: str) -> None:
    if state.sources.get_source_by_id(source_id) is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")


def _find_materials_using_source(state: AppState, source_id: str) -> list[str]:
    try_auto_open_workspace(state)
    materials_dirs = resolve_materials_directories(
        state.repository,
        state.sources.filepath_path,
    )
    if not materials_dirs:
        raise HTTPException(
            status_code=409,
            detail=(
                "Рабочая папка не открыта. "
                "Невозможно проверить, используется ли источник в материалах."
            ),
        )
    return find_material_display_names_using_source(materials_dirs, source_id)


@router.get("/sources", response_model=SourcesResponse)
def get_sources(state: AppState = Depends(get_state)):
    groups = state.sources.sources
    return SourcesResponse(
        property_sources=_source_items(groups["property_sources"]),
        strength_sources=_source_items(groups["strength_sources"]),
        chemical_sources=_source_items(groups["chemical_sources"]),
    )


@router.get("/sources/{source_id}", response_model=SourceItem)
def get_source_by_id(source_id: str, state: AppState = Depends(get_state)):
    res = state.sources.get_source_by_id(source_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    return SourceItem.from_dict(res)


@router.get("/sources/{source_id}/usage", response_model=SourceUsageResponse)
def get_source_usage(source_id: str, state: AppState = Depends(get_state)):
    _require_source(state, source_id)
    used_in = _find_materials_using_source(state, source_id)
    return SourceUsageResponse(
        count=len(used_in),
        examples=used_in[:_USAGE_EXAMPLE_LIMIT],
    )


@router.get("/sources/{source_id}/open-link")
def open_source_link(source_id: str, state: AppState = Depends(get_state)):
    src = state.sources.get_source_by_id(source_id)
    if src is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")

    link = str(src.get("hyperlink") or "").strip()
    if not link:
        raise HTTPException(status_code=404, detail="Ссылка не указана")

    if is_external_url(link):
        return RedirectResponse(url=link, status_code=307)

    try_auto_open_workspace(state)
    workspace_dir = (
        Path(state.repository.work_dir)
        if state.repository and state.repository.work_dir
        else None
    )
    materials_dir = (
        state.data_paths.materials_dir
        if state.data_paths and state.data_paths.materials_dir
        else None
    )
    attachment_dirs = collect_sources_attachment_directories(
        source_json_path=state.sources.filepath_path,
        workspace_dir=workspace_dir,
        materials_dir=materials_dir,
    )

    try:
        file_path = resolve_local_file_path(link, attachment_dirs)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    media_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type or "application/octet-stream",
    )


@router.post("/sources", status_code=201, response_model=SourceItem)
def post_source(body: SourceCreateRequest, state: AppState = Depends(get_state)):
    id_source = state.sources.add_source(
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
        group=body.group,
    )
    created = state.sources.get_source_by_id(id_source)
    if created is None:
        raise HTTPException(status_code=500, detail="Источник создан, но не найден")
    return SourceItem.from_dict(created)


@router.put("/sources/{source_id}", response_model=SourceItem)
def put_source(source_id: str, body: SourceUpdateRequest, state: AppState = Depends(get_state)):
    updated = state.sources.update_source(
        source_id=source_id,
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Не удалось обновить источник")
    res = state.sources.get_source_by_id(source_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    return SourceItem.from_dict(res)


@router.delete("/sources/{source_id}", response_model=OkResponse)
def delete_by_id(source_id: str, state: AppState = Depends(get_state)):
    _require_source(state, source_id)

    used_in = _find_materials_using_source(state, source_id)
    if used_in:
        raise HTTPException(
            status_code=409,
            detail=format_source_in_use_detail(used_in),
        )

    state.sources.delete_source(source_id)
    return OkResponse(ok=True)

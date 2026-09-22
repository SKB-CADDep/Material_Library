from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
import mimetypes
import time
from pathlib import Path

from backend.audit_service import audit_log, monotonic_ms_since, new_operation_id
from backend.dependencies import AppState, get_state, try_auto_open_workspace
from backend.schemas import (
    OkResponse,
    SourceCreateRequest,
    SourceItem,
    SourcesResponse,
    SourceUpdateRequest,
    SourceUsageResponse,
)
from src.services.audit_events import AUDIT_EVENT_NAMES, source_group_label
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


def _source_entity(src: dict | None, *, fallback_id: str = "", name: str = "") -> dict:
    if src:
        return {
            "type": "Источник",
            "name": src.get("name_source") or src.get("name") or name,
            "id": src.get("id_source") or fallback_id,
        }
    return {"type": "Источник", "name": name, "id": fallback_id}


def _group_of_source(state: AppState, source_id: str) -> str:
    for group_key, items in state.sources.sources.items():
        for item in items:
            if item.get("id_source") == source_id:
                return group_key
    return ""


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

    group = _group_of_source(state, source_id)
    op_id = new_operation_id()
    t0 = time.monotonic()
    entity = _source_entity(src, fallback_id=source_id)
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        entity=entity,
        data={"группа": group, "группа_название": source_group_label(group)},
    )

    link = str(src.get("hyperlink") or "").strip()
    if not link:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="missing_link",
            duration_ms=monotonic_ms_since(t0),
            entity=entity,
            data={"группа": group},
        )
        raise HTTPException(status_code=404, detail="Ссылка не указана")

    try:
        if is_external_url(link):
            audit_log(
                event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
                event_category="База",
                event_action="Открыто",
                entity=entity,
                data={"группа": group},
            )
            audit_log(
                event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
                event_category="Операция",
                event_action="Финиш",
                operation_id=op_id,
                result_ok=True,
                result_status="Успех",
                duration_ms=monotonic_ms_since(t0),
                entity=entity,
                data={"группа": group},
            )
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

        file_path = resolve_local_file_path(link, attachment_dirs)
        media_type, _ = mimetypes.guess_type(file_path.name)
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
            event_category="База",
            event_action="Открыто",
            entity=entity,
            data={"группа": group},
        )
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=True,
            result_status="Успех",
            duration_ms=monotonic_ms_since(t0),
            entity=entity,
            data={"группа": group},
        )
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type=media_type or "application/octet-stream",
        )
    except FileNotFoundError as exc:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="io_error",
            duration_ms=monotonic_ms_since(t0),
            entity=entity,
            data={"группа": group},
        )
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_OPEN_LINK"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="io_error",
            duration_ms=monotonic_ms_since(t0),
            entity=entity,
            data={"группа": group},
        )
        raise


@router.post("/sources", status_code=201, response_model=SourceItem)
def post_source(body: SourceCreateRequest, state: AppState = Depends(get_state)):
    op_id = new_operation_id()
    t0 = time.monotonic()
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_CREATE"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
    )
    id_source = state.sources.add_source(
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
        group=body.group,
    )
    created = state.sources.get_source_by_id(id_source)
    if created is None:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_CREATE"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="not_found",
            duration_ms=monotonic_ms_since(t0),
            entity={"type": "Источник", "name": body.name, "id": id_source},
            data={"группа": body.group},
        )
        raise HTTPException(status_code=500, detail="Источник создан, но не найден")
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_CREATE"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        entity=_source_entity(created, fallback_id=id_source, name=body.name),
        changes_fields=["name_source", "description", "hyperlink"],
        data={
            "группа": body.group,
            "группа_название": source_group_label(body.group),
        },
    )
    return SourceItem.from_dict(created)


@router.put("/sources/{source_id}", response_model=SourceItem)
def put_source(source_id: str, body: SourceUpdateRequest, state: AppState = Depends(get_state)):
    group = _group_of_source(state, source_id)
    before = state.sources.get_source_by_id(source_id)
    op_id = new_operation_id()
    t0 = time.monotonic()
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_UPDATE"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        entity={"type": "Источник", "id": source_id},
    )

    updated = state.sources.update_source(
        source_id=source_id,
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
    )
    if not updated:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_UPDATE"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="not_found",
            duration_ms=monotonic_ms_since(t0),
            entity={"type": "Источник", "name": body.name, "id": source_id},
            data={"группа": group},
        )
        raise HTTPException(status_code=404, detail="Не удалось обновить источник")
    res = state.sources.get_source_by_id(source_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")

    changes_fields: list[str] = []
    if before:
        if before.get("name_source") != body.name:
            changes_fields.append("name_source")
        if before.get("description") != body.description:
            changes_fields.append("description")
        if before.get("hyperlink") != body.hyperlink:
            changes_fields.append("hyperlink")

    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_UPDATE"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        entity=_source_entity(res, fallback_id=source_id, name=body.name),
        changes_fields=changes_fields or None,
        counters={"изменений": len(changes_fields)} if changes_fields else None,
        data={"группа": group, "группа_название": source_group_label(group)},
    )
    return SourceItem.from_dict(res)


@router.delete("/sources/{source_id}", response_model=OkResponse)
def delete_by_id(source_id: str, state: AppState = Depends(get_state)):
    _require_source(state, source_id)
    src = state.sources.get_source_by_id(source_id)
    group = _group_of_source(state, source_id)
    op_id = new_operation_id()
    t0 = time.monotonic()
    entity = _source_entity(src, fallback_id=source_id)
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_DELETE"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        entity={"type": "Источник", "id": source_id},
    )

    used_in = _find_materials_using_source(state, source_id)
    if used_in:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["SOURCE_DELETE"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="in_use",
            duration_ms=monotonic_ms_since(t0),
            counters={"материалов": len(used_in)},
            entity=entity,
            data={"группа": group},
        )
        raise HTTPException(
            status_code=409,
            detail=format_source_in_use_detail(used_in),
        )

    state.sources.delete_source(source_id)
    audit_log(
        event_name=AUDIT_EVENT_NAMES["SOURCE_DELETE"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        entity=entity,
        data={"группа": group, "группа_название": source_group_label(group)},
    )
    return OkResponse(ok=True)

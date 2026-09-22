from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import AppState, get_state, get_repository, open_workspace, try_auto_open_workspace
from backend.schemas import WorkspaceResponse, WorkspaceOpenRequest, MaterialSummary, MaterialSaveResponse
from pathlib import Path
import copy
import time

from src.core.models.material import Material
from backend.audit_service import (
    audit_log,
    audit_log_material_save_by_tabs,
    monotonic_ms_since,
    new_operation_id,
)
from src.services.audit_events import AUDIT_EVENT_NAMES
from src.services.material_changelog import (
    changes_fields_from_diff,
    find_changes,
    log_changes,
)

router = APIRouter(tags=["Materials"])

@router.post("/workspace/open", response_model=WorkspaceResponse)
def workspace_open(body: WorkspaceOpenRequest, state: AppState=Depends(get_state)):
    path = Path(body.directory)
    op_id = new_operation_id()
    t0 = time.monotonic()
    audit_log(
        event_name=AUDIT_EVENT_NAMES["IMPORT_OPEN_DIR"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        data={"операция": "open_directory"},
    )
    if not path.exists():
        audit_log(
            event_name=AUDIT_EVENT_NAMES["IMPORT_OPEN_DIR_ERROR"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="path_missing",
            duration_ms=monotonic_ms_since(t0),
            data={"операция": "open_directory"},
        )
        raise HTTPException(status_code= 400, detail = "Путь не существует")
    if not path.is_dir():
        audit_log(
            event_name=AUDIT_EVENT_NAMES["IMPORT_OPEN_DIR_ERROR"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="not_directory",
            duration_ms=monotonic_ms_since(t0),
            data={"операция": "open_directory"},
        )
        raise HTTPException(status_code= 400, detail = "Указан не каталог")
    try:
        repo = open_workspace(state, path)
    except Exception as e:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["IMPORT_OPEN_DIR_ERROR"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="io_error",
            duration_ms=monotonic_ms_since(t0),
            data={"операция": "open_directory"},
        )
        raise HTTPException(status_code= 500, detail=str(e))

    audit_log(
        event_name=AUDIT_EVENT_NAMES["IMPORT_OPEN_DIR"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        counters={"материалов": len(repo.materials)},
        data={"операция": "open_directory"},
    )
    return WorkspaceResponse(count = len(repo.materials), directory=str(path), application_areas= repo.application_areas)

@router.get("/workspace", response_model=WorkspaceResponse)
def real_workspace(state: AppState=Depends(get_state)):
    if state.repository is None or not state.repository.work_dir:
        try_auto_open_workspace(state)
    if state.repository is None or not state.repository.work_dir:
        raise HTTPException(status_code=404, detail="Workspace не открыт")
    return WorkspaceResponse(
        count=len(state.repository.materials),
        directory=str(state.repository.work_dir),
        application_areas=state.repository.application_areas,
    )
    
@router.get("/materials")
def get_material(repo= Depends(get_repository)):
    return repo.list_summary()

@router.get("/materials/{material_id}")
def get_material_by_id(material_id:str, repo= Depends(get_repository)):
    material = repo.get_by_id(material_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Материал не найден")
    Material.normalize_metadata(material.data)
    return material.data

@router.put("/materials/{material_id}", response_model=MaterialSaveResponse)
def put_material_by_id(material_id:str, body:dict, repo= Depends(get_repository)):
    if body.get("material_id") != material_id:
        raise HTTPException(status_code=400, detail="id в URL и теле не совпадают")
    if not body.get("metadata"):
        raise HTTPException(status_code=400, detail="Данные материала отсутствуют")
    material = repo.get_by_id(material_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Материал не найден")

    op_id = new_operation_id()
    t0 = time.monotonic()
    audit_log(
        event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        data={"операция": "save"},
    )

    Material.normalize_metadata(body)
    old_data = copy.deepcopy(material.data)
    changes = find_changes(old_data, body)
    display_name = (
        (body.get("metadata") or {}).get("name_material_standard")
        or material.get_display_name()
    )
    try:
        log_changes(display_name, changes)
    except Exception:
        pass

    material.data = body
    try:
        repo.save_material(material)
    except Exception:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="io_error",
            duration_ms=monotonic_ms_since(t0),
            entity={"type": "Материал", "name": display_name},
            data={"операция": "save"},
        )
        raise

    changed_fields = changes_fields_from_diff(changes)
    tab_groups = audit_log_material_save_by_tabs(
        op_id,
        display_name,
        changes,
        data_extra={"операция": "save"},
    ) or {}
    audit_log(
        event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        entity={"type": "Материал", "name": display_name},
        counters={"изменений": len(changed_fields)} if changed_fields else None,
        data={
            "операция": "save",
            "вкладки_с_изменениями": list(tab_groups.keys()),
        },
    )
    return MaterialSaveResponse(ok=True, filename=material.filename)

@router.post("/materials", response_model=MaterialSaveResponse)
def post_new_material(body:dict, filename:str, repo= Depends(get_repository)):
    path = Path(repo.work_dir) / filename
    if path.exists():
        raise HTTPException(status_code=409, detail=f"Файл '{filename}' уже существует")

    op_id = new_operation_id()
    t0 = time.monotonic()
    Material.normalize_metadata(body)
    display_name = (body.get("metadata") or {}).get("name_material_standard") or filename
    audit_log(
        event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE_AS"],
        event_category="Операция",
        event_action="Старт",
        operation_id=op_id,
        data={"операция": "save_as"},
    )
    audit_log(
        event_name=AUDIT_EVENT_NAMES["MATERIAL_CREATE_DRAFT"],
        event_category="Данные",
        event_action="Создано",
        entity={"type": "Материал", "name": display_name},
    )

    material = Material(data=body)
    material.filepath = str(path)
    try:
        repo.save_material(material)
    except Exception:
        audit_log(
            event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE_AS"],
            event_category="Операция",
            event_action="Финиш",
            operation_id=op_id,
            result_ok=False,
            result_status="Ошибка",
            result_error_kind="io_error",
            duration_ms=monotonic_ms_since(t0),
            entity={"type": "Материал", "name": display_name},
            data={"операция": "save_as"},
        )
        raise

    audit_log(
        event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE_AS"],
        event_category="Операция",
        event_action="Финиш",
        operation_id=op_id,
        result_ok=True,
        result_status="Успех",
        duration_ms=monotonic_ms_since(t0),
        entity={"type": "Материал", "name": display_name},
        data={"операция": "save_as"},
    )
    return MaterialSaveResponse(ok=True, filename=material.filename)

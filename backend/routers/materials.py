from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import AppState, get_state, get_repository
from backend.schemas import

router = APIRouter(tags=["Materials"])

@router.get("/workspace/open", response_model=WorkspaceResponse)
def workspace_open(body: WorkspaceOpenRequest, state: AppState=Depends(get_state)):
    path = Path(body.directory)
    if not path.exists():
        raise HTTPException(status_code= 400, detail = "Путь не существует")
    if not path.is_dir():
        raise HTTPException(status_code= 400, detail = "Указан не каталог")
    try:
        repo = open_workspace(state, path)
    except:
        raise HTTPException(status_code= 500, detail="Битый JSON")

    return WorkspaceResponse(count = len(repo.materials), directory=str(path), application_areas= repo.application_areas)

@router.get("workspace", response_model=WorkSpaceResponse)
def real_workspace(state: AppState=Depends(get_state)):
    if state.repository is None or not state.repository.work_dir:
        raise HTTPException(status_code=404, detail="Workspace не открыт")
    else:
        return WorkspaceResponse(count = len(repo.materials), directory=str(state.repository.work_dir), application_areas= state.repository.application_areas)
    
@router.get("", response_model=MaterialSummary)
def get_material(repo: AppState=Depends(get_repository)):
    return MaterialSummary(repo.list_sammury)

@router.get(f"{material_id}")
def get_material_by_id(repo: AppState=Depends(get_repository)):
    material = repo.get_by_id(material_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Материал не найден")
    else:
        return material


from fastapi import APIRouter, Depends
from backend.schemas import HealthResponse
from backend.dependencies import AppState, get_state
from backend.settings import MATERIALS_DIR_ENV, _read_env

router = APIRouter(
    prefix = "/health",
    tags = ["Health"]
)

@router.get("", response_model=HealthResponse)
def get_health(state: AppState = Depends(get_state)):
    workspace = None
    if state.repository and state.repository.work_dir:
        workspace = str(state.repository.work_dir)
    materials_dir = _read_env(MATERIALS_DIR_ENV)
    return HealthResponse(
        status="ok",
        workspace=workspace,
        materials_dir=materials_dir,
    )
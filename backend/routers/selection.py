from fastapi import APIRouter, Depends

from backend.dependencies import AppState, get_repository, get_state
from backend.schemas import (
    TemperatureSelectionRequest,
    TemperatureSelectionResponse,
)
from src.services.selection_service import SelectionService

router = APIRouter(tags=["Selection"])


def get_selection_service(state: AppState = Depends(get_state)) -> SelectionService:
    if state.properties is None:
        raise RuntimeError("PropertiesCatalog не инициализирован")
    return SelectionService(state.properties)


@router.post(
    "/selection/temperature",
    response_model=TemperatureSelectionResponse,
)
def post_temperature_selection(
    body: TemperatureSelectionRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    return service.temperature_selection(
        repo,
        body.prop_type,
        body.temperature,
        area=body.area,
        areas=body.areas,
    )

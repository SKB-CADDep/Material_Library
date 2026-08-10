from fastapi import APIRouter, Depends, HTTPException, Query

from backend.dependencies import AppState, get_repository, get_state
from backend.schemas import (
    AshbyOptionsResponse,
    AshbyRequest,
    AshbyResponse,
    SingleCalculationRequest,
    SingleCalculationResponse,
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


@router.get(
    "/selection/ashby/options",
    response_model=AshbyOptionsResponse,
)
def get_ashby_options(
    areas: list[str] | None = Query(None),
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    return service.ashby_options(repo, areas=areas)


@router.post(
    "/selection/ashby",
    response_model=AshbyResponse,
)
def post_ashby_diagram(
    body: AshbyRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    try:
        return service.ashby_diagram(
            repo,
            body.x_prop,
            body.y_prop,
            body.class_names,
            areas=body.areas,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/selection/calculate",
    response_model=SingleCalculationResponse,
)
def post_single_calculation(
    body: SingleCalculationRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    try:
        return service.single_calculation(
            repo,
            body.material_id,
            body.category_index,
            custom_temperatures=body.custom_temperatures,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

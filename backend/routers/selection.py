from fastapi import APIRouter, Depends, HTTPException, Query

from backend.dependencies import AppState, get_repository, get_state
from backend.schemas import (
    AshbyOptionsResponse,
    AshbyRequest,
    AshbyResponse,
    ComparePropsPoolRequest,
    ComparePropsPoolResponse,
    ComparePropsRequest,
    ComparePropsResponse,
    ChemCompositionEntriesResponse,
    ChemCompositionEntryItem,
    LarsonMillerRequest,
    LarsonMillerResponse,
    SingleCalculationRequest,
    SingleCalculationResponse,
    TemperatureSelectionRequest,
    TemperatureSelectionResponse,
)
from src.services.selection_service import SelectionService

router = APIRouter(tags=["Selection"])


@router.get(
    "/selection/chem/composition-entries",
    response_model=ChemCompositionEntriesResponse,
)
def get_chem_composition_entries(repo=Depends(get_repository)):
    raw_entries = repo.list_chem_composition_entries()
    return ChemCompositionEntriesResponse(
        entries=[ChemCompositionEntryItem(**item) for item in raw_entries],
    )


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


@router.get("/selection/larson-miller/hours")
def get_larson_miller_hours(
    service: SelectionService = Depends(get_selection_service),
):
    return {"hours": list(service.larson_miller_predefined_hours())}


@router.post(
    "/selection/larson-miller",
    response_model=LarsonMillerResponse,
)
def post_larson_miller(
    body: LarsonMillerRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    try:
        return service.larson_miller(
            repo,
            body.material_id,
            body.category_index,
            body.base_service_hours,
            constant_c=body.constant_c,
            custom_table_points=(
                [p.model_dump() for p in body.custom_table_points]
                if body.custom_table_points
                else None
            ),
            calc_temperature=body.calc_temperature,
            calc_service_hours=body.calc_service_hours,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/selection/compare-props/pool",
    response_model=ComparePropsPoolResponse,
)
def post_compare_props_pool(
    body: ComparePropsPoolRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    try:
        return service.compare_props_pool(
            repo,
            body.property_key,
            area=body.area,
            areas=body.areas,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/selection/compare-props",
    response_model=ComparePropsResponse,
)
def post_compare_props(
    body: ComparePropsRequest,
    repo=Depends(get_repository),
    service: SelectionService = Depends(get_selection_service),
):
    try:
        return service.compare_props_plot(
            repo,
            body.property_key,
            [item.model_dump() for item in body.items],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

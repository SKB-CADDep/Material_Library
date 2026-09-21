from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import AppState, get_state
from backend.schemas import (
    PropertiesResponse,
    HardnessColumnsResponse,
    HardnessConvertResponse,
    HardnessConvertRequest,
    UnitResponse,
    ClassificationResponse,
    ElementsCatalogResponse,
    ElementItem,
    ElementCreateRequest,
    ElementUpdateRequest,
    OkResponse,
)
from src.services.unit_manager import UnitManager
from src.services.classification_catalog import get_classification_catalog
from src.services.elements_catalog import (
    ElementsCatalogError,
    get_elements_catalog,
)

router = APIRouter(tags=["Catalogs"])

@router.get("/catalogs/properties", response_model=PropertiesResponse)
def get_properties(state: AppState=Depends(get_state)):
    physical = state.properties.physical_items()
    mechanical = state.properties.mechanical_items()
    return PropertiesResponse(physical=physical, mechanical=mechanical)

@router.get("/catalogs/classification", response_model=ClassificationResponse)
def get_classification():
    return get_classification_catalog().to_response()

@router.get("/catalogs/hardness/columns", response_model=HardnessColumnsResponse)
def get_columns(state: AppState=Depends(get_state)):
    columns = state.hardness.column_names()
    system_unit = state.hardness.SYSTEM_UNIT
    return HardnessColumnsResponse(columns = columns, system_unit=system_unit)

@router.post("/catalogs/hardness/convert", response_model=HardnessConvertResponse)
def post_convert(body:HardnessConvertRequest, state: AppState=Depends(get_state)):
    result = state.hardness.convert(body.value, body.from_unit, body.to_unit)
    return HardnessConvertResponse(result=result, from_unit=body.from_unit, to_unit=body.to_unit)

@router.get("/catalogs/units/{unit_type}", response_model=UnitResponse)
def get_unit(unit_type:str, state: AppState=Depends(get_state)):
    units = UnitManager.get_units(unit_type)
    if len(units) == 0:
        raise HTTPException(status_code=404, detail="Единицы не найдены")
    system_unit = UnitManager.get_system_unit(unit_type)
    display_labels = UnitManager.get_display_labels(unit_type)
    cfg = UnitManager.data.get(unit_type, {})
    factors = cfg.get("factors", {})
    return UnitResponse(
        unit_type=unit_type,
        system_unit=system_unit,
        units=units,
        display_labels=display_labels,
        factors=factors,
    )


@router.get("/catalogs/elements", response_model=ElementsCatalogResponse)
def get_elements():
    catalog = get_elements_catalog()
    payload = catalog.to_payload()
    return ElementsCatalogResponse(
        schema_version=str(payload["schema_version"]),
        elements=[ElementItem(**item) for item in payload["elements"]],
    )


@router.get("/catalogs/elements/{symbol}", response_model=ElementItem)
def get_element(symbol: str):
    item = get_elements_catalog().get_by_symbol(symbol)
    if item is None:
        raise HTTPException(status_code=404, detail="Элемент не найден")
    return ElementItem(**item)


@router.post("/catalogs/elements", response_model=ElementItem)
def create_element(body: ElementCreateRequest):
    catalog = get_elements_catalog()
    try:
        item = catalog.add_element(body.model_dump())
    except ElementsCatalogError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ElementItem(**item)


@router.put("/catalogs/elements/{symbol}", response_model=ElementItem)
def update_element(symbol: str, body: ElementUpdateRequest):
    catalog = get_elements_catalog()
    try:
        item = catalog.update_element(symbol, body.model_dump(exclude_unset=True))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Элемент не найден") from exc
    except ElementsCatalogError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ElementItem(**item)


@router.delete("/catalogs/elements/{symbol}", response_model=OkResponse)
def delete_element(symbol: str):
    catalog = get_elements_catalog()
    try:
        catalog.delete_element(symbol)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Элемент не найден") from exc
    except ElementsCatalogError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse(ok=True)


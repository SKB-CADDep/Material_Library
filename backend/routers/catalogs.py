from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import AppState, get_state
from backend.schemas import PropertiesResponse, HardnessColumnsResponse, HardnessConvertResponse, HardnessConvertRequest, UnitResponse
from src.services.unit_manager import UnitManager

router = APIRouter(tags=["Catalogs"])

@router.get("/catalogs/properties", response_model=PropertiesResponse)
def get_properties(state: AppState=Depends(get_state)):
    physical = state.properties.physical_items()
    mechanical = state.properties.mechanical_items()
    return PropertiesResponse(physical=physical, mechanical=mechanical)

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
    return UnitResponse(unit_type=unit_type, system_unit=system_unit, units=units)
    


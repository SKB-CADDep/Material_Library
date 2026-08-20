from __future__ import annotations
from pydantic import BaseModel, field_validator
from typing import Literal


def _normalize_source_name(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Наименование источника не может быть пустым")
    return stripped

class WorkspaceOpenRequest(BaseModel):
    directory: str

class WorkspaceResponse(BaseModel):
    count: int
    directory: str
    application_areas: list[str]

class OkResponse(BaseModel):
    ok: bool

class MaterialSummary(BaseModel):
    id: str
    name: str
    areas: list[str]
    filename: str
    has_composition: bool = False

class ChemCompositionEntryItem(BaseModel):
    material_id: str
    material_name: str
    areas: list[str]
    composition: dict

class ChemCompositionEntriesResponse(BaseModel):
    entries: list[ChemCompositionEntryItem]

class MaterialSaveResponse(BaseModel):
    ok: bool
    filename: str

class HardnessConvertRequest(BaseModel):
    value: float
    from_unit: str
    to_unit: str

class HardnessConvertResponse(BaseModel):
    result: float | None
    from_unit: str
    to_unit: str

class HardnessColumnsResponse(BaseModel):
    columns: list[str]
    system_unit: str

class HealthResponse(BaseModel):
    status: str
    workspace: str | None
    materials_dir: str | None = None

class SourceCreateRequest(BaseModel):
    group: Literal["property_sources", "strength_sources", "chemical_sources"]
    name: str
    description: str = ""
    hyperlink: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_source_name(value)

class SourceUpdateRequest(BaseModel):
    name: str
    description: str = ""
    hyperlink: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_source_name(value)

class SourcesResponse(BaseModel):
    property_sources: list["SourceItem"]
    strength_sources: list["SourceItem"]
    chemical_sources: list["SourceItem"]

class SourceItem(BaseModel):
    id_source: str
    name_source: str
    description: str = ""
    hyperlink: str = ""
    user_name_change: str = ""
    data_change: str = ""
    user_name_found: str = ""
    data_found: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> "SourceItem":
        return cls(
            id_source=str(data.get("id_source", "")),
            name_source=str(data.get("name_source", "")),
            description=str(data.get("description") or ""),
            hyperlink=str(data.get("hyperlink") or ""),
            user_name_change=str(data.get("user_name_change") or ""),
            data_change=str(data.get("data_change") or ""),
            user_name_found=str(data.get("user_name_found") or ""),
            data_found=str(data.get("data_found") or ""),
        )


class SourceUsageResponse(BaseModel):
    count: int
    examples: list[str]

class PropertiesResponse(BaseModel):
    physical: dict[str, dict]
    mechanical: dict[str, dict]

class ClassificationClassItem(BaseModel):
    name: str
    subclasses: list[str]

class ClassificationCategoryItem(BaseModel):
    name: str
    classes: list[ClassificationClassItem]

class ClassificationResponse(BaseModel):
    categories: list[ClassificationCategoryItem]

class UnitResponse(BaseModel):
    unit_type: str
    system_unit: str
    units: list[str]
    display_labels: dict[str, str] = {}
    factors: dict[str, float | str] = {}

class TemperatureSelectionColumn(BaseModel):
    key: str
    label: str
    unit: str = ""
    unit_type: str | None = None
    display_symbol: str = ""

class TemperatureSelectionRow(BaseModel):
    material_id: str
    material_name: str
    strength_category: str
    source: str
    max_temp: str | int | float | None = None
    temperature_comment: str | None = None
    category_index: int | None = None
    source_ref_id: str | None = None
    values: dict[str, float | str | None]

class TemperatureSelectionRequest(BaseModel):
    prop_type: Literal["physical", "mechanical", "hardness"]
    area: str | None = None
    areas: list[str] | None = None
    temperature: float = 20.0

class TemperatureSelectionResponse(BaseModel):
    prop_type: Literal["physical", "mechanical", "hardness"]
    temperature: float
    area: str | None = None
    columns: list[TemperatureSelectionColumn]
    rows: list[TemperatureSelectionRow]


class CalculationCell(BaseModel):
    value: float | None = None
    mode: Literal["exact", "interp", "approx", "scalar"] | None = None

class SingleCalculationColumn(BaseModel):
    key: str
    label: str
    display_symbol: str = ""
    unit: str = ""
    unit_type: str | None = None
    temperature_dependent: bool = True

class SingleCalculationRow(BaseModel):
    temperature: float | str
    values: dict[str, CalculationCell]

class SingleCalculationRequest(BaseModel):
    material_id: str
    category_index: int
    custom_temperatures: list[float] = []

class SingleCalculationResponse(BaseModel):
    material_id: str
    category_index: int
    columns: list[SingleCalculationColumn]
    db_rows: list[SingleCalculationRow]
    custom_rows: list[SingleCalculationRow] = []


class AshbyAxisOption(BaseModel):
    key: str
    label: str
    unit: str = ""
    unit_type: str | None = None
    kind: Literal["temperature", "physical", "mechanical"]


class AshbyOptionsResponse(BaseModel):
    axes: list[AshbyAxisOption]
    classes: list[str]


class AshbyRequest(BaseModel):
    x_prop: str
    y_prop: str
    class_names: list[str]
    areas: list[str] | None = None


class AshbyPoint(BaseModel):
    x: float
    y: float


class AshbySeries(BaseModel):
    id: str
    label: str
    class_name: str
    color: str
    points: list[AshbyPoint]


class AshbyHull(BaseModel):
    class_name: str
    color: str
    points: list[AshbyPoint]


class AshbyClassLegendItem(BaseModel):
    class_name: str
    color: str


class AshbyAxisMeta(BaseModel):
    key: str
    label: str
    unit: str = ""


class AshbyResponse(BaseModel):
    x_axis: AshbyAxisMeta
    y_axis: AshbyAxisMeta
    series: list[AshbySeries]
    hulls: list[AshbyHull]
    class_legend: list[AshbyClassLegendItem] = []


class ComparePropsPoolRequest(BaseModel):
    property_key: str
    areas: list[str] | None = None
    area: str | None = None


class ComparePropsPoolItem(BaseModel):
    id: str
    label: str
    material_id: str
    category_index: int | None = None


class ComparePropsPoolResponse(BaseModel):
    property_key: str
    items: list[ComparePropsPoolItem]


class ComparePropsSeriesItem(BaseModel):
    id: str
    label: str
    material_id: str
    category_index: int | None = None


class ComparePropsRequest(BaseModel):
    property_key: str
    items: list[ComparePropsSeriesItem]


class ComparePropsPoint(BaseModel):
    temperature: float
    value: float


class ComparePropsSeries(BaseModel):
    id: str
    label: str
    color: str
    has_data: bool
    points: list[ComparePropsPoint]


class ComparePropsPropertyMeta(BaseModel):
    key: str
    name: str
    symbol: str = ""
    unit: str = ""


class ComparePropsResponse(BaseModel):
    property: ComparePropsPropertyMeta
    series: list[ComparePropsSeries]


class LarsonMillerTablePoint(BaseModel):
    temperature: float
    stress: float
    service_hours: float
    p: float | None = None


class LarsonMillerCustomPoint(BaseModel):
    temperature: float
    stress: float


class LarsonMillerRequest(BaseModel):
    material_id: str
    category_index: int
    base_service_hours: float
    constant_c: float | None = None
    custom_table_points: list[LarsonMillerCustomPoint] | None = None
    calc_temperature: float | None = None
    calc_service_hours: float | None = None


class LarsonMillerChartPoint(BaseModel):
    p: float
    stress: float


class LarsonMillerResponse(BaseModel):
    material_id: str
    category_index: int
    material_name: str
    base_service_hours: float
    property_key: str = ""
    from_database: bool = False
    stored_constant_c: float | None = None
    constant_c: float | None = None
    table_points: list[LarsonMillerTablePoint]
    calc_temperature: float | None = None
    calc_service_hours: float | None = None
    calc_stress: float | None = None
    calc_p: float | None = None
    is_extrapolated: bool = False
    chart_curve: list[LarsonMillerChartPoint] = []
    chart_calc_point: LarsonMillerChartPoint | None = None


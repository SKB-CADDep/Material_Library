from __future__ import annotations
from pydantic import BaseModel
from typing import Literal

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

class SourceUpdateRequest(BaseModel):
    name: str
    description: str = ""
    hyperlink: str = ""

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


from __future__ import annotations

from typing import Any, Literal

from src.core.models.material import Material
from src.core.schema_keys import Schema
from src.services.material_repository import MaterialRepository
from src.services.properties_catalog import PropertiesCatalog

PropType = Literal["physical", "mechanical", "hardness"]

HARDNESS_COLUMNS: dict[str, dict[str, str]] = {
    "min_value": {
        "name": "Min",
        "symbol": "Min",
        "unit": "",
        "unit_type": "Твердость",
    },
    "max_value": {
        "name": "Max",
        "symbol": "Max",
        "unit": "",
        "unit_type": "Твердость",
    },
    "unit_value": {
        "name": "Ед. изм.",
        "symbol": "Ед. изм.",
        "unit": "",
        "unit_type": "Твердость",
    },
}


class SelectionService:
    """Подбор материалов. Паритет с TempSelectionTab (main.py)."""

    def __init__(self, properties: PropertiesCatalog):
        self._properties = properties

    def temperature_selection(
        self,
        repository: MaterialRepository,
        prop_type: PropType,
        temperature: float,
        area: str | None = None,
        areas: list[str] | None = None,
    ) -> dict[str, Any]:
        prop_keys = self._prop_keys(prop_type)
        columns = self._build_columns(prop_type, prop_keys)
        rows: list[dict[str, Any]] = []

        for material in repository.materials:
            if not self._matches_area(material, area, areas):
                continue
            rows.extend(
                self._rows_for_material(
                    material,
                    repository,
                    prop_type,
                    prop_keys,
                    temperature,
                )
            )

        return {
            "prop_type": prop_type,
            "temperature": temperature,
            "area": area,
            "columns": columns,
            "rows": rows,
        }

    def _prop_keys(self, prop_type: PropType) -> list[str]:
        if prop_type == "physical":
            return self._properties.physical_keys()
        if prop_type == "mechanical":
            return self._properties.mechanical_keys()
        return list(HARDNESS_COLUMNS.keys())

    def _build_columns(
        self,
        prop_type: PropType,
        prop_keys: list[str],
    ) -> list[dict[str, Any]]:
        columns: list[dict[str, Any]] = []
        for key in prop_keys:
            meta = (
                HARDNESS_COLUMNS[key]
                if prop_type == "hardness"
                else self._properties.get_meta(key)
            )
            symbol = meta.get("symbol") or meta.get("name", key)
            unit = meta.get("unit", "")
            label = f"{symbol}, {unit}" if unit else symbol
            columns.append(
                {
                    "key": key,
                    "label": label,
                    "unit": unit,
                    "unit_type": meta.get("unit_type"),
                }
            )
        return columns

    def _matches_area(
        self,
        material: Material,
        area: str | None,
        areas: list[str] | None,
    ) -> bool:
        material_areas = material.data.get(Schema.METADATA, {}).get(
            Schema.APP_AREA, []
        )
        if areas:
            return any(selected in material_areas for selected in areas)
        if area is None or area == "" or area == "Все":
            return True
        return area in material_areas

    def _temperature_meta(self, material: Material) -> tuple[Any, str | None]:
        temp_app = material.data.get(Schema.METADATA, {}).get(
            "temperature_application",
            {},
        )
        max_temp = temp_app.get("value", "-")
        comment = temp_app.get("comment") or None
        return max_temp, comment

    def _base_row(
        self,
        material: Material,
        strength_category: str,
        source: str,
        max_temp: Any,
        temperature_comment: str | None,
    ) -> dict[str, Any]:
        return {
            "material_id": material.data.get("material_id", ""),
            "material_name": material.get_display_name(),
            "strength_category": strength_category,
            "source": source or "-",
            "max_temp": max_temp,
            "temperature_comment": temperature_comment,
            "values": {},
        }

    def _rows_for_material(
        self,
        material: Material,
        repository: MaterialRepository,
        prop_type: PropType,
        prop_keys: list[str],
        temperature: float,
    ) -> list[dict[str, Any]]:
        max_temp, temperature_comment = self._temperature_meta(material)
        source_manager = repository.source_manager
        cats = material.get_strength_categories()

        if prop_type == "hardness":
            return self._hardness_rows(
                material, cats, max_temp, temperature_comment
            )

        if prop_type == "mechanical" and cats:
            rows: list[dict[str, Any]] = []
            for i, cat in enumerate(cats):
                source_str = material.get_source_info(
                    Schema.MECHANICAL,
                    category_idx=i,
                    source_manager=source_manager,
                )
                row = self._base_row(
                    material,
                    cat.get(Schema.VAL_STR_CAT, "N/A"),
                    source_str,
                    max_temp,
                    temperature_comment,
                )
                for prop_key in prop_keys:
                    row["values"][prop_key] = material.get_interpolated_property(
                        prop_key, temperature, category_idx=i
                    )
                rows.append(row)
            return rows

        schema_type = Schema.PHYSICAL if prop_type == "physical" else Schema.MECHANICAL
        source_str = material.get_source_info(
            schema_type,
            source_manager=source_manager,
        )
        row = self._base_row(
            material, "-", source_str, max_temp, temperature_comment
        )
        for prop_key in prop_keys:
            row["values"][prop_key] = material.get_interpolated_property(
                prop_key, temperature
            )
        return [row]

    def _hardness_rows(
        self,
        material: Material,
        cats: list[dict[str, Any]],
        max_temp: Any,
        temperature_comment: str | None,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []

        if not cats:
            row = self._base_row(
                material, "-", "-", max_temp, temperature_comment
            )
            row["values"] = {
                "min_value": None,
                "max_value": None,
                "unit_value": None,
            }
            rows.append(row)
            return rows

        for cat in cats:
            strength = cat.get(Schema.VAL_STR_CAT, "N/A")
            hardness_list = Material.get_hardness_entries(cat)

            if not hardness_list:
                row = self._base_row(
                    material, strength, "-", max_temp, temperature_comment
                )
                row["values"] = {
                    "min_value": None,
                    "max_value": None,
                    "unit_value": None,
                }
                rows.append(row)
                continue

            for hardness in hardness_list:
                src = hardness.get("property_source", "")
                sub = hardness.get("property_subsource")
                if sub:
                    src = f"{src} ({sub})" if src else f"({sub})"

                row = self._base_row(
                    material,
                    strength,
                    src or "-",
                    max_temp,
                    temperature_comment,
                )
                row["values"] = {
                    "min_value": hardness.get("min_value"),
                    "max_value": hardness.get("max_value"),
                    "unit_value": hardness.get("unit_value", "-"),
                }
                rows.append(row)

        return rows

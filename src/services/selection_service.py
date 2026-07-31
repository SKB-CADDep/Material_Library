from __future__ import annotations

from typing import Any, Literal

from src.core.math.interpolation import MathUtils
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
            symbol = (
                meta.get("display_symbol")
                or meta.get("symbol")
                or meta.get("name", key)
            )
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
        *,
        category_index: int | None = None,
        source_ref_id: str | None = None,
    ) -> dict[str, Any]:
        row: dict[str, Any] = {
            "material_id": material.data.get("material_id", ""),
            "material_name": material.get_display_name(),
            "strength_category": strength_category,
            "source": source or "-",
            "max_temp": max_temp,
            "temperature_comment": temperature_comment,
            "values": {},
        }
        if category_index is not None:
            row["category_index"] = category_index
        if source_ref_id:
            row["source_ref_id"] = source_ref_id
        return row

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
                material, cats, max_temp, temperature_comment, source_manager
            )

        if prop_type == "mechanical" and cats:
            rows: list[dict[str, Any]] = []
            for i, cat in enumerate(cats):
                source_str = material.get_category_source_label(
                    cat, source_manager
                )
                row = self._base_row(
                    material,
                    Material.category_name(cat) or "N/A",
                    source_str,
                    max_temp,
                    temperature_comment,
                    category_index=i,
                    source_ref_id=cat.get(Schema.REF_ID) if isinstance(cat, dict) else None,
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
        source_manager=None,
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

        for i, cat in enumerate(cats):
            strength = Material.category_name(cat) or "N/A"
            hardness_list = cat.get("hardness") or []
            cat_source = material.get_category_source_label(cat, source_manager)
            cat_ref = cat.get(Schema.REF_ID) if isinstance(cat, dict) else None

            if not hardness_list:
                row = self._base_row(
                    material,
                    strength,
                    cat_source,
                    max_temp,
                    temperature_comment,
                    category_index=i,
                    source_ref_id=cat_ref,
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
                if not src or src == "-":
                    src = cat_source

                row = self._base_row(
                    material,
                    strength,
                    src or "-",
                    max_temp,
                    temperature_comment,
                    category_index=i,
                    source_ref_id=cat_ref,
                )
                row["values"] = {
                    "min_value": hardness.get("min_value"),
                    "max_value": hardness.get("max_value"),
                    "unit_value": hardness.get("unit_value", "-"),
                }
                rows.append(row)

        return rows

    
    def _get_value_with_mode(self, material, prop_key, temp, cat_idx=None, allow_extrapolation=False):
        """
        Возвращает кортеж (value, mode) для заданного свойства:
        - value: float или None;
        - mode: "exact" (точное совпадение точки),
                "interp" (линейная интерполяция внутри диапазона),
                "approx" (линейная экстраполяция по двум ближайшим точкам),
                либо None, если значение не может быть определено.
        """
        data_container = None

        if self._properties.is_physical(prop_key):
            data_container = material.data.get(Schema.PHYSICAL, {}).get(prop_key)
        elif self._properties.is_mechanical(prop_key):
            cats = material.get_strength_categories()
            if cat_idx is not None and 0 <= cat_idx < len(cats):
                data_container = cats[cat_idx].get(prop_key)
        else:
            return None, None

        if not data_container:
            return None, None

        pairs = data_container.get(Schema.TEMP_PAIRS, [])
        if not pairs:
            return None, None

        points = []
        for t_raw, v_raw in pairs:
            t_val = MathUtils.safe_float(t_raw)
            v_val = MathUtils.safe_float(v_raw)
            if t_val is not None and v_val is not None:
                points.append((t_val, v_val))

        if not points:
            return None, None

        points.sort(key=lambda p: p[0])
        xs = [p[0] for p in points]
        min_x, max_x = xs[0], xs[-1]

        # 1. Точное совпадение
        for x, y in points:
            if x == temp:
                return y, "exact"

        # 2. Внутри диапазона — интерполяция
        if min_x < temp < max_x:
            for i in range(len(points) - 1):
                x1, y1 = points[i]
                x2, y2 = points[i + 1]
                if x1 <= temp <= x2:
                    if x2 == x1:
                        return y1, "interp"
                    val = y1 + (temp - x1) * (y2 - y1) / (x2 - x1)
                    return val, "interp"
            return None, None

        # 3. Вне диапазона
        if not allow_extrapolation:
            return None, None

        # 3.1. Если всего одна точка — повторяем её как экстраполяцию
        if len(points) == 1:
            return points[0][1], "approx"

        # 3.2. Две ближайшие точки для экстраполяции
        if temp < min_x:
            p1, p2 = points[0], points[1]
        else:
            p1, p2 = points[-2], points[-1]

        x1, y1 = p1
        x2, y2 = p2
        if x2 == x1:
            return y1, "approx"

        val = y1 + (temp - x1) * (y2 - y1) / (x2 - x1)
        return val, "approx"

    def _get_property_container(
        self,
        material: Material,
        prop_key: str,
        cat_idx: int | None = None,
    ) -> dict[str, Any] | None:
        if self._properties.is_physical(prop_key):
            return material.data.get(Schema.PHYSICAL, {}).get(prop_key)
        if self._properties.is_mechanical(prop_key):
            cats = material.get_strength_categories()
            if cat_idx is not None and 0 <= cat_idx < len(cats):
                return cats[cat_idx].get(prop_key)
        return None

    def _get_scalar_value(
        self,
        material: Material,
        prop_key: str,
        cat_idx: int | None = None,
    ) -> float | None:
        """Скалярные свойства (δ, ψ, угол): одно значение без привязки к T."""
        data_container = self._get_property_container(material, prop_key, cat_idx)
        if not data_container:
            return None

        pairs = data_container.get(Schema.TEMP_PAIRS, [])
        for _, v_raw in pairs:
            v_val = MathUtils.safe_float(v_raw)
            if v_val is not None:
                return v_val
        return None

    def _build_calculation_columns(self) -> list[dict[str, Any]]:
        columns: list[dict[str, Any]] = []
        for key in self._properties.all_keys():
            meta = self._properties.get_meta(key)
            symbol = self._properties.get_display_symbol(key)
            unit = meta.get("unit", "")
            label = f"{symbol}, {unit}" if unit else symbol
            columns.append(
                {
                    "key": key,
                    "label": label,
                    "unit": unit,
                    "unit_type": meta.get("unit_type"),
                    "temperature_dependent": self._properties.supports_temperature(key),
                }
            )
        return columns

    def single_calculation(
        self,
        repository: MaterialRepository,
        material_id: str,
        category_index: int,
        custom_temperatures: list[float] | None = None,
    ) -> dict[str, Any]:
        """Расчёт отдельно. Паритет с SingleCalculationTab (main.py)."""
        material = repository.get_by_id(material_id)
        if material is None:
            raise ValueError(f"Материал не найден: {material_id}")

        cats = material.get_strength_categories()
        if cats:
            if category_index < 0 or category_index >= len(cats):
                raise ValueError(f"Некорректный category_index: {category_index}")
            cat_idx_arg: int | None = category_index
        else:
            cat_idx_arg = None

        all_keys = self._properties.all_keys()
        temp_keys = [k for k in all_keys if self._properties.supports_temperature(k)]
        scalar_keys = [k for k in all_keys if not self._properties.supports_temperature(k)]

        all_temps: set[float] = set()
        for pk in temp_keys:
            data = self._get_property_container(material, pk, cat_idx_arg)
            if not data:
                continue
            for t_raw, _ in data.get(Schema.TEMP_PAIRS, []):
                t_val = MathUtils.safe_float(t_raw)
                if t_val is not None:
                    all_temps.add(t_val)

        scalar_values = {
            pk: self._get_scalar_value(material, pk, cat_idx_arg)
            for pk in scalar_keys
        }

        db_rows: list[dict[str, Any]] = []
        sorted_temps = sorted(all_temps)

        if not sorted_temps and any(v is not None for v in scalar_values.values()):
            values: dict[str, dict[str, Any]] = {}
            for prop_key in scalar_keys:
                values[prop_key] = {
                    "value": scalar_values.get(prop_key),
                    "mode": "scalar",
                }
            db_rows.append({"temperature": "—", "values": values})

        for t in sorted_temps:
            values = {}
            for prop_key in temp_keys:
                value, mode = self._get_value_with_mode(
                    material,
                    prop_key,
                    t,
                    cat_idx=cat_idx_arg,
                    allow_extrapolation=False,
                )
                values[prop_key] = {"value": value, "mode": mode}
            for prop_key in scalar_keys:
                values[prop_key] = {
                    "value": scalar_values.get(prop_key),
                    "mode": "scalar",
                }
            db_rows.append({"temperature": t, "values": values})

        custom_rows: list[dict[str, Any]] = []
        for temp in custom_temperatures or []:
            t_val = MathUtils.safe_float(temp)
            if t_val is None:
                continue
            values = {}
            for prop_key in temp_keys:
                value, mode = self._get_value_with_mode(
                    material,
                    prop_key,
                    t_val,
                    cat_idx=cat_idx_arg,
                    allow_extrapolation=True,
                )
                values[prop_key] = {"value": value, "mode": mode}
            for prop_key in scalar_keys:
                values[prop_key] = {
                    "value": self._get_scalar_value(material, prop_key, cat_idx_arg),
                    "mode": "scalar",
                }
            custom_rows.append({"temperature": t_val, "values": values})

        return {
            "material_id": material_id,
            "category_index": category_index,
            "columns": self._build_calculation_columns(),
            "db_rows": db_rows,
            "custom_rows": custom_rows,
        }

from __future__ import annotations

import colorsys
from typing import Any, Literal

from src.core.math.interpolation import MathUtils
from src.core.models.material import Material
from src.core.schema_keys import Schema
from src.services.material_repository import MaterialRepository
from src.services.properties_catalog import PropertiesCatalog
from src.services.unit_manager import UnitManager

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

_TEMPERATURE_AXIS = {
    "key": "temperature",
    "name": "Температура",
    "symbol": "T",
    "unit": "°С",
    "unit_type": "Температура",
    "kind": "temperature",
}

# Палитра заливки классов — как class_colors в AshbyDiagramTab (main.py)
_ASHBY_CLASS_COLORS = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
]


class SelectionService:
    """Подбор материалов. Паритет с TempSelectionTab / AshbyDiagramTab (main.py)."""

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
                    "display_symbol": symbol
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
            hardness_list = Material.get_hardness_entries(cat)
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

    # --- Диаграмма Эшби (паритет AshbyDiagramTab) ---

    def ashby_options(
        self,
        repository: MaterialRepository,
        areas: list[str] | None = None,
    ) -> dict[str, Any]:
        classes: set[str] = set()
        for material in repository.materials:
            if not self._matches_area(material, None, areas):
                continue
            class_name = self._classification_class(material)
            if class_name:
                classes.add(class_name)

        return {
            "axes": self._ashby_axes(),
            "classes": sorted(classes),
        }

    def ashby_diagram(
        self,
        repository: MaterialRepository,
        x_prop: str,
        y_prop: str,
        class_names: list[str],
        areas: list[str] | None = None,
    ) -> dict[str, Any]:
        """Паритет AshbyDiagramTab._plot_diagram (main.py)."""
        if x_prop == y_prop:
            raise ValueError("Оси X и Y должны отличаться")
        allowed = self._ashby_prop_keys()
        if x_prop not in allowed or y_prop not in allowed:
            raise ValueError("Неизвестный ключ свойства оси")

        selected_classes = list(dict.fromkeys(class_names))
        x_is_mech = self._properties.is_mechanical(x_prop)
        y_is_mech = self._properties.is_mechanical(y_prop)

        series: list[dict[str, Any]] = []
        class_legend: list[dict[str, str]] = []
        hulls: list[dict[str, Any]] = []
        series_index = 0

        for idx_class, class_name in enumerate(selected_classes):
            class_color = _ASHBY_CLASS_COLORS[idx_class % len(_ASHBY_CLASS_COLORS)]
            class_legend.append({"class_name": class_name, "color": class_color})
            class_points: list[tuple[float, float]] = []

            for material in repository.materials:
                if not self._matches_area(material, None, areas):
                    continue
                if self._classification_class(material) != class_name:
                    continue

                material_id = material.data.get("material_id", "") or material.filename
                cats = material.get_strength_categories()

                if x_is_mech or y_is_mech:
                    for cat_idx, cat in enumerate(cats):
                        cat_name = (
                            cat.get(Schema.VAL_STR_CAT, "")
                            if isinstance(cat, dict)
                            else ""
                        )
                        base_label = (
                            f"{material.get_display_name()} {cat_name}".strip()
                        )
                        points = self._ashby_series_points(
                            material, cat_idx, x_prop, y_prop
                        )
                        curve_color = self._series_color(series_index)
                        series_index += 1
                        if points:
                            class_points.extend(
                                (p["x"], p["y"]) for p in points
                            )
                            label = base_label
                        else:
                            label = f"{base_label} (нет данных)"
                        series.append(
                            {
                                "id": f"{material_id}:{cat_idx}",
                                "label": label,
                                "class_name": class_name,
                                "color": curve_color,
                                "points": points,
                            }
                        )
                else:
                    base_label = material.get_display_name()
                    points = self._ashby_series_points(
                        material, None, x_prop, y_prop
                    )
                    curve_color = self._series_color(series_index)
                    series_index += 1
                    if points:
                        class_points.extend((p["x"], p["y"]) for p in points)
                        label = base_label
                    else:
                        label = f"{base_label} (нет данных)"
                    series.append(
                        {
                            "id": material_id,
                            "label": label,
                            "class_name": class_name,
                            "color": curve_color,
                            "points": points,
                        }
                    )

            hull = self._compute_convex_hull(class_points)
            if len(hull) >= 3:
                closed = list(hull) + [hull[0]]
                hulls.append(
                    {
                        "class_name": class_name,
                        "color": class_color,
                        "points": [{"x": x, "y": y} for x, y in closed],
                    }
                )

        return {
            "x_axis": self._ashby_axis_meta(x_prop),
            "y_axis": self._ashby_axis_meta(y_prop),
            "series": series,
            "hulls": hulls,
            "class_legend": class_legend,
        }

    def _ashby_prop_keys(self) -> set[str]:
        return {"temperature", *self._properties.all_keys()}

    def _ashby_axes(self) -> list[dict[str, Any]]:
        axes = [
            {
                "key": _TEMPERATURE_AXIS["key"],
                "label": self._axis_label(
                    _TEMPERATURE_AXIS["name"],
                    _TEMPERATURE_AXIS["symbol"],
                ),
                "unit": _TEMPERATURE_AXIS["unit"],
                "unit_type": _TEMPERATURE_AXIS["unit_type"],
                "kind": "temperature",
            }
        ]
        for key in self._properties.physical_keys():
            meta = self._properties.get_meta(key)
            axes.append(
                {
                    "key": key,
                    "label": self._axis_label(
                        meta.get("name", key), meta.get("symbol", "")
                    ),
                    "unit": meta.get("unit", ""),
                    "unit_type": meta.get("unit_type"),
                    "kind": "physical",
                }
            )
        for key in self._properties.mechanical_keys():
            meta = self._properties.get_meta(key)
            axes.append(
                {
                    "key": key,
                    "label": self._axis_label(
                        meta.get("name", key), meta.get("symbol", "")
                    ),
                    "unit": meta.get("unit", ""),
                    "unit_type": meta.get("unit_type"),
                    "kind": "mechanical",
                }
            )
        return axes

    def _ashby_axis_meta(self, prop_key: str) -> dict[str, Any]:
        if prop_key == "temperature":
            unit = _TEMPERATURE_AXIS["unit"]
            return {
                "key": "temperature",
                "label": _TEMPERATURE_AXIS["name"],
                "symbol": _TEMPERATURE_AXIS["symbol"],
                "unit": self._ashby_display_unit(
                    unit, _TEMPERATURE_AXIS["unit_type"]
                ),
            }
        meta = self._properties.get_meta(prop_key)
        unit = meta.get("unit", "") or ""
        return {
            "key": prop_key,
            "label": meta.get("name", prop_key),
            "symbol": self._properties.get_display_symbol(prop_key),
            "unit": self._ashby_display_unit(unit, meta.get("unit_type")),
        }

    @staticmethod
    def _ashby_display_unit(unit: str, unit_type: str | None) -> str:
        """Единица для UI: display_labels из units_registry, иначе как в каталоге."""
        raw = (unit or "").strip()
        if not raw:
            return ""
        if not unit_type:
            return raw
        labels = UnitManager.get_display_labels(unit_type)
        if raw in labels:
            return labels[raw]
        # Температура в каталоге — «°С», в registry ключ «C».
        if unit_type == "Температура":
            celsius_keys = {"C", "°C", "°С", "С"}
            if raw in celsius_keys and "C" in labels:
                return labels["C"]
        return raw

    @staticmethod
    def _axis_label(name: str, symbol: str) -> str:
        symbol = (symbol or "").strip()
        return f"{name} ({symbol})" if symbol else name

    @staticmethod
    def _classification_class(material: Material) -> str:
        return (
            material.data.get(Schema.METADATA, {})
            .get("classification", {})
            .get("classification_class", "")
            or ""
        ).strip()

    def _ashby_series_points(
        self,
        material: Material,
        cat_idx: int | None,
        x_prop: str,
        y_prop: str,
    ) -> list[dict[str, float]]:
        temps: set[float] = set()
        for prop_key in (x_prop, y_prop):
            if prop_key == "temperature":
                continue
            for t_raw, _ in self._temp_pairs(material, prop_key, cat_idx):
                t_val = MathUtils.safe_float(t_raw)
                if t_val is not None:
                    temps.add(t_val)

        if not temps:
            return []

        points: list[dict[str, float]] = []
        for temp in sorted(temps):
            x_val = self._ashby_axis_value(material, cat_idx, x_prop, temp)
            y_val = self._ashby_axis_value(material, cat_idx, y_prop, temp)
            if x_val is not None and y_val is not None:
                points.append({"x": float(x_val), "y": float(y_val)})
        return points

    def _temp_pairs(
        self,
        material: Material,
        prop_key: str,
        cat_idx: int | None,
    ) -> list:
        prop_data = self._get_property_container(material, prop_key, cat_idx)
        if isinstance(prop_data, dict):
            return prop_data.get(Schema.TEMP_PAIRS, []) or []
        return []

    def _ashby_axis_value(
        self,
        material: Material,
        cat_idx: int | None,
        prop_key: str,
        temp: float,
    ) -> float | None:
        if prop_key == "temperature":
            return temp
        if self._properties.is_physical(prop_key):
            return material.get_interpolated_property(prop_key, temp)
        if self._properties.is_mechanical(prop_key):
            if cat_idx is None:
                return None
            return material.get_interpolated_property(
                prop_key, temp, category_idx=cat_idx
            )
        return None

    @staticmethod
    def _compute_convex_hull(
        points: list[tuple[float, float]],
    ) -> list[tuple[float, float]]:
        """Выпуклая оболочка методом монотонной цепи (Andrew)."""
        unique = sorted(set(points))
        if len(unique) <= 1:
            return unique

        def cross(
            o: tuple[float, float],
            a: tuple[float, float],
            b: tuple[float, float],
        ) -> float:
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

        lower: list[tuple[float, float]] = []
        for p in unique:
            while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
                lower.pop()
            lower.append(p)

        upper: list[tuple[float, float]] = []
        for p in reversed(unique):
            while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
                upper.pop()
            upper.append(p)

        return lower[:-1] + upper[:-1]

    @staticmethod
    def _series_color(index: int) -> str:
        """HSV-цвет по golden ratio — стабильно различаются при >10 классах."""
        golden_ratio_conjugate = 0.618033988749895
        h = (index * golden_ratio_conjugate) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 0.9, 0.9)
        return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


    def _get_value_with_mode(self, material, prop_key, temp, cat_idx=None, allow_extrapolation=False):
        """
        Возвращает кортеж (value, mode) для заданного свойства:
        - value: float или None;
        - mode: "exact" (точное совпадение точки),
                "interp" (линейная интерполяция внутри диапазона),
                "approx" (линейная экстраполяция по двум ближайшим точкам),
                либо None, если значение не может быть определено.
        """
        if not (
            self._properties.is_physical(prop_key)
            or self._properties.is_mechanical(prop_key)
        ):
            return None, None

        data_container = self._get_property_container(material, prop_key, cat_idx)
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
            return material.get_physical_data(prop_key)
        if self._properties.is_mechanical(prop_key):
            cats = material.get_strength_categories()
            if cat_idx is not None and 0 <= cat_idx < len(cats):
                return Material.get_category_prop_data(cats[cat_idx], prop_key)
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
                    "display_symbol": symbol,
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

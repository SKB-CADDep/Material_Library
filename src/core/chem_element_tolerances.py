"""
Синхронизация ABS ↔ REL допусков химсостава (п.39).

Правила (досчитываем только недостающую сторону):
  (min + ABS min) → REL min = min − ABS min
  (max + ABS max) → REL max = ABS max − max
  (min + REL min) → ABS min = min − REL min
  (max + REL max) → ABS max = max + REL max
"""
from __future__ import annotations

from typing import Any


NUMERIC_KEYS = (
    "min_value",
    "max_value",
    "min_value_tolerance",
    "max_value_tolerance",
    "min_value_tolerance_relative",
    "max_value_tolerance_relative",
)


def coerce_chem_number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        if number != number:  # NaN
            return 0.0
        return number
    try:
        text = str(value).strip().replace(",", ".")
        if not text:
            return 0.0
        return float(text)
    except (TypeError, ValueError):
        return 0.0


def _store_number(n: float) -> float:
    if n == 0:
        return 0.0
    return float(f"{n:.12g}")


def _non_negative(n: float) -> float:
    if n != n or n <= 0:  # NaN or ≤ 0
        return 0.0
    return n


def sync_element_tolerances(el: dict) -> bool:
    """
    Досчитывает недостающие ABS/REL и нормализует числовые поля (без null).
    ABS/REL не бывают отрицательными (при min/max = 0 обрезаем недопустимое).
    Возвращает True, если словарь изменился.
    """
    if not isinstance(el, dict):
        return False

    before = {key: el.get(key) for key in NUMERIC_KEYS}

    min_v = coerce_chem_number(el.get("min_value"))
    max_v = coerce_chem_number(el.get("max_value"))
    abs_min = _non_negative(coerce_chem_number(el.get("min_value_tolerance")))
    abs_max = _non_negative(coerce_chem_number(el.get("max_value_tolerance")))
    rel_min = _non_negative(
        coerce_chem_number(el.get("min_value_tolerance_relative"))
    )
    rel_max = _non_negative(
        coerce_chem_number(el.get("max_value_tolerance_relative"))
    )

    # ABS задан, REL нет → считаем REL
    if abs_min != 0 and rel_min == 0:
        if abs_min > min_v:
            abs_min = _non_negative(min_v)
        rel_min = 0.0 if abs_min == 0 else _non_negative(min_v - abs_min)
    if abs_max != 0 and rel_max == 0:
        if abs_max < max_v:
            abs_max = _non_negative(max_v)
        rel_max = 0.0 if abs_max == 0 else _non_negative(abs_max - max_v)

    # REL задан, ABS нет → считаем ABS
    if rel_min != 0 and abs_min == 0:
        max_rel_min = max(min_v, 0.0)
        if rel_min > max_rel_min:
            rel_min = max_rel_min
        abs_min = 0.0 if rel_min == 0 else _non_negative(min_v - rel_min)
    if rel_max != 0 and abs_max == 0:
        abs_max = 0.0 if rel_max == 0 else _non_negative(max_v + rel_max)

    # Финальный clamp на случай уже заполненных обеих сторон с отрицательными
    abs_min = _non_negative(abs_min)
    abs_max = _non_negative(abs_max)
    rel_min = _non_negative(rel_min)
    rel_max = _non_negative(rel_max)
    if abs_min != 0 and abs_min > min_v:
        abs_min = _non_negative(min_v)
        rel_min = 0.0 if abs_min == 0 else _non_negative(min_v - abs_min)
    if abs_max != 0 and abs_max < max_v:
        abs_max = _non_negative(max_v)
        rel_max = 0.0 if abs_max == 0 else _non_negative(abs_max - max_v)
    max_rel_min = max(min_v, 0.0)
    if rel_min > max_rel_min:
        rel_min = max_rel_min
        abs_min = 0.0 if rel_min == 0 else _non_negative(min_v - rel_min)

    el["min_value"] = _store_number(min_v)
    el["max_value"] = _store_number(max_v)
    el["min_value_tolerance"] = _store_number(abs_min)
    el["max_value_tolerance"] = _store_number(abs_max)
    el["min_value_tolerance_relative"] = _store_number(rel_min)
    el["max_value_tolerance_relative"] = _store_number(rel_max)

    for key in NUMERIC_KEYS:
        old = before[key]
        new = el[key]
        if old is None or old == "" or key not in before:
            return True
        if coerce_chem_number(old) != coerce_chem_number(new):
            return True
        # Унифицируем тип (строка "0.19" → float 0.19)
        if type(old) is not float and type(old) is not int:
            return True
        if isinstance(old, float) and old != new:
            return True
        if isinstance(old, int) and float(old) != new:
            return True
    return False


def iter_composition_element_lists(data: dict) -> list[list]:
    """Все списки other_elements в chemical_properties и property_groups."""
    lists: list[list] = []
    if not isinstance(data, dict):
        return lists

    chemical = data.get("chemical_properties")
    if isinstance(chemical, dict):
        compositions = chemical.get("composition")
        if isinstance(compositions, list):
            for entry in compositions:
                if not isinstance(entry, dict):
                    continue
                elements = entry.get("other_elements")
                if isinstance(elements, list):
                    lists.append(elements)

    groups = data.get("property_groups")
    if isinstance(groups, list):
        for group in groups:
            if not isinstance(group, dict):
                continue
            if group.get("property_type") != "chemical":
                continue
            for prop in group.get("properties") or []:
                if not isinstance(prop, dict):
                    continue
                if prop.get("property_name") != "composition":
                    continue
                payload = prop.get("data")
                if not isinstance(payload, dict):
                    continue
                elements = payload.get("other_elements")
                if isinstance(elements, list):
                    lists.append(elements)

    return lists


def migrate_material_data(data: dict) -> tuple[bool, int]:
    """
    Синхронизирует допуски во всех хим.элементах материала.
    Возвращает (changed, elements_updated).
    """
    updated = 0
    changed = False
    for elements in iter_composition_element_lists(data):
        for el in elements:
            if not isinstance(el, dict):
                continue
            if sync_element_tolerances(el):
                updated += 1
                changed = True
    return changed, updated

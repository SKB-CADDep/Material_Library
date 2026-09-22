"""Имена событий аудита и группировка изменений по вкладкам редактора."""

from __future__ import annotations

from typing import Any

from src.core.schema_keys import Schema
from src.services.properties_catalog import PropertiesCatalog

AUDIT_EVENT_NAMES = {
    "MATERIAL_SELECTED": "Материал: выбран",
    "MATERIAL_CREATE_DRAFT": "Материал: создан новый (черновик)",
    "MATERIAL_SAVE": "Материал: сохранение",
    "MATERIAL_SAVE_TAB": "Материал: изменения по вкладке",
    "MATERIAL_SAVE_AS": "Материал: сохранить как",
    "MATERIAL_RESET_CREATE": "Материал: создание сброшено",
    "MATERIAL_CANCEL_CHANGES": "Материал: изменения отменены",
    "SOURCE_SELECTED": "Источник: выбран",
    "SOURCE_CREATE": "Источник: создание",
    "SOURCE_UPDATE": "Источник: изменение",
    "SOURCE_DELETE": "Источник: удаление",
    "SOURCE_OPEN_LINK": "Источник: открыть ссылку",
    "NAV_TAB_SELECTED": "Навигация: вкладка выбрана",
    "IMPORT_OPEN_DIR": "Импорт: открыть директорию",
    "IMPORT_OPEN_DIR_ERROR": "Импорт: ошибка открытия директории",
    "HELP_ABOUT_OPEN": "Справка: о приложении открыто",
    "HELP_INSTRUCTIONS_OPEN": "Справка: инструкция открыта",
    "HELP_CHANGELOG_OPEN": "Справка: список изменений открыт",
}

EDITOR_AUDIT_TAB_ORDER = (
    "Общие данные",
    "Физические свойства",
    "Механические свойства",
    "Химический состав",
    "Прочее",
)

_MECH_CAT_FIELD_LABELS = {
    "hardness_unit": "Единица твердости (КП)",
    Schema.HARDNESS_UNIT: "Единица твердости (КП)",
    Schema.VAL_STR_CAT: "Наименование категории прочности",
    Schema.HARDNESS: "Твердость",
}

_PROPERTIES = PropertiesCatalog()


def audit_editor_tab_for_path(path: list[Any] | None) -> str | None:
    if not path:
        return None
    root = str(path[0])
    if root == Schema.METADATA:
        return "Общие данные"
    if root == Schema.PHYSICAL:
        return "Физические свойства"
    if root == Schema.MECHANICAL:
        return "Механические свойства"
    if root == Schema.CHEMICAL:
        return "Химический состав"
    return "Прочее"


def _audit_metadata_human_label(segments: list[Any]) -> str:
    if not segments:
        return "Общие данные (metadata)"
    k0 = str(segments[0])
    if k0 == Schema.NAME_STD:
        return "Наименование (стандарт)"
    if k0 == Schema.NAME_ALT:
        return "Альтернативные названия"
    if k0 == "comment":
        return "Общий комментарий"
    if k0 == Schema.APP_AREA:
        return "Области применения"
    if k0 == "classification" and len(segments) >= 2:
        sub = str(segments[1])
        sub_map = {
            "classification_category": "Классификация: категория",
            "classification_class": "Классификация: структурный класс",
            "classification_subclass": "Классификация: подкласс",
        }
        return sub_map.get(sub, f"Классификация: {sub}")
    if k0 == "classification":
        return "Классификация"
    if k0 == "temperature_application":
        if len(segments) >= 2:
            sub = str(segments[1])
            if sub == "value":
                return "Температура применения ДО (значение)"
            if sub == "comment":
                return "Комментарий к температуре применения"
        return "Параметры применения (температура)"
    return f"Общие данные: {k0}"


def _audit_prop_name_from_segment(seg: Any) -> str | None:
    s = str(seg)
    if s.startswith(f"{Schema.PROPERTIES}[") and s.endswith("]"):
        return s[len(f"{Schema.PROPERTIES}[") : -1]
    return None


def _audit_physical_human_label(segments: list[Any]) -> str:
    for seg in segments:
        sk = str(seg)
        prop_id = _audit_prop_name_from_segment(sk) or sk
        if _PROPERTIES.is_physical(prop_id):
            return _PROPERTIES.get_meta(prop_id)["name"]
    return "Физическое свойство"


def _audit_mechanical_human_label(segments: list[Any]) -> str:
    kp = None
    for seg in segments:
        s = str(seg)
        if s.startswith(f"{Schema.STRENGTH_CAT}[") and s.endswith("]"):
            kp = s[len(f"{Schema.STRENGTH_CAT}[") : -1]
    for seg in segments:
        s = str(seg)
        prop_id = _audit_prop_name_from_segment(s) or s
        if prop_id == Schema.HARDNESS or _PROPERTIES.is_mechanical(prop_id):
            name = (
                "Твердость"
                if prop_id == Schema.HARDNESS
                else _PROPERTIES.get_meta(prop_id)["name"]
            )
            if kp is not None and str(kp).strip() not in ("", "-1", "-"):
                return f"КП «{kp}»: {name}"
            return name
    for seg in segments:
        s = str(seg)
        if s in _MECH_CAT_FIELD_LABELS:
            base = _MECH_CAT_FIELD_LABELS[s]
            if kp is not None and str(kp).strip() not in ("", "-1", "-"):
                return f"КП «{kp}»: {base}"
            return base
    return "Механическое свойство (КП)"


def _audit_chemical_human_label(segments: list[Any]) -> str:
    str_segs = [str(x) for x in segments]
    elem = None
    for x in str_segs:
        if x.startswith("other_elements[") and x.endswith("]"):
            elem = x[len("other_elements[") : -1]
    for seg in str_segs:
        if seg.startswith(f"{Schema.COMPOSITION}[") and seg.endswith("]"):
            src = seg[len(f"{Schema.COMPOSITION}[") : -1]
            if "other_elements" in str_segs:
                if elem:
                    return f"Состав ({src}): элемент {elem}"
                return f"Состав ({src}): прочие элементы"
            return f"Состав ({src})"
    if Schema.COMPOSITION in str_segs:
        return "Состав (структура)"
    return "Химический состав"


def audit_human_field_label(path: list[Any] | None) -> str:
    if not path:
        return "неизвестно"
    p0 = str(path[0])
    if p0 == Schema.METADATA:
        return _audit_metadata_human_label(path[1:])
    if p0 == Schema.PHYSICAL:
        return _audit_physical_human_label(path[1:])
    if p0 == Schema.MECHANICAL:
        return _audit_mechanical_human_label(path[1:])
    if p0 == Schema.CHEMICAL:
        return _audit_chemical_human_label(path[1:])
    return str(path[-1])


def group_editor_changes_by_tab(
    changes: list[dict[str, Any]] | None,
) -> dict[str, list[str]]:
    buckets: dict[str, set[str]] = {tab: set() for tab in EDITOR_AUDIT_TAB_ORDER}
    if not changes:
        return {}
    for ch in changes:
        if not isinstance(ch, dict):
            continue
        path = ch.get("path")
        if not isinstance(path, list) or not path:
            continue
        tab = audit_editor_tab_for_path(path)
        if tab not in buckets:
            tab = "Прочее"
        label = audit_human_field_label(path)
        buckets[tab].add(label)
    return {tab: sorted(buckets[tab]) for tab in EDITOR_AUDIT_TAB_ORDER if buckets[tab]}


def source_group_label(group_key: str) -> str:
    if group_key == "property_sources":
        return "Источник свойств"
    if group_key == "strength_sources":
        return "Источник категории прочности"
    if group_key == "chemical_sources":
        return "Источник хим. свойств"
    return group_key or ""

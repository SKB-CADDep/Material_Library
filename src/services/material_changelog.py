"""Diff материалов и текстовый material_changelog.txt (паритет с десктопом)."""

from __future__ import annotations

import copy
import json
import os
from datetime import datetime
from typing import Any

from src.core.schema_keys import Schema
from src.infrastructure.paths import get_app_directory

LOG_FILENAME = "material_changelog.txt"

LIST_ITEM_KEYS = {
    (Schema.PHYSICAL, Schema.PROPERTIES): Schema.PROP_NAME,
    (Schema.MECHANICAL, Schema.STRENGTH_CAT): Schema.VAL_STR_CAT,
    (Schema.MECHANICAL, Schema.STRENGTH_CAT, Schema.PROPERTIES): Schema.PROP_NAME,
    (Schema.CHEMICAL, Schema.COMPOSITION): "composition_source",
    (Schema.CHEMICAL, Schema.COMPOSITION, "other_elements"): "element",
}


def get_username() -> str:
    try:
        return os.getlogin()
    except Exception:
        return os.environ.get("USERNAME", "unknown_user")


def find_changes(old_data: Any, new_data: Any) -> list[dict[str, Any]]:
    """Структурированный список изменений между двумя JSON-деревьями материала."""

    def list_item_key_for_path(path: list[Any]) -> str | None:
        key = LIST_ITEM_KEYS.get(tuple(path))
        if key:
            return key
        if path and str(path[-1]) == Schema.PROPERTIES:
            return Schema.PROP_NAME
        if path and str(path[-1]) == "other_elements":
            return "element"
        return None

    def find_changes_recursive(d1: Any, d2: Any, path: list[Any]) -> list[dict[str, Any]]:
        changes: list[dict[str, Any]] = []
        if isinstance(d1, dict) and isinstance(d2, dict):
            all_keys = sorted(set(d1.keys()) | set(d2.keys()))
            for key in all_keys:
                if key in ["material_id", "property_last_updated"]:
                    continue
                new_path = path + [key]
                val1, val2 = d1.get(key), d2.get(key)
                if val1 is None and val2 is not None:
                    changes.append({"path": new_path, "type": "added", "new": val2})
                elif val1 is not None and val2 is None:
                    changes.append({"path": new_path, "type": "removed", "old": val1})
                elif val1 != val2:
                    changes.extend(find_changes_recursive(val1, val2, new_path))
        elif isinstance(d1, list) and isinstance(d2, list):
            unique_key_name = list_item_key_for_path(path)
            is_list_of_dicts_with_key = unique_key_name and all(
                isinstance(item, dict) and unique_key_name in item for item in d1 + d2
            )
            if is_list_of_dicts_with_key:
                old_map = {item[unique_key_name]: item for item in d1}
                new_map = {item[unique_key_name]: item for item in d2}
                all_item_keys = sorted(set(old_map.keys()) | set(new_map.keys()))
                for item_key in all_item_keys:
                    old_item = old_map.get(item_key)
                    new_item = new_map.get(item_key)
                    item_path = path + [f"{path[-1]}[{item_key}]"]
                    if old_item is None:
                        changes.append({"path": item_path, "type": "added", "new": new_item})
                    elif new_item is None:
                        changes.append({"path": item_path, "type": "removed", "old": old_item})
                    elif old_item != new_item:
                        changes.extend(find_changes_recursive(old_item, new_item, item_path))
            else:
                if json.dumps(d1, sort_keys=True) != json.dumps(d2, sort_keys=True):
                    changes.append({"path": path, "type": "modified", "old": d1, "new": d2})
        elif d1 != d2:
            changes.append({"path": path, "type": "modified", "old": d1, "new": d2})
        return changes

    return find_changes_recursive(copy.deepcopy(old_data), copy.deepcopy(new_data), [])


def log_changes(
    material_name: str,
    changes_list: list[dict[str, Any]] | None,
    *,
    log_path: str | None = None,
    username: str | None = None,
) -> None:
    """Записывает изменения в material_changelog.txt (иерархический текст)."""
    if not changes_list:
        return
    path = log_path or os.path.join(get_app_directory(), LOG_FILENAME)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user = username if username is not None else get_username()
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write(f"Время: {timestamp}\n")
            f.write(f"Пользователь: {user}\n")
            f.write(f"Материал: {material_name}\n")
            f.write("Изменения:\n")
            printed_headers: set[tuple] = set()
            for change in changes_list:
                change_path = change["path"]
                for i in range(len(change_path) - 1):
                    header_path_tuple = tuple(change_path[: i + 1])
                    if header_path_tuple not in printed_headers:
                        indent = "  " * (i + 1)
                        header_name = change_path[i]
                        if isinstance(header_name, int):
                            f.write(
                                f"{indent}Изменения в элементе с индексом [{header_name}]:\n"
                            )
                        else:
                            f.write(f"{indent}Изменения в '{header_name}':\n")
                        printed_headers.add(header_path_tuple)
                leaf_key = change_path[-1]
                indent = "  " * len(change_path)
                ct = change["type"]
                if ct == "modified":
                    f.write(
                        f"{indent}- '{leaf_key}': [БЫЛО] '{change['old']}' -> [СТАЛО] '{change['new']}'\n"
                    )
                elif ct == "added":
                    f.write(f"{indent}- '{leaf_key}': [ДОБАВЛЕНО] -> '{change['new']}'\n")
                elif ct == "removed":
                    f.write(
                        f"{indent}- '{leaf_key}': [УДАЛЕНО] (было '{change['old']}')\n"
                    )
            f.write("\n")
    except Exception as exc:
        print(f"Ошибка записи в лог-файл: {exc}")


def changes_fields_from_diff(changes: list[dict[str, Any]] | None) -> list[str]:
    """find_changes() -> список строк-путей полей (без значений)."""
    if not changes:
        return []
    fields: set[str] = set()
    for ch in changes:
        if not isinstance(ch, dict):
            continue
        path = ch.get("path")
        if isinstance(path, list) and path:
            fields.add(".".join(str(p) for p in path if str(p)))
    return sorted(fields)

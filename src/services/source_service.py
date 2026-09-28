from __future__ import annotations

import copy
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from src.infrastructure.atomic_io import atomic_write_json
from src.infrastructure.paths import get_app_directory
from src.infrastructure.storage_backend import SOURCE_JSON_NAME


def _get_username() -> str:
    try:
        return os.getlogin()
    except Exception:
        return os.environ.get("USERNAME", "unknown_user")


def default_source_json_path() -> Path:
    """Legacy: source.json в корне приложения (Tkinter без workspace)."""
    return get_app_directory() / SOURCE_JSON_NAME


class SourceService:
    """Менеджер источников."""

    FILENAME = SOURCE_JSON_NAME

    def __init__(self, filepath: str | Path | None = None):
        if filepath is None:
            path = default_source_json_path()
        else:
            path = Path(filepath).expanduser().resolve()
        self.filepath = str(path)
        self.sources = {
            "property_sources": [],
            "strength_sources": [],
            "chemical_sources": [],
        }
        self.load()

    @property
    def filepath_path(self) -> Path:
        return Path(self.filepath)

    def set_filepath(self, filepath: str | Path) -> None:
        """Переключить файл источников и перечитать данные."""
        resolved = str(Path(filepath).expanduser().resolve())
        if resolved == self.filepath:
            return
        self.filepath = resolved
        self.load()

    def load(self):
        """Загрузка source.json"""
        if not os.path.exists(self.filepath):
            self.save()
            return
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Ошибка загрузки source.json: {e}")
            return

        if isinstance(data, list):
            self.sources = {
                "property_sources": data,
                "strength_sources": [],
                "chemical_sources": [],
            }
        elif isinstance(data, dict):
            self.sources = {
                "property_sources": data.get("property_sources", []),
                "strength_sources": data.get("strength_sources", []),
                "chemical_sources": data.get("chemical_sources", []),
            }
        else:
            self.sources = {
                "property_sources": [],
                "strength_sources": [],
                "chemical_sources": [],
            }

    def save(self) -> None:
        """Сохранить source.json атомарно. При ошибке — исключение (не silent)."""
        atomic_write_json(self.filepath, self.sources)

    def get_all(self, group=None):
        if group is not None:
            return self.sources.get(group, [])
        result = []
        for lst in self.sources.values():
            result.extend(lst)
        return result

    def get_source_by_id(self, source_id):
        for lst in self.sources.values():
            for src in lst:
                if src.get("id_source") == source_id:
                    return src
        return None

    def get_name_by_id(self, source_id):
        src = self.get_source_by_id(source_id)
        return src.get("name_source", "Без названия") if src else "Неизвестный источник"

    def add_source(self, name, description="", hyperlink="", group=None):
        if group not in ("property_sources", "strength_sources", "chemical_sources"):
            group = "property_sources"

        new_id = str(uuid.uuid4())
        new_source = {
            "id_source": new_id,
            "name_source": name,
            "description": description,
            "hyperlink": hyperlink,
            "user_name_found": _get_username(),
            "data_found": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "user_name_change": "",
            "data_change": "",
        }
        bucket = self.sources.setdefault(group, [])
        bucket.append(new_source)
        try:
            self.save()
        except Exception:
            bucket.pop()
            raise
        return new_id

    def update_source(self, source_id, name, description, hyperlink):
        for lst in self.sources.values():
            for src in lst:
                if src.get("id_source") == source_id:
                    previous = copy.deepcopy(src)
                    src.update({
                        "name_source": name,
                        "description": description,
                        "hyperlink": hyperlink,
                        "user_name_change": _get_username(),
                        "data_change": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                    try:
                        self.save()
                    except Exception:
                        src.clear()
                        src.update(previous)
                        raise
                    return True
        return False

    def delete_source(self, source_id):
        snapshot = None
        for group, lst in self.sources.items():
            new_lst = [s for s in lst if s.get("id_source") != source_id]
            if len(new_lst) != len(lst):
                snapshot = (group, list(lst))
                self.sources[group] = new_lst
                break
        if snapshot is None:
            return
        try:
            self.save()
        except Exception:
            group, previous_list = snapshot
            self.sources[group] = previous_list
            raise

    def list_all(self) -> list[dict]:
        return self.get_all()

    def get_by_id(self, source_id: str) -> dict | None:
        return self.get_source_by_id(source_id)

    @staticmethod
    def short_label(source: dict) -> str:
        return source.get("name_source", "Без названия")


SourceManager = SourceService

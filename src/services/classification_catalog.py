from __future__ import annotations

import json
from functools import lru_cache

from src.infrastructure.paths import config_dir


class ClassificationCatalog:
    """Справочник классификации материалов из config/material_classification.json."""

    def __init__(self) -> None:
        path = config_dir() / "material_classification.json"
        if not path.is_file():
            raise FileNotFoundError(f"Не найден конфиг классификации: {path}")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        self._categories: list[dict] = payload.get("categories", [])

    def to_response(self) -> dict:
        return {"categories": self._categories}

    def category_names(self) -> list[str]:
        return [item["name"] for item in self._categories if item.get("name")]

    def class_names(self, category: str) -> list[str]:
        for item in self._categories:
            if item.get("name") == category:
                return [
                    cls["name"]
                    for cls in item.get("classes", [])
                    if cls.get("name")
                ]
        return []

    def subclass_names(self, category: str, class_name: str) -> list[str]:
        for item in self._categories:
            if item.get("name") != category:
                continue
            for cls in item.get("classes", []):
                if cls.get("name") == class_name:
                    return [
                        sub
                        for sub in cls.get("subclasses", [])
                        if isinstance(sub, str) and sub.strip()
                    ]
        return []


@lru_cache
def get_classification_catalog() -> ClassificationCatalog:
    return ClassificationCatalog()

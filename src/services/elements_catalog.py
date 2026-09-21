"""Справочник химических элементов: config/elements_catalog.json."""

from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path

from src.infrastructure.paths import config_dir, project_root

SCHEMA_VERSION = "1.0"
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
SYMBOL_RE = re.compile(r"^[A-Za-zА-Яа-яЁё+][A-Za-zА-Яа-яЁё0-9+]*$")


class ElementsCatalogError(ValueError):
    pass


def _catalog_path() -> Path:
    return config_dir() / "elements_catalog.json"


def _frontend_catalog_path() -> Path | None:
    path = project_root() / "frontend" / "src" / "config" / "elements_catalog.json"
    return path if path.parent.is_dir() else None


def _normalize_element(raw: dict) -> dict:
    symbol = str(raw.get("symbol") or "").strip()
    name = str(raw.get("name") or "").strip()
    if not symbol:
        raise ElementsCatalogError("Укажите символ элемента")
    if not SYMBOL_RE.match(symbol):
        raise ElementsCatalogError(f"Некорректный символ: {symbol}")
    if not name:
        raise ElementsCatalogError("Укажите наименование элемента")

    display = raw.get("display_symbol")
    display_symbol = (
        str(display).strip() if display is not None and str(display).strip() else symbol
    )

    color_raw = raw.get("color", None)
    if color_raw is None or (isinstance(color_raw, str) and not color_raw.strip()):
        color: str | None = None
    else:
        color = str(color_raw).strip()
        if not COLOR_RE.match(color):
            raise ElementsCatalogError(
                f"Цвет должен быть в формате #RRGGBB или пустым (элемент {symbol})"
            )

    influence_raw = raw.get("influence", None)
    if influence_raw is None:
        influence: str | None = None
    else:
        text = str(influence_raw).strip()
        influence = text or None

    item: dict = {
        "symbol": symbol,
        "display_symbol": display_symbol,
        "name": name,
        "color": color,
        "influence": influence,
    }
    if "min" in raw and raw["min"] is not None:
        try:
            item["min"] = float(raw["min"])
        except (TypeError, ValueError) as exc:
            raise ElementsCatalogError(
                f"Поле min должно быть числом (элемент {symbol})"
            ) from exc
    return item


class ElementsCatalog:
    """Чтение и сохранение справочника элементов."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or _catalog_path()
        self._schema_version = SCHEMA_VERSION
        self._elements: list[dict] = []
        self.reload()

    @property
    def path(self) -> Path:
        return self._path

    def reload(self) -> None:
        if not self._path.is_file():
            raise FileNotFoundError(f"Не найден каталог элементов: {self._path}")
        with open(self._path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict):
            raise ElementsCatalogError("elements_catalog.json: ожидался объект")
        self._schema_version = str(payload.get("schema_version") or SCHEMA_VERSION)
        raw_elements = payload.get("elements", [])
        if not isinstance(raw_elements, list):
            raise ElementsCatalogError("elements_catalog.json: elements должен быть списком")
        self._elements = [_normalize_element(item) for item in raw_elements if isinstance(item, dict)]

    def list_elements(self) -> list[dict]:
        return deepcopy(self._elements)

    def get_by_symbol(self, symbol: str) -> dict | None:
        key = symbol.strip().lower()
        for item in self._elements:
            if item["symbol"].lower() == key:
                return deepcopy(item)
        return None

    def to_payload(self) -> dict:
        return {
            "schema_version": self._schema_version,
            "elements": self.list_elements(),
        }

    def _ensure_unique_symbol(self, symbol: str, *, skip_symbol: str | None = None) -> None:
        key = symbol.strip().lower()
        skip = (skip_symbol or "").strip().lower()
        for item in self._elements:
            if item["symbol"].lower() == key and item["symbol"].lower() != skip:
                raise ElementsCatalogError(f"Элемент с символом '{symbol}' уже существует")

    def add_element(self, raw: dict) -> dict:
        item = _normalize_element(raw)
        self._ensure_unique_symbol(item["symbol"])
        self._elements.append(item)
        self._elements.sort(key=lambda el: (el.get("name") or el["symbol"]).lower())
        self.save()
        return deepcopy(item)

    def update_element(self, symbol: str, raw: dict) -> dict:
        existing = self.get_by_symbol(symbol)
        if existing is None:
            raise KeyError(symbol)
        merged = {**existing, **raw, "symbol": raw.get("symbol", existing["symbol"])}
        item = _normalize_element(merged)
        self._ensure_unique_symbol(item["symbol"], skip_symbol=symbol)
        key = symbol.strip().lower()
        self._elements = [
            item if el["symbol"].lower() == key else el for el in self._elements
        ]
        self._elements.sort(key=lambda el: (el.get("name") or el["symbol"]).lower())
        self.save()
        return deepcopy(item)

    def delete_element(self, symbol: str) -> None:
        key = symbol.strip().lower()
        before = len(self._elements)
        self._elements = [el for el in self._elements if el["symbol"].lower() != key]
        if len(self._elements) == before:
            raise KeyError(symbol)
        self.save()

    def save(self) -> None:
        payload = self.to_payload()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(payload, ensure_ascii=False, indent=4) + "\n"
        self._path.write_text(text, encoding="utf-8")
        frontend_path = _frontend_catalog_path()
        if frontend_path is not None:
            frontend_path.write_text(text, encoding="utf-8")


_catalog: ElementsCatalog | None = None


def get_elements_catalog(*, force_reload: bool = False) -> ElementsCatalog:
    global _catalog
    if _catalog is None or force_reload:
        _catalog = ElementsCatalog()
    return _catalog

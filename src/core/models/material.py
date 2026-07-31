import json
import os
from datetime import datetime
import uuid

from src.core.schema_keys import Schema
from src.core.math.interpolation import MathUtils

class Material:
    """
    Класс материала. Инкапсулирует доступ к JSON-структуре.
    Реализует поиск свойств и интерполяцию.
    """

    def __init__(self, filepath=None, data=None):
        self.filepath = filepath
        if filepath:
            with open(filepath, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
        elif data:
            self.data = data
        else:
            self.data = self.get_empty_structure()
        self.filename = os.path.basename(self.filepath) if self.filepath else "Новый материал.json"

    def get_name(self):
        return self.data.get(Schema.METADATA, {}).get(Schema.NAME_STD, "Без имени")

    def get_display_name(self):
        meta = self.data.get(Schema.METADATA, {})
        std = meta.get(Schema.NAME_STD, "Без имени")
        alts = [a.strip() for a in meta.get(Schema.NAME_ALT, []) if a.strip()]
        return f"{std} ({', '.join(alts)})" if alts else std

    @staticmethod
    def get_empty_structure():
        return {
            "material_id": str(uuid.uuid4()),
            Schema.METADATA: {
                Schema.NAME_STD: "", Schema.NAME_ALT: [], Schema.APP_AREA: [], "comment": "",
                "classification": {"classification_category": "", "classification_class": "",
                                   "classification_subclass": ""}
            },
            Schema.PHYSICAL: {},
            Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
            Schema.CHEMICAL: {Schema.COMPOSITION: []}
        }

    def get_strength_categories(self):
        """Возвращает список категорий прочности."""
        return self.data.get(Schema.MECHANICAL, {}).get(Schema.STRENGTH_CAT, [])

    @staticmethod
    def category_name(cat) -> str:
        if not isinstance(cat, dict):
            return ""
        return (
            cat.get(Schema.VAL_STR_CAT)
            or cat.get(Schema.STRENGTH_CAT)
            or ""
        ).strip()

    @staticmethod
    def _category_reserved_keys():
        return {
            Schema.STRENGTH_CAT,
            Schema.VAL_STR_CAT,
            Schema.REF_ID,
            "hardness",
            "hardness_unit",
            "comment",
            "source_strength_category",
            "property_source",
            "property_subsource",
        }

    @classmethod
    def _first_property_source_in_category(cls, cat: dict) -> str | None:
        """Первый непустой property_source среди мех. свойств категории."""
        if not isinstance(cat, dict):
            return None
        reserved = cls._category_reserved_keys()
        for key, val in cat.items():
            if key in reserved or not isinstance(val, dict):
                continue
            raw = val.get("property_source")
            src = raw.strip() if isinstance(raw, str) else ""
            if not src:
                continue
            sub = val.get("property_subsource")
            if sub:
                suffix = f" ({sub})"
                return f"{src}{suffix}" if src else f"({sub})"
            return src
        return None

    def get_category_source_label(self, cat, source_manager=None) -> str:
        """
        НТД для категории прочности: source_ref_id → source_strength_category
        → property_source первого мех. свойства.
        """
        if not isinstance(cat, dict):
            return "-"
        rid = cat.get(Schema.REF_ID)
        if rid and source_manager:
            name = source_manager.get_name_by_id(rid)
            if name:
                return name
        legacy = (cat.get("source_strength_category") or "").strip()
        if legacy:
            return legacy
        prop_src = self._first_property_source_in_category(cat)
        if prop_src:
            return prop_src
        return "-"

    @classmethod
    def format_category_option_label(cls, cat, source_manager=None, index: int = 0) -> str:
        """Подпись «КП — НТД» для combobox (пара КП+источник)."""
        name = cls.category_name(cat) or f"КП #{index + 1}"
        if not isinstance(cat, dict):
            return name
        ntd = "-"
        if source_manager is not None:
            # без self: статический резолв через временный Material не нужен
            rid = cat.get(Schema.REF_ID)
            if rid:
                resolved = source_manager.get_name_by_id(rid)
                if resolved:
                    ntd = resolved
        if ntd == "-":
            legacy = (cat.get("source_strength_category") or "").strip()
            if legacy:
                ntd = legacy
        if ntd == "-":
            prop_src = cls._first_property_source_in_category(cat)
            if prop_src:
                ntd = prop_src
        if ntd and ntd != "-":
            return f"{name} — {ntd}"
        return name

    def get_interpolated_property(self, prop_key, temp, category_idx=None):
        """
        Универсальный метод получения значения свойства при температуре.
        Ищет сначала в физических, затем в механических (по категории).
        """
        # 1. Поиск в физических свойствах
        phys_props = self.data.get(Schema.PHYSICAL, {})
        if prop_key in phys_props:
            pairs = phys_props[prop_key].get(Schema.TEMP_PAIRS, [])
            val = MathUtils.linear_interpolate(pairs, temp)
            if val is not None: return val

        # 2. Поиск в механических свойствах
        cats = self.get_strength_categories()

        # Если категория задана индексом
        target_cats = [cats[category_idx]] if category_idx is not None and 0 <= category_idx < len(cats) else cats

        for cat in target_cats:
            if prop_key in cat:
                pairs = cat[prop_key].get(Schema.TEMP_PAIRS, [])
                val = MathUtils.linear_interpolate(pairs, temp)
                if val is not None: return val

        return None

    def get_source_info(self, prop_type, prop_key=None, category_idx=None, source_manager=None):
        """Получает текстовое описание источника для свойства."""

        def resolve_name(container):
            rid = container.get(Schema.REF_ID)
            if rid and source_manager: return source_manager.get_name_by_id(rid)
            return None

        if prop_type == Schema.PHYSICAL:
            container = self.data.get(Schema.PHYSICAL, {})
            name = resolve_name(container)
            if not name:  # Ищем внутри свойства
                if prop_key and prop_key in container:
                    return container[prop_key].get("property_source", "-")
            return name or "-"

        if prop_type == Schema.MECHANICAL:
            cats = self.get_strength_categories()
            if not cats:
                return "-"
            cat = (
                cats[category_idx]
                if category_idx is not None and 0 <= category_idx < len(cats)
                else cats[0]
            )
            if prop_key and isinstance(cat, dict) and prop_key in cat:
                prop = cat[prop_key]
                if isinstance(prop, dict):
                    rid = prop.get(Schema.REF_ID)
                    if rid and source_manager:
                        name = source_manager.get_name_by_id(rid)
                        if name:
                            return name
                    src = prop.get("property_source")
                    if isinstance(src, str) and src.strip():
                        sub = prop.get("property_subsource")
                        if sub:
                            return f"{src} ({sub})" if src else f"({sub})"
                        return src
            return self.get_category_source_label(cat, source_manager)

        return "-"

    def save(self, filepath=None):
        save_path = filepath or self.filepath
        if not save_path: raise ValueError("Путь не указан")
        self.filepath = save_path
        self.filename = os.path.basename(save_path)
        now = datetime.now().isoformat()

        # Обновление времени изменения
        for prop in self.data.get(Schema.PHYSICAL, {}).values():
            if "property_name" in prop: prop["property_last_updated"] = now
        for cat in self.get_strength_categories():
            for k, v in cat.items():
                if isinstance(v, dict) and "property_name" in v: v["property_last_updated"] = now

        with open(save_path, 'w', encoding='utf-8') as f:
             json.dump(self.data, f, ensure_ascii=False, indent=2)
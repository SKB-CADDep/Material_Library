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
            if not cats: return "-"
            # Берем первую или указанную категорию
            cat = cats[category_idx] if category_idx is not None and 0 <= category_idx < len(cats) else cats[0]
            name = resolve_name(cat)
            if not name and prop_key and prop_key in cat:
                return cat[prop_key].get("property_source", "-")
            return name or "-"

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
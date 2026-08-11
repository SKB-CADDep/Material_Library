import json
import os
from datetime import datetime
import uuid

from src.core.schema_keys import Schema
from src.core.math.interpolation import MathUtils


class Material:
    """
    Материал. Схема свойств:

      physical_properties: {
        properties: [{ property_name, temperature_value_pairs, value_unit, ... }, ...]
      }
      mechanical_properties: {
        strength_category: [{
          value_strength_category,
          hardness: [{ unit_value, min_value, max_value }, ...],
          hardness_unit?,
          properties: [{ property_name, temperature_value_pairs, ... }, ...]
        }]
      }
      chemical_properties: { composition: [...] }

    Legacy: physical_properties как dict {id: obj} и свойства прямо на КП
    нормализуются при загрузке.
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
        self.normalize_schema()

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
                "classification": {
                    "classification_category": "",
                    "classification_class": "",
                    "classification_subclass": "",
                },
            },
            Schema.PHYSICAL: {Schema.PROPERTIES: []},
            Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        }

    @staticmethod
    def empty_strength_category(name=""):
        return {
            Schema.VAL_STR_CAT: name,
            Schema.PROPERTIES: [],
        }

    # ------------------------------------------------------------------
    # helpers для списка properties[{property_name, ...}]
    # ------------------------------------------------------------------

    @staticmethod
    def find_named_prop(props, prop_name):
        if not isinstance(props, list) or not prop_name:
            return None
        for item in props:
            if isinstance(item, dict) and item.get(Schema.PROP_NAME) == prop_name:
                return item
        return None

    @staticmethod
    def upsert_named_prop(props, prop_name, data):
        if not isinstance(props, list):
            props = []
        payload = dict(data) if data else {}
        payload[Schema.PROP_NAME] = prop_name
        for i, item in enumerate(props):
            if isinstance(item, dict) and item.get(Schema.PROP_NAME) == prop_name:
                props[i] = payload
                return props
        props.append(payload)
        return props

    @staticmethod
    def remove_named_prop(props, prop_name):
        if not isinstance(props, list):
            return []
        return [
            p for p in props
            if not (isinstance(p, dict) and p.get(Schema.PROP_NAME) == prop_name)
        ]

    @staticmethod
    def category_name(cat):
        if not isinstance(cat, dict):
            return ""
        return cat.get(Schema.VAL_STR_CAT) or ""

    # ------------------------------------------------------------------
    # Physical
    # ------------------------------------------------------------------

    def get_physical_list(self):
        phys = self.data.get(Schema.PHYSICAL)
        if isinstance(phys, dict):
            props = phys.get(Schema.PROPERTIES)
            return props if isinstance(props, list) else []
        if isinstance(phys, list):
            return phys
        return []

    def get_physical_data(self, prop_name):
        return self.find_named_prop(self.get_physical_list(), prop_name)

    def set_physical_data(self, prop_name, data):
        phys = self.data.get(Schema.PHYSICAL)
        if not isinstance(phys, dict):
            phys = {Schema.PROPERTIES: []}
            self.data[Schema.PHYSICAL] = phys
        props = phys.get(Schema.PROPERTIES)
        if not isinstance(props, list):
            props = []
        phys[Schema.PROPERTIES] = self.upsert_named_prop(props, prop_name, data)

    def remove_physical_data(self, prop_name):
        phys = self.data.get(Schema.PHYSICAL)
        if not isinstance(phys, dict):
            return
        phys[Schema.PROPERTIES] = self.remove_named_prop(
            phys.get(Schema.PROPERTIES, []), prop_name
        )

    @staticmethod
    def physical_data_from_raw(material_data, prop_name):
        """Lookup из сырого dict (для графиков без Material)."""
        if not isinstance(material_data, dict):
            return None
        phys = material_data.get(Schema.PHYSICAL)
        if isinstance(phys, dict):
            props = phys.get(Schema.PROPERTIES)
            if isinstance(props, list):
                return Material.find_named_prop(props, prop_name)
            # legacy dict {id: obj}
            prop = phys.get(prop_name)
            return prop if isinstance(prop, dict) else None
        if isinstance(phys, list):
            return Material.find_named_prop(phys, prop_name)
        return None

    # ------------------------------------------------------------------
    # Mechanical / strength categories
    # ------------------------------------------------------------------

    def get_strength_categories(self):
        return self.data.get(Schema.MECHANICAL, {}).get(Schema.STRENGTH_CAT, []) or []

    @staticmethod
    def get_category_prop_data(cat, prop_name):
        if not isinstance(cat, dict) or not prop_name:
            return None
        props = cat.get(Schema.PROPERTIES)
        if isinstance(props, list):
            return Material.find_named_prop(props, prop_name)
        # legacy: свойство прямо на КП
        prop = cat.get(prop_name)
        return prop if isinstance(prop, dict) else None

    @staticmethod
    def set_category_prop_data(cat, prop_name, data):
        if not isinstance(cat, dict):
            return
        props = cat.get(Schema.PROPERTIES)
        if not isinstance(props, list):
            props = []
        cat[Schema.PROPERTIES] = Material.upsert_named_prop(props, prop_name, data)
        # убрать legacy-ключ
        existing = cat.get(prop_name)
        if prop_name not in (
            Schema.VAL_STR_CAT, Schema.PROPERTIES, Schema.REF_ID,
            Schema.HARDNESS, Schema.HARDNESS_UNIT, "comment",
        ) and isinstance(existing, dict):
            del cat[prop_name]

    @staticmethod
    def remove_category_prop_data(cat, prop_name):
        if not isinstance(cat, dict):
            return
        cat[Schema.PROPERTIES] = Material.remove_named_prop(
            cat.get(Schema.PROPERTIES, []), prop_name
        )
        if prop_name in cat and isinstance(cat.get(prop_name), dict):
            del cat[prop_name]

    @staticmethod
    def get_hardness_entries(cat):
        """Всегда возвращает список записей твёрдости."""
        if not isinstance(cat, dict):
            return []
        hard = cat.get(Schema.HARDNESS)
        if isinstance(hard, dict) and (
            "min_value" in hard or "max_value" in hard or "unit_value" in hard
        ):
            return [hard]
        if isinstance(hard, list):
            return [h for h in hard if isinstance(h, dict)]
        return []

    @staticmethod
    def get_hardness_unit(cat, default="HB"):
        if not isinstance(cat, dict):
            return default
        unit = cat.get(Schema.HARDNESS_UNIT)
        if unit:
            return unit
        entries = Material.get_hardness_entries(cat)
        if entries and entries[0].get("unit_value"):
            return entries[0]["unit_value"]
        return default

    @staticmethod
    def set_hardness_entries(cat, values_list, unit="HB"):
        """Пишет hardness всегда списком записей."""
        if not isinstance(cat, dict):
            return
        values_list = [v for v in (values_list or []) if isinstance(v, dict)]
        cat[Schema.HARDNESS_UNIT] = unit
        cat[Schema.HARDNESS] = values_list

    # ------------------------------------------------------------------
    # Interpolation / sources
    # ------------------------------------------------------------------

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
        prop = self.get_physical_data(prop_key)
        if prop:
            val = MathUtils.linear_interpolate(prop.get(Schema.TEMP_PAIRS, []), temp)
            if val is not None:
                return val

        cats = self.get_strength_categories()
        target = (
            [cats[category_idx]]
            if category_idx is not None and 0 <= category_idx < len(cats)
            else cats
        )
        for cat in target:
            prop = self.get_category_prop_data(cat, prop_key)
            if prop:
                val = MathUtils.linear_interpolate(prop.get(Schema.TEMP_PAIRS, []), temp)
                if val is not None:
                    return val
        return None

    def get_source_info(self, prop_type, prop_key=None, category_idx=None, source_manager=None):
        """Получает текстовое описание источника для свойства."""

        def resolve(container):
            if not isinstance(container, dict):
                return None
            rid = container.get(Schema.REF_ID)
            if rid and source_manager:
                name = source_manager.get_name_by_id(rid)
                # fallback, если id не найден в source.json
                if name and name != "Неизвестный источник":
                    return name
            src = container.get("property_source")
            if isinstance(src, str) and src.strip():
                sub = container.get("property_subsource")
                if sub:
                    return f"{src.strip()} ({sub})"
                return src.strip()
            sub = container.get("property_subsource")
            if isinstance(sub, str) and sub.strip():
                return sub.strip()
            return None

        if prop_type == Schema.PHYSICAL:
            if prop_key:
                return resolve(self.get_physical_data(prop_key)) or "-"
            # без prop_key — первый заполненный источник среди физ. свойств
            for prop in self.get_physical_list():
                name = resolve(prop)
                if name:
                    return name
            return "-"

        if prop_type == Schema.MECHANICAL:
            cats = self.get_strength_categories()
            if not cats:
                return "-"
            cat = (
                cats[category_idx]
                if category_idx is not None and 0 <= category_idx < len(cats)
                else cats[0]
            )
            # при prop_key — сначала источник свойства (новая схема)
            if prop_key:
                name = resolve(self.get_category_prop_data(cat, prop_key))
                if name:
                    return name
            # НТД категории: REF_ID / legacy / первое свойство
            return self.get_category_source_label(cat, source_manager)

        return "-"

    # ------------------------------------------------------------------
    # Legacy → новая схема
    # ------------------------------------------------------------------

    def normalize_schema(self):
        self._normalize_physical()
        self._normalize_mechanical()

    def _normalize_physical(self):
        phys = self.data.get(Schema.PHYSICAL)
        if phys is None:
            self.data[Schema.PHYSICAL] = {Schema.PROPERTIES: []}
            return
        if isinstance(phys, list):
            # уже массив свойств на корне — обернуть
            self.data[Schema.PHYSICAL] = {Schema.PROPERTIES: phys}
            return
        if not isinstance(phys, dict):
            self.data[Schema.PHYSICAL] = {Schema.PROPERTIES: []}
            return
        if isinstance(phys.get(Schema.PROPERTIES), list):
            return
        # legacy: { density: {...}, ... }
        props = []
        for key, val in list(phys.items()):
            if key == Schema.PROPERTIES or key == Schema.REF_ID:
                continue
            if isinstance(val, dict):
                item = dict(val)
                item[Schema.PROP_NAME] = key
                props.append(item)
        self.data[Schema.PHYSICAL] = {Schema.PROPERTIES: props}

    def _normalize_mechanical(self):
        mech = self.data.get(Schema.MECHANICAL)
        if not isinstance(mech, dict):
            self.data[Schema.MECHANICAL] = {Schema.STRENGTH_CAT: []}
            return
        cats = mech.get(Schema.STRENGTH_CAT)
        if not isinstance(cats, list):
            mech[Schema.STRENGTH_CAT] = []
            return
        for cat in cats:
            self._normalize_category(cat)

    @staticmethod
    def _normalize_category(cat):
        if not isinstance(cat, dict):
            return
        props = cat.get(Schema.PROPERTIES)
        if not isinstance(props, list):
            props = []
            cat[Schema.PROPERTIES] = props

        hard = cat.get(Schema.HARDNESS)
        if isinstance(hard, dict) and (
            "min_value" in hard or "max_value" in hard or "unit_value" in hard
        ):
            cat[Schema.HARDNESS] = [hard]
        elif not isinstance(hard, list):
            cat[Schema.HARDNESS] = []

        reserved = {
            Schema.VAL_STR_CAT, Schema.PROPERTIES, Schema.REF_ID,
            Schema.HARDNESS, Schema.HARDNESS_UNIT,
            "comment", "property_source", "property_subsource",
        }

        for key, val in list(cat.items()):
            if key in reserved:
                continue
            if isinstance(val, dict) and (
                Schema.TEMP_PAIRS in val or "value_unit" in val or "property_unit" in val
            ):
                if Material.find_named_prop(props, key) is None:
                    item = dict(val)
                    item[Schema.PROP_NAME] = key
                    props.append(item)
                del cat[key]

    @staticmethod
    def normalize_metadata(data: dict) -> None:
        meta = data.get(Schema.METADATA)
        if not isinstance(meta, dict):
            return
        alts = meta.get(Schema.NAME_ALT)
        if isinstance(alts, str):
            meta[Schema.NAME_ALT] = [
                part.strip() for part in alts.split(",") if part.strip()
            ]
        elif alts is None:
            meta[Schema.NAME_ALT] = []
        elif isinstance(alts, list):
            meta[Schema.NAME_ALT] = [
                str(part).strip() for part in alts if str(part).strip()
            ]

    def save(self, filepath=None):
        save_path = filepath or self.filepath
        if not save_path:
            raise ValueError("Путь не указан")
        self.normalize_metadata(self.data)
        self.filepath = save_path
        self.filename = os.path.basename(save_path)
        self.normalize_schema()
        now = datetime.now().isoformat()

        for prop in self.get_physical_list():
            if isinstance(prop, dict):
                prop["property_last_updated"] = now

        for cat in self.get_strength_categories():
            for prop in cat.get(Schema.PROPERTIES) or []:
                if isinstance(prop, dict):
                    prop["property_last_updated"] = now

        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

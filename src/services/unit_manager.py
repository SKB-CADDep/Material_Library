import json

from src.infrastructure.paths import config_dir
from src.services.hardness_table import HardnessTable

class UnitManager:
    """
    Менеджер единиц измерения.
    Архитектура:
    1. У каждого типа есть одна SYSTEM_UNIT (Закон проекта).
    2. factors хранит коэффициент перевода: ИЗ Единицы -> В System_Unit.
       Пример: Pressure System = кгс/см2.
       Factor для МПа = 10.197162 (т.е. 1 МПа * 10.197 = Значение в кгс/см2).
    """
    HARDNESS = HardnessTable()

    @staticmethod
    def _load_json(filename: str) -> dict:
        path = config_dir() / filename
        if not path.is_file():
            raise FileNotFoundError(f"Не найден config/units_registry.json: {path}")
        with open(path, encoding="utf-8") as f:
            return json.load(f)


   
    # ==========================================
    # ТАБЛИЦА ПЕРЕВОДА ТВЕРДОСТИ
    # Сортировка: по возрастанию d10 (диаметр отпечатка)
    # Формат кортежа: (d10, HB, HRA, HRC, HRB, HV, HSD)
    # Если значения нет, стоит None.
    # ==========================================
    @staticmethod
    def get_system_unit(type_name):
        cfg = UnitManager.data.get(type_name)
        return cfg["system_unit"] if cfg else ""

    @staticmethod
    def get_types():
        return list(UnitManager.data.keys())

    @staticmethod
    def get_units(type_name):
        if type_name in UnitManager.data:
            return list(UnitManager.data[type_name]["factors"].keys())
        return []

    # --- ЛОГИКА ИНТЕРПОЛЯЦИИ ТВЕРДОСТИ (ИСПРАВЛЕННАЯ) ---


    # --- КОНВЕРТАЦИЯ В СИСТЕМНУЮ ЕДИНИЦУ (ВХОД) ---
    @staticmethod
    def to_system(value, from_unit, type_name):
        # 1. Спец. обработка для Твердости
        if type_name == "Твердость":
            system_unit = UnitManager.get_system_unit(type_name) # HB
            if from_unit == system_unit:
                return float(value)
            # Перевод: Единица -> HB (по таблице)
            res = UnitManager.HARDNESS.convert(float(value), from_unit, system_unit)
            return res if res is not None else 0.0

        # 2. Стандартная обработка
        cfg = UnitManager.data.get(type_name)
        if not cfg: return value

        factor = cfg["factors"].get(from_unit)
        if factor is None: return value

        try:
            val = float(value)
        except (TypeError, ValueError):
            return 0.0

        if factor == "offset_k": return val - 273.15
        if factor == "offset_f": return (val - 32.0) * 5 / 9

        return val * factor

    # --- КОНВЕРТАЦИЯ ИЗ СИСТЕМНОЙ ЕДИНИЦЫ (ВЫХОД) ---
    @staticmethod
    def from_system(value, to_unit, type_name):
        # 1. Спец. обработка для Твердости
        if type_name == "Твердость":
            system_unit = UnitManager.get_system_unit(type_name) # HB
            if to_unit == system_unit:
                return float(value)
            # Перевод: HB -> Единица (по таблице)
            res = UnitManager.HARDNESS.convert(float(value), system_unit, to_unit)
            return res if res is not None else 0.0

        # 2. Стандартная обработка
        cfg = UnitManager.data.get(type_name)
        if not cfg: return value

        factor = cfg["factors"].get(to_unit)
        if factor is None: return value

        try:
            val = float(value)
        except (TypeError, ValueError):
            return 0.0

        if factor == "offset_k": return val + 273.15
        if factor == "offset_f": return (val * 9 / 5) + 32.0

        return val / factor

UnitManager.data = UnitManager._load_json("units_registry.json")
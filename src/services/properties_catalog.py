import json
from src.infrastructure.paths import config_dir
class PropertiesCatalog:
    def _load_json(self, filename):
        path = config_dir() / filename
        if not path.is_file():
            raise FileNotFoundError(f"Не найден конфиг свойств:{path}")
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def __init__(self):
        self._physical = self._load_json("physical_properties.json")
        self._mechanical = self._load_json("mechanical_properties.json")

    def physical_keys(self):
            keys = self._physical.keys()
            return list(keys)
    
    def mechanical_keys(self):
            keys = self._mechanical.keys()
            return list(keys)

    def get_meta(self, key):
        meta = self._physical.get(key) or self._mechanical.get(key)
        if meta is None:
            raise KeyError(key)
        else:
            return meta

    def supports_temperature(self, key):
        meta = self.get_meta(key)
        return meta.get("temperature_dependent", True)

    

        
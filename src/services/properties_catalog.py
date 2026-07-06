import json
from src.infrastructure.paths import config_dir
class PropertiesCatalog:
    def __init__(self):
        with open (config_dir()/"physical_properties.json", encoding="utf-8") as file:
            self._physical = json.load(file)
        with open (config_dir() / "mechanical_properties.json", encoding="utf-8") as file:
            self._mechanical = json.load(file)
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
        if key in ["relative_elongation", "relative_contraction", "angle_of_bend"]:
            return False
        else:
            return True

    

        
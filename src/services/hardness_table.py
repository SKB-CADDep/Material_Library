import json
from src.infrastructure.paths import config_dir

class HardnessTable:
    def __init__(self):
        with open (config_dir()/"hardness_table.json", encoding="utf-8") as file:
            data = json.load(file)
        self._columns = data["columns"]
        self._rows = data["rows"]
        self._idx = {name: i for i, name in enumerate(self._columns)}
    
    @staticmethod
    def _interpolate_hardness(self, value, col_source_name, col_target_name):
        """
        Ищет значение в таблице, используя линейную интерполяцию.
        Если значение выходит за пределы известных данных для этой пары единиц — возвращает None.
        """
        idx_src = self._idx.get(col_source_name)
        idx_tgt = self._idx.get(col_target_name)

        if idx_src is None or idx_tgt is None:
            return None

        # 1. Собираем только ВАЛИДНЫЕ пары (X, Y) для конкретных двух колонок
        points = []
        for row in self._rows:
            x = row[idx_src]
            y = row[idx_tgt]
            if x is not None and y is not None:
                points.append((float(x), float(y)))

        # 2. Сортируем по X (входной величине)
        points.sort(key=lambda p: p[0])

        if not points:
            return None

        # 3. ПРОВЕРКА ГРАНИЦ (ИСПРАВЛЕНО)
        # Если значение меньше минимума или больше максимума, определенного в таблице,
        # значит конвертация невозможна (шкала не поддерживает такую твердость).
        min_x = points[0][0]
        max_x = points[-1][0]

        if value < min_x or value > max_x:
            return None  # Вернет 0.0 в методах to_system/from_system

        # 4. Линейная интерполяция внутри диапазона
        for i in range(len(points) - 1):
            x1, y1 = points[i]
            x2, y2 = points[i + 1]

            if x1 <= value <= x2:
                if x2 == x1: return y1
                return y1 + (value - x1) * (y2 - y1) / (x2 - x1)

        return points[-1][1]
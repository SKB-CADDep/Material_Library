import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import subprocess
import uuid
from datetime import datetime
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.patches import Ellipse
import copy
import sys

# --- Константа для конвертации единиц измерения (двунаправленная) ---

UNIT_CONVERSION_GROUPS = {
    # Группа для единиц давления/напряжения
    "pressure": {
        "units": ["МПа", "кгс/см²"],
        # Матрица коэффициентов: factors[ИЗ_ЕДИНИЦЫ][В_ЕДИНИЦУ]
        "factors": {
            "МПа": {
                "МПа": 1.0,
                "кгс/см²": 10.19716
            },
            "кгс/см²": {
                "кгс/см²": 1.0,
                "МПа": 0.0980665
            }
        }
    }
    # В будущем сюда можно добавить другие группы
}

# --- Константа для "умного" сравнения списков в логах ---
# Указывает, по какому ключу идентифицировать элементы в конкретном списке
LIST_ITEM_KEYS = {
    # Путь к списку в JSON                       # Уникальный ключ элемента
    ("mechanical_properties", "strength_category"): "value_strength_category",
    ("chemical_properties", "composition"):         "composition_source",
    ("chemical_properties", "composition", "other_elements"): "element" # Для вложенных списков
}

# --- Константы с описанием свойств ---

PHYSICAL_PROPERTIES_MAP = {
    "modulus_elasticity": {"name": "Модуль упругости", "symbol": "E", "unit": "МПа"},
    "coefficient_linear_expansion": {"name": "Коэффициент линейного расширения (·10¯⁶)", "symbol": "α", "unit": "1/°С"},
    "coefficient_thermal_conductivity": {"name": "Коэффициент теплопроводности", "symbol": "λ", "unit": "Вт/(м·°С)"},
    "density": {"name": "Плотность", "symbol": "ρ", "unit": "кг/м³"},
    "specific_heat": {"name": "Удельная теплоемкость", "symbol": "С", "unit": "Дж/(кг‧°С)"},
}

MECHANICAL_PROPERTIES_MAP = {
    "yield_strength": {"name": "Предел текучести", "symbol": "σ_0,2", "unit": "МПа"},
    "tensile_strength": {"name": "Предел прочности", "symbol": "σ_в", "unit": "МПа"},
    "impact_strength": {"name": "Ударная вязкость", "symbol": "KCU", "unit": "Дж/см²"},
    "tensile_strength_limit_10_thousands_hours": {"name": "Предел длит. прочности за 10 тыс.ч", "symbol": "σ_дп_10",
                                                  "unit": "МПа"},
    "tensile_strength_limit_100_thousands_hours": {"name": "Предел длит. прочности за 100 тыс.ч", "symbol": "σ_дп_100",
                                                   "unit": "МПа"},
    "tensile_strength_limit_200_thousands_hours": {"name": "Предел длит. прочности за 200 тыс.ч", "symbol": "σ_дп_200",
                                                   "unit": "МПа"},
    "tensile_strength_limit_250_thousands_hours": {"name": "Предел длит. прочности за 250 тыс.ч", "symbol": "σ_дп_250",
                                                   "unit": "МПа"},
    "сreep_strain_rate_1_100_thousands_hours": {"name": "Ползучесть при скорости деформации 1%/100 тыс.ч",
                                                "symbol": "σ_1_100", "unit": "МПа"},
    "decrement_oscillations_at_800": {"name": "Декремент колебаний при 800 (·10¯⁴)", "symbol": "δψ_800", "unit": "кгс/см²"},
    "decrement_oscillations_at_1200": {"name": "Декремент колебаний при 1200 (·10¯⁴)", "symbol": "δψ_1200",
                                       "unit": "кгс/см²"},
    "decrement_oscillations_at_1600": {"name": "Декремент колебаний при 1600 (·10¯⁴)", "symbol": "δψ_1600",
                                       "unit": "кгс/см²"},
    "fatigue_limit_for_smooth_specimen": {"name": "Предел выносливости (гладкий образец, N=10e7)",
                                          "symbol": "σ_-1_smooth", "unit": "МПа"},
    "fatigue_limit_for_notched_specimen": {"name": "Предел выносливости (образец с надрезом, N=10e7)",
                                           "symbol": "σ_-1_notched", "unit": "МПа"},
}

ALL_PROPERTIES_MAP = {**PHYSICAL_PROPERTIES_MAP, **MECHANICAL_PROPERTIES_MAP}


# --- Вспомогательная функция для редактирования ячеек Treeview ---
def create_editable_treeview(parent_frame, on_update_callback=None):
    """Создает Treeview и добавляет к нему логику редактирования ячеек."""
    tree = ttk.Treeview(parent_frame)

    def on_tree_double_click(event):
        region = tree.identify("region", event.x, event.y)
        if region != "cell":
            return

        item_id = tree.focus()
        column = tree.identify_column(event.x)

        # Получаем геометрию ячейки
        x, y, width, height = tree.bbox(item_id, column)

        # Создаем временное поле для ввода
        entry_var = tk.StringVar()
        entry = ttk.Entry(tree, textvariable=entry_var)

        # Получаем текущее значение и устанавливаем его в поле
        current_value = tree.set(item_id, column)
        entry_var.set(current_value)

        entry.place(x=x, y=y, width=width, height=height)
        entry.focus_set()
        entry.selection_range(0, tk.END)

        def on_focus_out(event):
            tree.set(item_id, column, entry_var.get())
            entry.destroy()
            # Вызываем callback, если он был передан
            if on_update_callback:
                on_update_callback()

        def on_enter_press(event):
            on_focus_out(event)

        entry.bind("<FocusOut>", on_focus_out)
        entry.bind("<Return>", on_enter_press)

    tree.bind("<Double-1>", on_tree_double_click)
    return tree

def get_app_directory():
    """Возвращает путь к директории, где находится exe или .py файл."""
    if getattr(sys, 'frozen', False):
        # Если приложение "заморожено" (PyInstaller)
        return os.path.dirname(sys.executable)
    else:
        # Если запускается как обычный .py скрипт
        return os.path.dirname(os.path.abspath(__file__))

APP_TEXT = """Приложение "Material_Lib"
Версия: 2.02
Год: 2025.11.11
Промт-инженер: Гаврилов П.Я.
Тестировщики: Лалаева С.Г., Гаврилова Н.Я.
AI ассистент (кодогенерирующий): gemini-2.5-pro

Приложение для управления и анализа
свойств конструкционных материалов.
"""
INSTR_TEXT = """1. НАЧАЛО РАБОТЫ

1.1. Для начала работы выберите меню "Файл" -> "Открыть директорию..." и укажите папку, в которой находятся ваши JSON-файлы материалов.
1.2. Если рядом с приложением есть папка "БД Материалов", она будет загружена автоматически при старте.
1.3. Области применения собираются автоматически из загруженных файлов (metadata.application_area). Для добавления новых областей используйте вкладку "Добавление / Редактирование материала" -> "Общие данные".
1.4. После загрузки материалов вкладки приложения станут активны.

2. ВКЛАДКА "ПОДБОР МАТЕРИАЛА"

Эта вкладка предназначена для анализа существующих материалов (без изменения файлов).

2.1. Подбор по температуре:
   - Отфильтруйте материалы по "Область применения" (необязательно).
   - Выберите тип свойств: "Физические свойства", "Механические свойства" или "Твердость".
   - Введите температуру (°С) — расчёт выполняется автоматически (интерполяция между ближайшими точками).
   - В таблице показываются материалы, категория прочности (КП), источники (НТД) и значения свойств при выбранной температуре.
   - Сортировка: щёлкните по заголовку столбца. Копирование: ПКМ по ячейке -> "Копировать".

2.2. Расчёт отдельно:
   - Фильтруйте по "Область применения" (необязательно), затем выберите материал и (при наличии) его категорию прочности.
   - Введите температуру и нажмите "Рассчитать".
   - Будут показаны значения всех ключевых свойств при заданной температуре.
   - Переключение единиц доступно для свойств, где предусмотрена конвертация (например, МПа ⇄ кгс/см²). Кнопка "Сбросить" возвращает значения и единицы по умолчанию.

2.3. Сравнение материалов (свойства):
   - Выберите свойство из выпадающего списка.
   - Найдите материалы через поле "Поиск" и добавьте их в список "Выбранные" двойным кликом. Удаление — тоже двойной клик по выбранному.
   - Нажмите "Построить график". Строится зависимость выбранного свойства от температуры для каждого материала/категории.
   - Подписи точек отображают значения. Кнопка "Домой" сбрасывает вид (перерисовка), Zoom/панорамирование доступны на панели.
   - Ограничение цвета: одновременно различимо до 10 кривых.

2.4. Сравнение материалов (хим. состав):
   - Отфильтруйте материалы по "Область применения" и/или используйте поиск.
   - Выделите один или несколько материалов (список слева). При выборе конкретной области (и пустом поиске) все материалы выделяются автоматически.
   - В таблице показывается химический состав по источникам. Над таблицей — поля фильтров по элементам (%).
   - Ввод целевого значения по элементу подсвечивает строки:
     * Зеленым — совпадение по всем заданным фильтрам;
     * Розовым — есть несовпадение.
   - Подсказки по влиянию элементов доступны при наведении на заголовок столбца с символом элемента.

2.5. Диаграмма Эшби:
   - Выберите свойства для осей X и Y.
   - Через поиск добавьте материалы в список "Выбранные" (двойной клик), удаление — двойной клик по выбранному.
   - На диаграмме каждый материал отображается эллипсом, охватывающим диапазон значений (min..max) по каждой оси.
   - По умолчанию: X — "Предел текучести (σ_0,2)", Y — "Температура (T)". Панель инструментов поддерживает масштабирование и панорамирование.

3. ВКЛАДКА "ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ МАТЕРИАЛА"

Все изменения выполняются во временной копии и не попадают в файл до сохранения.

3.1. Верхняя панель:
   - Выбор материала из выпадающего списка.
   - Кнопки: "Сохранить", "Сохранить как...", "Отменить изменения".
     • "Сохранить" — перезаписывает исходный файл (если он есть).
     • "Сохранить как..." — сохраняет под новым именем/в новую папку и перезагружает базу из выбранной директории.
     • "Отменить изменения" — откатывает несохранённые правки текущего материала.

3.2. Общие данные:
   - Наименование (стандарт), альтернативные названия, общий комментарий.
   - Классификация: категория, класс, подкласс.
   - Области применения: список чекбоксов + поле "Добавить область применения".
   - Параметры применения: "Температура применения ДО, °С" и комментарий.

3.3. Физические свойства:
   - Для каждого свойства указываются источник, под-источник, комментарий и таблица точек (температура — значение).
   - Редактирование ячейки — двойной клик; "+" добавляет строку; "-" удаляет выбранную строку.
   - График справа обновляется по мере изменения таблицы.
   - Числовые значения вводите с точкой (например, 20.5).

3.4. Механические свойства:
   - Свойства задаются по категориям прочности (КП). Добавляйте/удаляйте категории кнопками "+" / "-".
   - Внутри каждой категории свойства редактируются аналогично физическим (источник, таблица точек, график).
   - Блок "Твердость" редактируется отдельной таблицей (источник, под-источник, min/max, ед. изм.).

3.5. Химический состав:
   - Источники состава: добавление/удаление источников и их редактирование.
   - Таблица элементов: элемент, min/max (%), единица (по умолчанию "%"), допуски min/max (строки).
   - Строки без названия элемента игнорируются при сохранении.

3.6. Сохранение и логирование:
   - При сохранении вычисляются и записываются изменения в файл "material_changelog.txt" (рядом с приложением).
   - В журнал попадает: время, пользователь, материал и список изменённых полей.

4. ВКЛАДКА "РАБОТА С ИСТОЧНИКАМИ"

4.1. Просмотр:
   - Автоматически собираются все уникальные источники и под-источники из физических/механических свойств, твердости и хим. состава.
   - Если в папке "Источники" (рядом с приложением) найден файл с таким именем (или тем же именем и популярным расширением: .pdf, .docx, .xlsx, .txt, .jpg, .png), в таблице появляется кликабельная ссылка.
   - Клик по ссылке открывает файл системным приложением.

5. ВАЖНЫЕ ЗАМЕЧАНИЯ

5.1. Структура JSON: Приложение ожидает корректную структуру (metadata, physical_properties, mechanical_properties.strength_category, chemical_properties.composition). Нарушение структуры может вызвать ошибки.
5.2. Числовые значения: Вводите числа через точку (например, 123.45). Запись с запятой (",") будет проигнорирована.
5.3. Горячие клавиши: Копирование/вставка/вырезание/выделение работают только на английской раскладке.
5.4. Папки рядом с приложением: "БД Материалов" (для автозагрузки базы при старте — по желанию) и "Источники" (для открытия связанных файлов) можно держать рядом с .exe.
"""
CHANGELOG_TEXT = """v2.00 2025.07.08 - Релизная:
- Реализована работа с подбором материала:
    1. Подбор материала по температуре - позволит подобрать материал по свойствам при заданной температуре
    2. Сравнение материалов (свойства) - позволяет визуализировать выбранное свойство для выбранных материалов. Гибкая настройка отображения графиков
    3. Сравнение материалов (хим. состав) - отображает хим. состав выбранных материалов поэлементно для сравнения материалов между собой. В случае если у материала имеется несколько источников, то выводятся все.
- Реализована работа с созданием / редактированием / удалением материалов согласно заложенной структуре.

v2.01 Изменения:

2025.07.09
Дополнения:
- В область "Сравнение материалов (хим. свойства)" добавлена возможность подбора материала под заданные значения % содержания того или иного элемента
- При наведении на элемент хим. состава всплывает подсказка о наименовании элемента, и его положительное и негативное влияние на свойства материала
Исправления:
- Устранена ошибка с сохранением файла материала
- В области "Сравнение материалов (свойства)" разделены физические и механические свойства. При необходимости сравнивать один материал с разным КП мы выделяем нужные материалы с "КП". При необходимости сравнивать физические свойства, мы выбираем заглавный материал без "КП"
- Исправлена ошибка обновления механических свойств взависимости от выбранного "КП"
- Исправлена ошибка отображения "Области применения"

2025.07.10
Дополнения:
- Добавлено логирование внесенных изменений в БД. Файл логов находится в директории с exe файлов. Фиксирует дату, пользователя, материал и изменения которые были внесены
- Добавлен фильтр в область "Сравнение материалов (хим. свойства)". Выводятся только те материалы в которых есть хим. состав
- Добавлена кнопка "Отменить изменения" (в меню "Файл") если не нужно сохранять введеные значения в редакторе материала
- Добавлена область "Работа с источниками". Позволяет просматривать:
    - применяемые в библиотеке источники
    - фильтровать по области применения, материалу
    - вносить глобальные изменения в наименование источников
- Добавлена прокрутка колесиком мыши в областях редактирования и подбора метериала
- Добавлена фильтрация по выбранному свойству области "Сравнение материалов (свойства)"

2025.07.11
Дополнения:
- Добавлено отображение имени материала как Наименование (альтернативное наименование)
- Добавлены графики отображения физ. и мех. свойств в области редактирования материала
- Поправлено визуальное оформление вывода элементов хим. состава в области "Сравнение материалов (хим. состав)"
- Добавлен скролинг колесом мыши в области "Сравнение материалов (хим. состав)"
- Обновление справочных материалов
Исправления:
- Исправлена работа приложения с открытой инструкцией, окно приложения больше не блокируется
- Исправлено отображение мех. свойств на графике при нажатии на "домик" в области "Сравнение материалов (свойства)"

2025.07.15
Исправления:
- Исключен файл "application_area.txt"

v2.02 Изменения:

2025.11.10
Дополнения:
- Добавлена диаграмма Эшби с возможностью гибкой настройки сравниваемых свойств, а также материалов:
   - Добавлен поиск по наименованию материала
   - Изменена логика выбора материалов к представлению на графике
   - Сделан отдельный список выбранных материалов
   - При переключении между свойствами выбранные материалы не сбрасываются
   - При отсутствии данных по свойству в легенде пишется "нет данных"
   - Добавлена кнопка "Сбросить"
   - Программа автоматически подключает БД находящуюся с ней в одной директории
- Переделана вкладка "Сравнение материалов (свойства)":
   - Добавлен поиск по наименованию материала
   - Изменена логика выбора материалов к представлению на графике
   - Сделан отдельный список выбранных материалов
   - При переключении между свойствами выбранные материалы не сбрасываются
   - При отсутствии данных по свойству в легенде пишется "нет данных"
   - Добавлена кнопка "Сбросить"
- Добавлена вкладка для работы с одним материалом "Расчет отдельно":
   - Фильтрация по области применения
   - Выбор конкретного материала
   - Интерполяция по заданному значению температуры
   - Изменение единиц измерения в рамках сессии

Исправлено:
- Кнопки "Сохранить", "Сохранить как..." и "Сбросить" перенесены на вкладку "Добавление / Редактирование материала"
- Доработан вывод логов для повышения удобства читаемости.

2025.11.11
Дополнение:
- Добавлена возможность вписывать "Температура применения ДО"
- Доработана вкладка "Подбор по температуре":
   - добавлено разделение между типами свойств
   - добавлены колонки НТД и Температура применения
   - расчет температуры производится автоматически
- Доработана вкладка "Сравнение материалов (хим. состав)":
   - Добавлена кнопка "Сбросить"
   - Добавлено поле "Поиск материала"

Исправлено:
- Пофикшен сброс "Области применения"
- Изменена работа окна "Работа с источниками":
   - Составлен общий перечень
   - Добавлена возможность щелкать на гиперссылки и открывать документ
"""

def read_text_from_file(filename):
    embedded = {
        "app_list.txt": APP_TEXT,
        "instruction_list.txt": INSTR_TEXT,
        "change_list.txt": CHANGELOG_TEXT,
    }
    if filename in embedded:
        return embedded[filename]
    # иначе — пробуем читать с диска
    try:
        pass #filepath = resource_path(filename)
        #with open(filepath, 'r', encoding='utf-8') as f:
            #return f.read()
    except Exception as e:
        return f"ОШИБКА: Не удалось прочитать '{filename}'. {e}"

LOG_FILENAME = "material_changelog.txt"


def get_username():
    """Простой способ получить имя пользователя."""
    try:
        return os.getlogin()
    except Exception:
        # Резервный вариант, если getlogin() не сработает
        return os.environ.get("USERNAME", "unknown_user")


def find_changes(old_data, new_data):
    """
    Главная функция для поиска изменений. Подготавливает данные и вызывает рекурсивный хелпер.
    Возвращает структурированный список изменений.
    """

    def find_changes_recursive(d1, d2, path):
        """Рекурсивно сравнивает словари и списки, возвращая структурированный список изменений."""
        changes = []

        # --- Сравнение СЛОВАРЕЙ ---
        if isinstance(d1, dict) and isinstance(d2, dict):
            all_keys = sorted(list(set(d1.keys()) | set(d2.keys())))
            for key in all_keys:
                if key in ["material_id", "property_last_updated"]: continue
                new_path = path + [key]
                val1, val2 = d1.get(key), d2.get(key)
                if val1 is None and val2 is not None:
                    changes.append({'path': new_path, 'type': 'added', 'new': val2})
                elif val1 is not None and val2 is None:
                    changes.append({'path': new_path, 'type': 'removed', 'old': val1})
                elif val1 != val2:
                    changes.extend(find_changes_recursive(val1, val2, new_path))

        # --- Сравнение СПИСКОВ ---
        elif isinstance(d1, list) and isinstance(d2, list):
            # Проверяем, является ли этот список "особенным" (списком словарей с ключом)
            unique_key_name = LIST_ITEM_KEYS.get(tuple(path))

            # Проверяем, что все элементы - словари и содержат уникальный ключ
            is_list_of_dicts_with_key = (unique_key_name and
                                         all(isinstance(item, dict) and unique_key_name in item for item in d1 + d2))

            if is_list_of_dicts_with_key:
                # "Умное" сравнение для списка словарей
                old_map = {item[unique_key_name]: item for item in d1}
                new_map = {item[unique_key_name]: item for item in d2}
                all_item_keys = sorted(list(set(old_map.keys()) | set(new_map.keys())))

                for item_key in all_item_keys:
                    old_item = old_map.get(item_key)
                    new_item = new_map.get(item_key)
                    # Создаем описательный путь, например: 'strength_category[КП 100]'
                    item_path = path + [f"{path[-1]}[{item_key}]"]

                    if old_item is None:
                        changes.append({'path': item_path, 'type': 'added', 'new': new_item})
                    elif new_item is None:
                        changes.append({'path': item_path, 'type': 'removed', 'old': old_item})
                    elif old_item != new_item:
                        changes.extend(find_changes_recursive(old_item, new_item, item_path))
            else:
                # Простое сравнение для обычных списков (например, список строк)
                if json.dumps(d1, sort_keys=True) != json.dumps(d2, sort_keys=True):
                    changes.append({'path': path, 'type': 'modified', 'old': d1, 'new': d2})

        # --- Сравнение ПРОСТЫХ ЗНАЧЕНИЙ ---
        elif d1 != d2:
            changes.append({'path': path, 'type': 'modified', 'old': d1, 'new': d2})

        return changes

    old_copy = copy.deepcopy(old_data)
    new_copy = copy.deepcopy(new_data)
    return find_changes_recursive(old_copy, new_copy, [])


def log_changes(material_name, changes_list):
    """Записывает изменения в лог-файл в иерархическом виде."""
    if not changes_list:
        return

    log_path = os.path.join(get_app_directory(), LOG_FILENAME)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    username = get_username()

    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"Время: {timestamp}\n")
            f.write(f"Пользователь: {username}\n")
            f.write(f"Материал: {material_name}\n")
            f.write("Изменения:\n")

            printed_headers = set()

            for change in changes_list:
                path = change['path']

                # --- Печать иерархических заголовков ---
                for i in range(len(path) - 1):
                    # Создаем путь к заголовку (например, 'metadata' или 'metadata.density')
                    header_path_tuple = tuple(path[:i + 1])

                    if header_path_tuple not in printed_headers:
                        indent = "  " * (i + 1)
                        header_name = path[i]
                        # Проверяем, не является ли ключ числом (индекс списка)
                        if isinstance(header_name, int):
                            f.write(f"{indent}Изменения в элементе с индексом [{header_name}]:\n")
                        else:
                            f.write(f"{indent}Изменения в '{header_name}':\n")
                        printed_headers.add(header_path_tuple)

                # --- Печать самого изменения ---
                leaf_key = path[-1]
                indent = "  " * len(path)

                change_type = change['type']

                if change_type == 'modified':
                    line = f"{indent}- '{leaf_key}': [БЫЛО] '{change['old']}' -> [СТАЛО] '{change['new']}'\n"
                elif change_type == 'added':
                    line = f"{indent}- '{leaf_key}': [ДОБАВЛЕНО] -> '{change['new']}'\n"
                elif change_type == 'removed':
                    line = f"{indent}- '{leaf_key}': [УДАЛЕНО] (было '{change['old']}')\n"

                f.write(line)

            f.write("\n")
    except Exception as e:
        print(f"Ошибка записи в лог-файл: {e}")

# --- Классы данных ---
class Material:
    """Класс для представления одного материала и его свойств."""

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
        return self.data.get("metadata", {}).get("name_material_standard", "Без имени")

    def get_display_name(self):
        """Возвращает форматированное имя для отображения: 'Стандартное (альт1, альт2)'."""
        meta = self.data.get("metadata", {})
        standard_name = meta.get("name_material_standard", "Без имени")
        alternatives = meta.get("name_material_alternative", [])

        # Формируем строку только если есть альтернативные названия
        if alternatives:
            # Убираем пустые строки на случай, если они есть в JSON
            valid_alternatives = [alt.strip() for alt in alternatives if alt.strip()]
            if valid_alternatives:
                alternatives_str = ", ".join(valid_alternatives)
                return f"{standard_name} ({alternatives_str})"

        # Если альтернативных имен нет, возвращаем только стандартное
        return standard_name

    @staticmethod
    def get_empty_structure():
        """Возвращает пустой шаблон для нового материала."""
        return {
            "material_id": str(uuid.uuid4()),
            "metadata": {
                "name_material_standard": "", "name_material_alternative": [], "application_area": [],
                "comment": "", "classification": {"classification_category": "", "classification_class": "",
                                                  "classification_subclass": ""}
            },
            "physical_properties": {},
            "mechanical_properties": {"strength_category": []},
            "chemical_properties": {"composition": []}
        }

    def get_property_at_temp(self, prop_key, temp):
        prop_data = None
        if prop_key in self.data.get("physical_properties", {}):
            prop_data = self.data["physical_properties"][prop_key]
        else:
            for category in self.data.get("mechanical_properties", {}).get("strength_category", []):
                if prop_key in category:
                    prop_data = category[prop_key]
                    break
        if not prop_data or "temperature_value_pairs" not in prop_data: return "-"
        pairs = sorted(prop_data["temperature_value_pairs"], key=lambda p: p[0])
        if not pairs: return "-"
        for t, val in pairs:
            if t == temp: return val
        lower_point, upper_point = None, None
        for t, val in pairs:
            if t < temp:
                lower_point = (t, val)
            elif t > temp:
                upper_point = (t, val); break
        if lower_point and upper_point:
            t1, v1 = lower_point;
            t2, v2 = upper_point
            if t2 - t1 == 0: return v1  # Избегаем деления на ноль
            interpolated_val = v1 + (temp - t1) * (v2 - v1) / (t2 - t1)
            return f"{interpolated_val:.2f}"
        return "-"

    def save(self, filepath=None):
        save_path = filepath or self.filepath
        if not save_path: raise ValueError("Не указан путь для сохранения файла.")
        self.filepath = save_path
        self.filename = os.path.basename(save_path)
        now = datetime.now().isoformat()
        for prop in self.data.get("physical_properties", {}).values():
            if "property_name" in prop: prop["property_last_updated"] = now
        for category in self.data.get("mechanical_properties", {}).get("strength_category", []):
            for m_key, prop in category.items():
                if isinstance(prop, dict) and "property_name" in prop:
                    prop["property_last_updated"] = now
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)


class AppData:
    """Класс для хранения данных состояния приложения."""

    def __init__(self):
        self.work_dir = ""
        self.materials = []
        self.application_areas = []
        self.current_material = None

    def load_materials_from_dir(self, directory):
        self.work_dir = directory
        self.materials.clear()
        for filename in os.listdir(directory):
            if filename.endswith('.json'):
                try:
                    filepath = os.path.join(directory, filename)
                    self.materials.append(Material(filepath=filepath))
                except Exception as e:
                    print(f"Ошибка загрузки файла {filename}: {e}")
        self.materials.sort(key=lambda m: m.get_display_name())
        # Вызов load_application_areas остается здесь
        self.load_application_areas()

    # ИЗМЕНИТЕ ЭТОТ МЕТОД:
    def load_application_areas(self):
        """
        Динамически собирает все уникальные области применения
        из загруженных материалов.
        """
        self.application_areas.clear()
        all_areas = set()

        for material in self.materials:
            # Безопасно получаем список областей для текущего материала
            areas_for_material = material.data.get("metadata", {}).get("application_area", [])
            if areas_for_material:
                # Добавляем все элементы из списка в set, дубликаты игнорируются
                all_areas.update(areas_for_material)

        # Сортируем уникальные области по алфавиту и сохраняем
        self.application_areas = sorted(list(all_areas))


# --- Классы для вкладки "Подбор материала" ---
class ViewerFrame(ttk.Frame):
    """Контейнер для вкладки 'Подбор материала'."""
    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data

        # Создаем Notebook для вложенных вкладок
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both")

        # Создаем все вкладки
        self.temp_tab = TempSelectionTab(self.notebook, self.app_data)
        # --- НОВАЯ СТРОКА: Создаем экземпляр нашей новой вкладки ---
        self.calc_tab = SingleCalculationTab(self.notebook, self.app_data)
        self.prop_tab = PropertyComparisonTab(self.notebook, self.app_data)
        self.chem_tab = ChemComparisonTab(self.notebook, self.app_data)
        self.ashby_tab = AshbyDiagramTab(self.notebook, self.app_data)

        # Добавляем вкладки в Notebook в нужном порядке
        self.notebook.add(self.temp_tab, text="Подбор по температуре")
        # --- НОВАЯ СТРОКА: Добавляем новую вкладку в нужное место ---
        self.notebook.add(self.calc_tab, text="Расчет отдельно")
        self.notebook.add(self.prop_tab, text="Сравнение материалов (свойства)")
        self.notebook.add(self.chem_tab, text="Сравнение материалов (хим. состав)")
        self.notebook.add(self.ashby_tab, text="Диаграмма Эшби")

    def update_view(self):
        """Обновляет все дочерние вкладки."""
        self.temp_tab.update_comboboxes()
        # --- НОВАЯ СТРОКА: Не забываем обновить и новую вкладку ---
        self.calc_tab.update_comboboxes()
        self.prop_tab.update_lists()
        self.chem_tab.update_lists()
        self.ashby_tab.update_lists()


class TempSelectionTab(ttk.Frame):
    """Вкладка 'Подбор по температуре' с выводом данных по категориям прочности."""

    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data
        self.treeview_data = []

        self.PROP_TYPES = ["Физические свойства", "Механические свойства", "Твердость"]
        self.PROPERTY_COLUMN_WIDTH = 100

        self.HARDNESS_COLUMNS = {
            "min_value": {"name": "Min", "width": self.PROPERTY_COLUMN_WIDTH},
            "max_value": {"name": "Max", "width": self.PROPERTY_COLUMN_WIDTH},
            "unit_value": {"name": "Ед. изм.", "width": self.PROPERTY_COLUMN_WIDTH}
        }

        self._after_id = None

        style = ttk.Style()
        style.configure("Treeview.Heading", padding=(5, 5), wraplength=120, font=('TkDefaultFont', 9))
        style.map("Treeview",
                  background=[("selected", "gray")],
                  foreground=[("selected", "white")])

        self._setup_widgets()
        self._setup_treeview()
        self._reconfigure_scrollable_treeview(self.PROP_TYPES[0])

    def _setup_widgets(self):
        controls_frame = ttk.Frame(self)
        controls_frame.pack(fill="x", padx=10, pady=10)
        ttk.Label(controls_frame, text="Тип свойств:").pack(side="left", padx=(0, 5))
        self.prop_type_combo = ttk.Combobox(controls_frame, state="readonly", width=20, values=self.PROP_TYPES)
        self.prop_type_combo.pack(side="left", padx=5)
        self.prop_type_combo.set(self.PROP_TYPES[0])
        self.prop_type_combo.bind("<<ComboboxSelected>>", self._trigger_calculate)
        ttk.Label(controls_frame, text="Область применения:").pack(side="left", padx=(10, 5))
        self.area_combo = ttk.Combobox(controls_frame, state="readonly", width=30)
        self.area_combo.pack(side="left", padx=5)
        self.area_combo.bind("<<ComboboxSelected>>", self._trigger_calculate)
        ttk.Label(controls_frame, text="Температура, °С:").pack(side="left", padx=(20, 5))
        self.temp_entry = ttk.Entry(controls_frame, width=10)
        self.temp_entry.pack(side="left", padx=5)
        self.temp_entry.insert(0, "20")
        self.temp_entry.bind("<KeyRelease>", self._trigger_calculate)

    def _trigger_calculate(self, event=None):
        if self._after_id:
            self.after_cancel(self._after_id)
        self._after_id = self.after(300, self._on_calculate)

    def _setup_treeview(self):
        tree_container = ttk.Frame(self)
        tree_container.pack(expand=True, fill="both", padx=10, pady=(0, 10))
        tree_container.grid_rowconfigure(0, weight=1)
        tree_container.grid_columnconfigure(1, weight=1)
        frozen_columns = ["material_name", "strength_category", "source", "max_temp"]
        self.tree_frozen = ttk.Treeview(tree_container, columns=frozen_columns, show="headings")
        self.tree_scrollable = ttk.Treeview(tree_container, columns=[], show="headings")
        self.tree_frozen.grid(row=0, column=0, sticky="nswe")
        self.tree_scrollable.grid(row=0, column=1, sticky="nswe")
        self.tree_frozen.heading("material_name", text="Материал",
                                 command=lambda: self._sort_column("material_name", False))
        self.tree_frozen.column("material_name", width=150, minwidth=150)
        self.tree_frozen.heading("strength_category", text="КП",
                                 command=lambda: self._sort_column("strength_category", False))
        self.tree_frozen.column("strength_category", width=50, minwidth=50)
        self.tree_frozen.heading("source", text="НТД", command=lambda: self._sort_column("source", False))
        self.tree_frozen.column("source", width=120, minwidth=120)
        self.tree_frozen.heading("max_temp", text="tприм ДО, °С",
                                 command=lambda: self._sort_column("max_temp", False))
        self.tree_frozen.column("max_temp", width=100, minwidth=100, anchor="center")
        vsb = ttk.Scrollbar(tree_container, orient="vertical", command=self._on_vertical_scroll)
        vsb.grid(row=0, column=2, sticky="ns")
        hsb = ttk.Scrollbar(tree_container, orient="horizontal", command=self.tree_scrollable.xview)
        hsb.grid(row=1, column=1, sticky="ew")
        self.tree_frozen.configure(yscrollcommand=vsb.set)
        self.tree_scrollable.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self.tree_frozen.bind("<MouseWheel>", self._on_mousewheel)
        self.tree_scrollable.bind("<MouseWheel>", self._on_mousewheel)
        self.tree_frozen.bind("<Button-4>", lambda e: self._on_mousewheel(e, -1))
        self.tree_frozen.bind("<Button-5>", lambda e: self._on_mousewheel(e, 1))
        self.tree_scrollable.bind("<Button-4>", lambda e: self._on_mousewheel(e, -1))
        self.tree_scrollable.bind("<Button-5>", lambda e: self._on_mousewheel(e, 1))
        self.context_menu = tk.Menu(self, tearoff=0)
        self.context_menu.add_command(label="Копировать", command=self._copy_cell_value)
        self.last_clicked_tree = None
        self.tree_frozen.bind("<Button-3>", self._show_context_menu)
        self.tree_scrollable.bind("<Button-3>", self._show_context_menu)

    def _reconfigure_scrollable_treeview(self, prop_type):
        for col in self.tree_scrollable["columns"]:
            pass
        self.tree_scrollable["columns"] = []
        prop_map = {}
        if prop_type == "Физические свойства":
            prop_map = PHYSICAL_PROPERTIES_MAP
        elif prop_type == "Механические свойства":
            prop_map = MECHANICAL_PROPERTIES_MAP
        elif prop_type == "Твердость":
            prop_map = self.HARDNESS_COLUMNS
        new_columns = list(prop_map.keys())
        self.tree_scrollable["columns"] = new_columns
        for prop_key, prop_info in prop_map.items():
            header_text = prop_info.get('symbol', prop_info.get('name', prop_key))
            if 'unit' in prop_info and prop_info['unit']:
                header_text += f", {prop_info['unit']}"
            self.tree_scrollable.heading(prop_key, text=header_text,
                                         command=lambda k=prop_key: self._sort_column(k, False))
            self.tree_scrollable.column(prop_key, width=self.PROPERTY_COLUMN_WIDTH, minwidth=80, anchor="center")

    def _get_value_from_prop_data(self, prop_data, temp):
        if not prop_data or "temperature_value_pairs" not in prop_data: return "-"
        pairs = sorted(prop_data.get("temperature_value_pairs", []), key=lambda p: p[0])
        if not pairs: return "-"
        for t, val in pairs:
            if t == temp: return val
        lower_point, upper_point = None, None
        for t, val in pairs:
            try:
                t_float, v_float = float(t), float(val)
                if t_float < temp:
                    lower_point = (t_float, v_float)
                elif t_float > temp:
                    upper_point = (t_float, v_float)
                    break
            except (ValueError, TypeError):
                continue
        if lower_point and upper_point:
            t1, v1 = lower_point;
            t2, v2 = upper_point
            if t2 - t1 == 0: return v1
            return f"{v1 + (temp - t1) * (v2 - v1) / (t2 - t1):.2f}"
        return "-"

    def _on_calculate(self):
        selected_prop_type = self.prop_type_combo.get()
        self._reconfigure_scrollable_treeview(selected_prop_type)
        temp_str = self.temp_entry.get()
        try:
            temp = float(temp_str if temp_str else "0")
        except ValueError:
            return
        selected_area = self.area_combo.get()
        filtered_materials = [m for m in self.app_data.materials if
                              selected_area == "Все" or selected_area in m.data.get("metadata", {}).get(
                                  "application_area", [])]
        self.treeview_data = []
        for mat in filtered_materials:
            max_app_temp = mat.data.get("metadata", {}).get("temperature_application", {}).get("value", "-")
            strength_categories = mat.data.get("mechanical_properties", {}).get("strength_category", [])
            is_phys = selected_prop_type == "Физические свойства"
            if selected_prop_type in ["Физические свойства", "Механические свойства"]:
                prop_map = PHYSICAL_PROPERTIES_MAP if is_phys else MECHANICAL_PROPERTIES_MAP
                phys_sources = set(p.get("property_source") for p in mat.data.get("physical_properties", {}).values() if
                                   p.get("property_source")) if is_phys else set()
                if strength_categories:
                    for category in strength_categories:
                        mech_sources = set(category.get(pk, {}).get("property_source") for pk in prop_map if
                                           category.get(pk, {}).get("property_source")) if not is_phys else set()
                        source_str = ", ".join(sorted(phys_sources if is_phys else mech_sources)) or "-"
                        row_data = {"material_name": mat.get_display_name(), "obj": mat,
                                    "strength_category": category.get("value_strength_category", "N/A"),
                                    "source": source_str, "max_temp": max_app_temp}
                        for prop_key in prop_map:
                            prop_data_dict = mat.data.get("physical_properties", {}).get(
                                prop_key) if is_phys else category.get(prop_key)
                            row_data[prop_key] = self._get_value_from_prop_data(prop_data_dict, temp)
                        self.treeview_data.append(row_data)
                else:
                    source_str = ", ".join(sorted(phys_sources)) if is_phys else "-"
                    row_data = {"material_name": mat.get_display_name(), "obj": mat, "strength_category": "-",
                                "source": source_str, "max_temp": max_app_temp}
                    for prop_key in prop_map:
                        prop_data_dict = mat.data.get("physical_properties", {}).get(prop_key) if is_phys else None
                        row_data[prop_key] = self._get_value_from_prop_data(prop_data_dict, temp)
                    self.treeview_data.append(row_data)
            elif selected_prop_type == "Твердость":
                if strength_categories:
                    for category in strength_categories:
                        hardness_data = category.get("hardness", [])
                        if hardness_data:
                            for h_data in hardness_data:
                                source_str = h_data.get("property_source", "")
                                sub_source = h_data.get("property_subsource", "")
                                if sub_source: source_str += f" ({sub_source})"
                                self.treeview_data.append({"material_name": mat.get_display_name(), "obj": mat,
                                                           "strength_category": category.get("value_strength_category",
                                                                                             "N/A"),
                                                           "source": source_str or "-", "max_temp": max_app_temp,
                                                           "min_value": h_data.get("min_value", "-"),
                                                           "max_value": h_data.get("max_value", "-"),
                                                           "unit_value": h_data.get("unit_value", "-")})
                        else:
                            self.treeview_data.append({"material_name": mat.get_display_name(), "obj": mat,
                                                       "strength_category": category.get("value_strength_category",
                                                                                         "N/A"), "source": "-",
                                                       "max_temp": max_app_temp, "min_value": "-", "max_value": "-",
                                                       "unit_value": "-"})
                else:
                    self.treeview_data.append(
                        {"material_name": mat.get_display_name(), "obj": mat, "strength_category": "-", "source": "-",
                         "max_temp": max_app_temp, "min_value": "-", "max_value": "-", "unit_value": "-"})
        self._populate_treeview()

    def _populate_treeview(self):
        for i in self.tree_frozen.get_children(): self.tree_frozen.delete(i)
        for i in self.tree_scrollable.get_children(): self.tree_scrollable.delete(i)
        scrollable_cols = self.tree_scrollable["columns"]
        frozen_cols = self.tree_frozen["columns"]
        for row in self.treeview_data:
            frozen_values = [row.get(c, "-") or "-" for c in frozen_cols]
            scrollable_values = [row.get(c, "-") or "-" for c in scrollable_cols]
            self.tree_frozen.insert("", "end", values=frozen_values)
            self.tree_scrollable.insert("", "end", values=scrollable_values)

    def _sort_column(self, col, reverse):
        def get_sort_key(item):
            """
            Возвращает кортеж (type_indicator, value) для 'умной' сортировки.
            - type_indicator: 0 для чисел, 1 для строк.
            - value: само значение для сравнения.
            Это позволяет сначала отсортировать все числа, а потом все строки,
            избегая TypeError.
            """
            value = item.get(col)

            # Прочерки и пустые значения всегда отправляем в конец
            if value is None or value == "-":
                # Используем 2 как индикатор, чтобы они были после чисел и строк
                return (2, None)

            # Пытаемся преобразовать значение в число
            try:
                # Возвращаем кортеж (0, числовое_значение)
                return (0, float(value))
            except (ValueError, TypeError):
                # Если не получилось, считаем это строкой
                # Возвращаем кортеж (1, строковое_значение)
                return (1, str(value).lower())

        # Сортируем данные, используя наш новый ключ
        self.treeview_data.sort(key=get_sort_key, reverse=reverse)

        # Обновляем команду сортировки, чтобы следующий клик инвертировал порядок
        if col in self.tree_frozen['columns']:
            self.tree_frozen.heading(col, command=lambda: self._sort_column(col, not reverse))
        elif col in self.tree_scrollable['columns']:
            self.tree_scrollable.heading(col, command=lambda: self._sort_column(col, not reverse))

        self._populate_treeview()
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---

    def _on_vertical_scroll(self, *args):
        self.tree_frozen.yview(*args)
        self.tree_scrollable.yview(*args)

    def _on_mousewheel(self, event, delta_direction=None):
        delta = delta_direction if delta_direction else (
            -1 * (event.delta // 120) if hasattr(event, 'delta') else (1 if event.num == 5 else -1))
        self.tree_frozen.yview_scroll(delta, "units")
        self.tree_scrollable.yview_scroll(delta, "units")
        return "break"

    def update_comboboxes(self):
        areas = ["Все"] + self.app_data.application_areas
        self.area_combo.config(values=areas)
        if not self.area_combo.get(): self.area_combo.set("Все")
        if not self.prop_type_combo.get(): self.prop_type_combo.set(self.PROP_TYPES[0])
        self._trigger_calculate()

    def _show_context_menu(self, event):
        self.last_clicked_tree = event.widget
        item_id = self.last_clicked_tree.identify_row(event.y)
        if item_id:
            self.last_clicked_tree.focus(item_id)
            self.last_clicked_tree.selection_set(item_id)
        self.context_menu.post(event.x_root, event.y_root)

    def _copy_cell_value(self):
        tree = self.last_clicked_tree
        if not tree or not tree.focus(): return
        item = tree.focus()
        col = tree.identify_column(self.winfo_pointerx() - tree.winfo_rootx())
        col_index = int(col.replace('#', '')) - 1
        try:
            value = tree.item(item, "values")[col_index]
            self.clipboard_clear()
            self.clipboard_append(value)
        except (IndexError, tk.TclError):
            pass


class CustomToolbar(NavigationToolbar2Tk):
    """
    Пользовательская панель инструментов, которая при нажатии 'Home'
    перерисовывает график, вызывая внешнюю функцию.
    """
    def __init__(self, canvas, window, plot_callback):
        super().__init__(canvas, window)
        # Сохраняем ссылку на нашу функцию для построения графика
        self.plot_callback = plot_callback

    def home(self, *args, **kwargs):
        """
        Переопределяем стандартное поведение кнопки 'Home'.
        Вместо сброса вида, мы полностью перерисовываем график.
        """
        # Вызываем нашу функцию, которая всё сделает сама
        self.plot_callback()


class SingleCalculationTab(ttk.Frame):
    """Вкладка для расчета свойств с возможностью конвертации единиц измерения."""

    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data
        self.result_widgets = {}
        self.material_map = {}
        self.unit_combos = {}
        self.base_values = {}  # В этом словаре значения ВСЕГДА хранятся в базовой единице из JSON
        self._setup_widgets()

    def _setup_widgets(self):
        controls_frame = ttk.Frame(self, padding=10)
        controls_frame.pack(fill="x", side="top")

        ttk.Label(controls_frame, text="Область применения:").grid(row=0, column=0, padx=(0, 5), pady=5, sticky="w")
        self.area_combo = ttk.Combobox(controls_frame, state="readonly", width=60)
        self.area_combo.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.area_combo.bind("<<ComboboxSelected>>", self._filter_materials)

        ttk.Label(controls_frame, text="Выбор материала:").grid(row=1, column=0, padx=(0, 5), pady=5, sticky="w")
        self.material_combo = ttk.Combobox(controls_frame, state="readonly", width=60)
        self.material_combo.grid(row=1, column=1, padx=5, pady=5, sticky="w")

        ttk.Label(controls_frame, text="Температура, °С:").grid(row=0, column=2, padx=(20, 5), pady=5, sticky="w")
        self.temp_entry = ttk.Entry(controls_frame, width=10)
        self.temp_entry.grid(row=0, column=3, padx=5, pady=5, sticky="w")
        self.temp_entry.insert(0, "20")

        calc_button = ttk.Button(controls_frame, text="Рассчитать", command=self._on_calculate)
        calc_button.grid(row=0, column=4, padx=10, pady=5)

        reset_button = ttk.Button(controls_frame, text="Сбросить", command=self._on_reset)
        reset_button.grid(row=0, column=5, padx=5, pady=5)

        results_canvas = tk.Canvas(self)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=results_canvas.yview)
        scrollable_frame = ttk.Frame(results_canvas, padding=10)

        scrollable_frame.bind("<Configure>",
                              lambda e: results_canvas.configure(scrollregion=results_canvas.bbox("all")))
        results_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        results_canvas.configure(yscrollcommand=scrollbar.set)

        def on_mousewheel(event):
            results_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        results_canvas.bind("<MouseWheel>", on_mousewheel)
        scrollable_frame.bind("<MouseWheel>", on_mousewheel)

        results_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        scrollable_frame.columnconfigure(1, weight=1)

        row_counter = 0
        for prop_key, prop_info in ALL_PROPERTIES_MAP.items():
            label_text = f"{prop_info['name']} ({prop_info['symbol']}), {prop_info['unit']}"
            ttk.Label(scrollable_frame, text=label_text).grid(row=row_counter, column=0, sticky="w", pady=3, padx=5)

            value_frame = ttk.Frame(scrollable_frame)
            value_frame.grid(row=row_counter, column=1, sticky="w", pady=3, padx=5)

            result_entry = ttk.Entry(value_frame, width=20)
            result_entry.insert(0, "-")
            result_entry.config(state="readonly")
            result_entry.pack(side="left")
            self.result_widgets[prop_key] = result_entry

            unit_combo = ttk.Combobox(value_frame, width=8, state="disabled")
            unit_combo.pack(side="left", padx=(5, 0))
            self.unit_combos[prop_key] = unit_combo

            base_unit = prop_info.get("unit")
            for group in UNIT_CONVERSION_GROUPS.values():
                # Проверяем, есть ли наша базовая единица в списке юнитов группы
                if base_unit in group["units"]:
                    unit_combo.config(values=group["units"], state="readonly")
                    unit_combo.set(base_unit)
                    unit_combo.bind("<<ComboboxSelected>>", lambda e, k=prop_key: self._on_unit_change(k))
                    break
            row_counter += 1

    def _on_unit_change(self, prop_key):
        base_value = self.base_values.get(prop_key)
        if base_value is not None:
            self._display_value(prop_key, base_value)

    # --- ИЗМЕНЕННЫЙ МЕТОД ---
    def _display_value(self, prop_key, base_value):
        """Отображает значение, конвертируя его из базовой единицы в выбранную."""
        widget = self.result_widgets[prop_key]
        unit_combo = self.unit_combos[prop_key]

        display_value = base_value

        if isinstance(base_value, (int, float)):
            target_unit = unit_combo.get()
            # Базовая единица, в которой значение хранится в JSON и в self.base_values
            source_unit = ALL_PROPERTIES_MAP[prop_key].get("unit")

            for group in UNIT_CONVERSION_GROUPS.values():
                if source_unit in group["units"]:
                    # Ищем коэффициент в матрице: [из source_unit][в target_unit]
                    try:
                        factor = group["factors"][source_unit][target_unit]
                        converted_value = base_value * factor
                        display_value = f"{converted_value:.2f}"
                    except KeyError:
                        # Если вдруг нет нужного коэффициента, оставляем как есть
                        display_value = f"{base_value:.2f}"
                    break

        widget.config(state="normal")
        widget.delete(0, tk.END)
        widget.insert(0, str(display_value))
        widget.config(state="readonly")

    # --- КОНЕЦ ИЗМЕНЕНИЙ ---

    def _on_calculate(self):
        selected_display_name = self.material_combo.get()
        if not selected_display_name:
            messagebox.showwarning("Внимание", "Выберите материал для расчета.")
            return

        try:
            temp = float(self.temp_entry.get())
        except ValueError:
            messagebox.showerror("Ошибка", "Температура должна быть числом.")
            return

        material_obj, category_data = self.material_map.get(selected_display_name, (None, None))
        if not material_obj: return

        self.base_values.clear()

        for prop_key in ALL_PROPERTIES_MAP.keys():
            base_value = self.get_property_at_temp(material_obj, category_data, prop_key, temp)

            try:
                numeric_value = float(base_value)
                self.base_values[prop_key] = numeric_value
            except (ValueError, TypeError):
                self.base_values[prop_key] = base_value

            self._display_value(prop_key, self.base_values[prop_key])

    def _on_reset(self):
        self.base_values.clear()
        for prop_key, widget in self.result_widgets.items():
            widget.config(state="normal")
            widget.delete(0, tk.END)
            widget.insert(0, "-")
            widget.config(state="readonly")

            unit_combo = self.unit_combos[prop_key]
            if unit_combo['state'] != 'disabled':
                base_unit = ALL_PROPERTIES_MAP[prop_key].get("unit")
                unit_combo.set(base_unit)

    def update_comboboxes(self):
        areas = ["Все"] + self.app_data.application_areas
        self.area_combo.config(values=areas)
        self.area_combo.set("Все")
        self._filter_materials()
        self._on_reset()

    def _filter_materials(self, event=None):
        selected_area = self.area_combo.get()
        self.material_map.clear()
        display_names = []

        for mat in self.app_data.materials:
            if selected_area != "Все" and selected_area not in mat.data.get("metadata", {}).get("application_area", []):
                continue

            base_name = mat.get_display_name()
            strength_categories = mat.data.get("mechanical_properties", {}).get("strength_category", [])

            if strength_categories:
                for i, cat in enumerate(strength_categories):
                    cat_name = cat.get('value_strength_category', f'КП {i + 1}')
                    display_name = f"{base_name} ({cat_name})"
                    display_names.append(display_name)
                    self.material_map[display_name] = (mat, cat)
            else:
                display_names.append(base_name)
                self.material_map[base_name] = (mat, None)

        self.material_combo.config(values=sorted(display_names))
        if display_names:
            self.material_combo.current(0)
        else:
            self.material_combo.set("")

    def get_property_at_temp(self, material, category_data, prop_key, temp):
        prop_data = None
        is_mechanical = prop_key in MECHANICAL_PROPERTIES_MAP

        if is_mechanical:
            if category_data and prop_key in category_data:
                prop_data = category_data[prop_key]
        else:
            if prop_key in material.data.get("physical_properties", {}):
                prop_data = material.data["physical_properties"][prop_key]

        if not prop_data or "temperature_value_pairs" not in prop_data: return "-"
        pairs = sorted(prop_data["temperature_value_pairs"], key=lambda p: p[0])
        if not pairs: return "-"
        for t, val in pairs:
            if t == temp: return val
        lower_point, upper_point = None, None
        for t, val in pairs:
            if t < temp:
                lower_point = (t, val)
            elif t > temp:
                upper_point = (t, val);
                break
        if lower_point and upper_point:
            t1, v1 = lower_point;
            t2, v2 = upper_point
            if t2 - t1 == 0: return v1
            interpolated_val = v1 + (temp - t1) * (v2 - v1) / (t2 - t1)
            return f"{interpolated_val:.2f}"
        return "-"


class PropertyComparisonTab(ttk.Frame):
    """Вкладка 'Сравнение материалов (свойства)' с новым интерфейсом выбора."""

    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data
        self.listbox_item_map = {}
        self._setup_widgets()

    def _setup_widgets(self):
        main_frame = ttk.Frame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        controls_frame = ttk.Frame(main_frame, width=300)
        controls_frame.pack(side="left", fill="y", padx=(0, 10))
        controls_frame.pack_propagate(False)

        ttk.Label(controls_frame, text="Область применения:").pack(fill="x", pady=(0, 2))
        self.area_combo = ttk.Combobox(controls_frame, state="readonly")
        self.area_combo.pack(fill="x", pady=(0, 10))
        self.area_combo.bind("<<ComboboxSelected>>", self._update_search_pool)

        ttk.Label(controls_frame, text="Свойство для сравнения:").pack(fill="x", pady=(0, 2))
        prop_names = [f"{info['name']} ({info.get('symbol', '')})" for info in ALL_PROPERTIES_MAP.values()]
        self.prop_keys = list(ALL_PROPERTIES_MAP.keys())
        self.prop_combo = ttk.Combobox(controls_frame, state="readonly", values=prop_names)
        self.prop_combo.pack(fill="x", pady=(0, 10))
        if prop_names:
            self.prop_combo.current(0)
        self.prop_combo.bind("<<ComboboxSelected>>", lambda e: self._plot_graph())

        ttk.Label(controls_frame, text="Поиск материала:").pack(fill="x", pady=(5, 2))
        self.search_entry = ttk.Entry(controls_frame)
        self.search_entry.pack(fill="x", pady=(0, 5))
        self.search_entry.bind("<KeyRelease>", self._filter_search_results)

        search_list_frame = ttk.LabelFrame(controls_frame, text="Результаты поиска")
        search_list_frame.pack(fill="both", expand=True, pady=(0, 10))

        self.search_listbox = tk.Listbox(search_list_frame, exportselection=False)
        search_scrollbar = ttk.Scrollbar(search_list_frame, orient="vertical", command=self.search_listbox.yview)
        self.search_listbox.config(yscrollcommand=search_scrollbar.set)
        search_scrollbar.pack(side="right", fill="y")
        self.search_listbox.pack(side="left", fill="both", expand=True)
        self.search_listbox.bind("<Double-1>", self._add_material_to_selection)

        selected_list_frame = ttk.LabelFrame(controls_frame, text="Выбранные материалы")
        selected_list_frame.pack(fill="both", expand=True, pady=(0, 10))

        self.selected_listbox = tk.Listbox(selected_list_frame, exportselection=False)
        selected_scrollbar = ttk.Scrollbar(selected_list_frame, orient="vertical", command=self.selected_listbox.yview)
        self.selected_listbox.config(yscrollcommand=selected_scrollbar.set)
        selected_scrollbar.pack(side="right", fill="y")
        self.selected_listbox.pack(side="left", fill="both", expand=True)
        self.selected_listbox.bind("<Double-1>", self._remove_material_from_selection)

        plot_button = ttk.Button(controls_frame, text="Построить график", command=self._plot_graph)
        plot_button.pack(fill="x", pady=(0, 5))

        reset_button = ttk.Button(controls_frame, text="Сбросить", command=self._reset_selection)
        reset_button.pack(fill="x")

        self.plot_frame = ttk.Frame(main_frame)
        self.plot_frame.pack(side="right", fill="both", expand=True)
        fig = Figure(figsize=(8, 6), dpi=100)
        self.ax = fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(fig, master=self.plot_frame)
        toolbar = CustomToolbar(self.canvas, self.plot_frame, plot_callback=self._plot_graph)
        toolbar.update()
        self.canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    def update_lists(self):
        """Вызывается при загрузке данных. Обновляет фильтры и пулы данных."""
        areas = ["Все"] + self.app_data.application_areas
        self.area_combo.config(values=areas)
        self.area_combo.set("Все")
        self._update_search_pool()

    def _update_search_pool(self, event=None):
        """Обновляет `listbox_item_map`, который является источником для поиска."""
        self.listbox_item_map.clear()
        selected_area = self.area_combo.get()

        for mat in self.app_data.materials:
            if selected_area != "Все" and selected_area not in mat.data.get("metadata", {}, ).get("application_area",
                                                                                                  []):
                continue

            display_name = mat.get_display_name()
            # Добавляем сам материал (для физ. свойств)
            self.listbox_item_map[display_name] = (mat.data, None)

            # Добавляем категории прочности
            for cat in mat.data.get("mechanical_properties", {}).get("strength_category", []):
                cat_name = cat.get('value_strength_category', '')
                display_name_with_cat = f"{display_name} {cat_name}".strip()
                self.listbox_item_map[display_name_with_cat] = (mat.data, cat.copy())

        self._filter_search_results()

    def _filter_search_results(self, event=None):
        """Фильтрует список `search_listbox` на основе текста в `search_entry`."""
        search_term = self.search_entry.get().lower()
        self.search_listbox.delete(0, tk.END)

        sorted_keys = sorted(self.listbox_item_map.keys())

        for name in sorted_keys:
            if search_term in name.lower():
                self.search_listbox.insert(tk.END, name)

    def _add_material_to_selection(self, event):
        """Добавляет материал из списка поиска в список выбранных."""
        selected_indices = self.search_listbox.curselection()
        if not selected_indices: return

        name_to_add = self.search_listbox.get(selected_indices[0])
        current_selected = self.selected_listbox.get(0, tk.END)

        if name_to_add not in current_selected:
            self.selected_listbox.insert(tk.END, name_to_add)

    def _remove_material_from_selection(self, event):
        """Удаляет материал из списка выбранных."""
        selected_indices = self.selected_listbox.curselection()
        if not selected_indices: return

        self.selected_listbox.delete(selected_indices[0])

    def _reset_selection(self):
        """Сбрасывает список выбранных материалов и график."""
        self.selected_listbox.delete(0, tk.END)
        self.search_entry.delete(0, tk.END)
        self._filter_search_results()
        self._plot_graph()

    def _add_minor_gridlines(self):
        # Эта функция остается без изменений
        x_ticks = self.ax.get_xticks()
        if len(x_ticks) > 1:
            for i in range(len(x_ticks) - 1):
                mid_point = (x_ticks[i] + x_ticks[i + 1]) / 2
                self.ax.axvline(x=mid_point, color='grey', linestyle='--', linewidth=0.5, alpha=0.7)
        y_ticks = self.ax.get_yticks()
        if len(y_ticks) > 1:
            for i in range(len(y_ticks) - 1):
                mid_point = (y_ticks[i] + y_ticks[i + 1]) / 2
                self.ax.axhline(y=mid_point, color='grey', linestyle='--', linewidth=0.5, alpha=0.7)

    def _plot_graph(self):
        """Строит график на основе списка `selected_listbox`."""
        prop_idx = self.prop_combo.current()
        if prop_idx == -1:
            messagebox.showwarning("Внимание", "Выберите свойство для отображения.")
            return

        prop_key = self.prop_keys[prop_idx]
        prop_info = ALL_PROPERTIES_MAP.get(prop_key)
        if not prop_info: return

        self.ax.clear()

        selected_names = self.selected_listbox.get(0, tk.END)
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22',
                  '#17becf']

        for i, display_name in enumerate(selected_names):
            color = colors[i % len(colors)]
            material_data, category_data = self.listbox_item_map.get(display_name, (None, None))

            if not material_data: continue

            prop_data = None

            # --- НАЧАЛО ИСПРАВЛЕННОЙ ЛОГИКИ ---
            is_mechanical = prop_key in MECHANICAL_PROPERTIES_MAP

            if is_mechanical:
                # Если свойство механическое, ищем его ТОЛЬКО в категории
                if category_data and prop_key in category_data:
                    prop_data = category_data[prop_key]
            else:
                # Если свойство физическое, ищем его в ОБЩИХ данных материала
                if prop_key in material_data.get("physical_properties", {}):
                    prop_data = material_data["physical_properties"][prop_key]
            # --- КОНЕЦ ИСПРАВЛЕННОЙ ЛОГИКИ ---

            if prop_data and "temperature_value_pairs" in prop_data and prop_data["temperature_value_pairs"]:
                pairs = sorted(prop_data["temperature_value_pairs"], key=lambda p: p[0])
                temps = [p[0] for p in pairs]
                values = [p[1] for p in pairs]
                self.ax.plot(temps, values, marker='o', linestyle='-', label=display_name, color=color)
                for t, v in zip(temps, values):
                    text_label = f"{v:.0f}" if v == int(v) else f"{v:.1f}"
                    self.ax.annotate(text_label, xy=(t, v), xytext=(5, 5), textcoords='offset points', fontsize=8,
                                     color='dimgray')
            else:
                self.ax.plot([], [], marker='o', linestyle='-', label=f"{display_name} (нет данных)", color=color)

        self.ax.set_xlabel("Температура [°С]")
        self.ax.set_ylabel(f"{prop_info['name']} [{prop_info['unit']}]")
        self.ax.set_title(f"Зависимость свойства '{prop_info['name']}' от температуры")

        if selected_names:
            self.ax.legend()

        self.ax.grid(True)
        self._add_minor_gridlines()
        self.canvas.draw()


class ChemComparisonTab(ttk.Frame):
    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data

        # Словарь с подсказками не меняется
        self.element_tooltips = {
            "C": "Углерод.\nПовышает: Твердость, прочность, упругость.\nСнижает: Пластичность, вязкость.",
            "Si": "Кремний.\nПовышает: Прочность, упругость, электросопротивление, жаростойкость, твердость.\nСнижает: -.",
            "P": "Фосфор.\nПовышает: Прочность, коррозионная стойкость.\nСнижает: Пластичность, вязкость",
            "S": "Сера.\nПовышает: Хрупкость при высоких температурах. \nСнижает: Прочность, пластичность, свариваемость, коррозионная стойкость",
            "N2": "Азот.\nПовышает: -. \nСнижает: Вязкость, пластичность.",
            "O2": "Кислород.\nПовышает: -. \nСнижает: Вязкость, пластичность.",
            "H2": "Водород.\nПовышает: Хрупкость. \nСнижает: -.",
            "Cr": "Хром.\nПовышает: Твердость, прочность, ударная вязкость, коррозионная стойкость, электросопротивление. \nСнижает: Коэффициент линейного расширения, пластичность.",
            "Ni": "Никель.\nПовышает: Пластичность, вязкость, коррозионная стойкость, ударная прочность. \nСнижает: -.",
            "W": "Вольфрам.\nПовышает: Твердость, прокаливаемость. \nСнижает: -.",
            "Mo": "Молибден.\nПовышает: Упругость, коррозионная стойкость, сопротивляемость растягивающим нагрузкам, прокаливаемость.  \nСнижает: -.",
            "V": "Ванадий.\nПовышает: Прочность, твердость, плотность. \nСнижает: -.",
            "Mn": "Марганец.\nПовышает: Твердость, износоустойчивость, ударная вязкость, прокаливаемость. \nСнижает: -.",
            "Co": "Кобальт.\nПовышает: Ударная прочность, жаропрочность, магнитные свойства. \nСнижает: -.",
            "Al": "Алюминий.\nПовышает: Жаростойкость, окалиностойкость. \nСнижает: -.",
            "Ti": "Титан.\nПовышает: Прочность, коррозионная стойкость, обрабатываемость. \nСнижает: -.",
            "Nb": "Ниобий.\nПовышает: Коррозионная стойкость, устойчивость к кислотам. \nСнижает: -.",
            "Cu": "Медь.\nПовышает: Коррозионная стойкость, пластичность. \nСнижает: -.",
            "Ce": "Церий.\nПовышает: Пластичность, прочность. \nСнижает: -.",
            "Nd": "Неодим.\nПовышает: Качество поверхности. \nСнижает: Пористость.",
            "Cs": "Цезий.\nПовышает: Качество поверхности. \nСнижает: Пористость.",
            "La": "Лантан.\nПовышает: Качество поверхности. \nСнижает: Пористость.",
            "Sb": "Сурьма.\nПовышает: Отпускную хрупкость. \nСнижает: Качество поверхности литья."
        }

        self.filter_entries = {}
        self.all_composition_data = []
        self.sorted_elements = []

        self._setup_widgets()

    def _setup_widgets(self):
        main_frame = ttk.Frame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # --- Левая панель управления ---
        controls_frame = ttk.Frame(main_frame, width=250)
        controls_frame.pack(side="left", fill="y", padx=(0, 10))
        controls_frame.pack_propagate(False)

        ttk.Label(controls_frame, text="Область применения:").pack(fill="x", pady=(0, 2))
        self.area_combo = ttk.Combobox(controls_frame, state="readonly")
        self.area_combo.pack(fill="x", pady=(0, 10))
        # Привязываем к новому общему методу обновления
        self.area_combo.bind("<<ComboboxSelected>>", self._update_material_listbox)

        # --- НАЧАЛО ИЗМЕНЕНИЙ 2: Поле поиска ---
        ttk.Label(controls_frame, text="Поиск материала:").pack(fill="x", pady=(0, 2))
        self.search_entry = ttk.Entry(controls_frame)
        self.search_entry.pack(fill="x", pady=(0, 10))
        # Привязываем к новому общему методу обновления
        self.search_entry.bind("<KeyRelease>", self._update_material_listbox)
        # --- КОНЕЦ ИЗМЕНЕНИЙ 2 ---

        ttk.Label(controls_frame, text="Выберите материалы:").pack(fill="x", pady=(0, 2))
        list_frame = ttk.Frame(controls_frame)
        list_frame.pack(fill="both", expand=True, pady=(0, 10))
        self.mat_listbox = tk.Listbox(list_frame, selectmode=tk.MULTIPLE, exportselection=False)
        list_scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.mat_listbox.yview)
        self.mat_listbox.config(yscrollcommand=list_scrollbar.set)
        list_scrollbar.pack(side="right", fill="y")
        self.mat_listbox.pack(side="left", fill="both", expand=True)
        # Этот биндинг остается, чтобы работало ручное выделение
        self.mat_listbox.bind("<<ListboxSelect>>", self._setup_comparison_view)

        # --- Правая панель для результатов ---
        results_area_frame = ttk.Frame(main_frame)
        results_area_frame.pack(side="right", fill="both", expand=True)
        self.filter_frame = ttk.LabelFrame(results_area_frame, text="Фильтры по элементам (%)", padding=10)
        self.filter_frame.pack(fill="x", pady=(0, 10))

        # Контейнер для прокрутки результатов
        scrollable_container = ttk.Frame(results_area_frame)
        scrollable_container.pack(fill="both", expand=True)
        scrollable_container.grid_rowconfigure(0, weight=1)
        scrollable_container.grid_columnconfigure(0, weight=1)
        self.canvas = tk.Canvas(scrollable_container)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        vsb = ttk.Scrollbar(scrollable_container, orient="vertical", command=self.canvas.yview)
        vsb.grid(row=0, column=1, sticky="ns")
        hsb = ttk.Scrollbar(scrollable_container, orient="horizontal", command=self.canvas.xview)
        hsb.grid(row=1, column=0, sticky="ew")
        self.canvas.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self.results_grid_frame = ttk.Frame(self.canvas)
        self.canvas.create_window((0, 0), window=self.results_grid_frame, anchor="nw")
        self.results_grid_frame.bind("<Configure>",
                                     lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))

        for widget in (self.canvas, self.results_grid_frame):
            widget.bind("<MouseWheel>", self._on_mousewheel)
            widget.bind("<Button-4>", self._on_mousewheel)
            widget.bind("<Button-5>", self._on_mousewheel)

    def _reset_element_filters(self):
        """Очищает все поля фильтров по элементам и обновляет таблицу."""
        for entry in self.filter_entries.values():
            entry.delete(0, tk.END)
        # После очистки полей, нужно заново применить фильтры (теперь пустые)
        self._apply_filters_and_resort()

    def update_lists(self):
        self.area_combo.config(values=["Все"] + getattr(self.app_data, 'application_areas', []))
        self.area_combo.set("Все")
        # Очищаем поле поиска при полной перезагрузке
        self.search_entry.delete(0, tk.END)
        # Вызываем новый общий метод обновления
        self._update_material_listbox()

    def _update_material_listbox(self, event=None):
        """Обновляет список материалов на основе области и поиска, и автоматически выделяет."""
        self.mat_listbox.delete(0, tk.END)

        selected_area = self.area_combo.get()
        search_term = self.search_entry.get().lower()

        # Фильтруем материалы
        for mat in self.app_data.materials:
            # Проверка на наличие хим. состава
            if not mat.data.get("chemical_properties", {}).get("composition"):
                continue

            # Фильтр по области применения
            if selected_area != "Все" and selected_area not in mat.data.get("metadata", {}).get("application_area", []):
                continue

            # Фильтр по поиску
            display_name = mat.get_display_name()
            if search_term and search_term not in display_name.lower():
                continue

            self.mat_listbox.insert(tk.END, display_name)

        # --- НАЧАЛО ИЗМЕНЕНИЙ 1: Авто-выделение ---
        # Если выбрана конкретная область применения (и нет поискового запроса), выделяем все
        if selected_area != "Все" and not search_term:
            self.mat_listbox.selection_set(0, tk.END)
        # --- КОНЕЦ ИЗМЕНЕНИЙ 1 ---

        # Обновляем правую часть (таблицу сравнения)
        self._setup_comparison_view()

    # Метод _filter_materials больше не нужен, его логика переехала в _update_material_listbox

    def _setup_comparison_view(self, event=None):
        saved_filter_values = {elem: entry.get() for elem, entry in self.filter_entries.items() if entry.get()}

        # Очищаем старые виджеты
        for widget in self.filter_frame.winfo_children(): widget.destroy()
        for widget in self.results_grid_frame.winfo_children(): widget.destroy()
        self.filter_entries.clear()
        self.all_composition_data.clear()

        # Собираем данные по ВЫБРАННЫМ материалам
        selected_indices = self.mat_listbox.curselection()
        selected_names = {self.mat_listbox.get(i) for i in selected_indices}
        selected_mats = [m for m in self.app_data.materials if m.get_display_name() in selected_names]

        if not selected_mats: return

        all_elements = set()
        for mat in selected_mats:
            for comp in mat.data.get("chemical_properties", {}).get("composition", []):
                elements_map = {elem['element']: elem for elem in comp.get("other_elements", [])}
                self.all_composition_data.append({
                    "material_name": mat.get_display_name(),
                    "source": comp.get("composition_source", "") + (
                        f' ({comp.get("composition_subsource")})' if comp.get("composition_subsource") else ""),
                    "base_element": comp.get("base_element", "-"),
                    "elements_map": elements_map
                })
                all_elements.update(elements_map.keys())

        if not all_elements: return

        self.sorted_elements = sorted(list(all_elements))

        # Динамически создаем поля для фильтров
        col = 0
        for elem in self.sorted_elements:
            frame = ttk.Frame(self.filter_frame)
            frame.grid(row=0, column=col, padx=5, pady=2, sticky='w')
            ttk.Label(frame, text=elem).pack(side="left")
            entry = ttk.Entry(frame, width=6)
            entry.pack(side="left", padx=(2, 0))
            entry.bind("<KeyRelease>", self._apply_filters_and_resort)
            self.filter_entries[elem] = entry
            if elem in saved_filter_values:
                entry.insert(0, saved_filter_values[elem])
            col += 1

        # --- НАЧАЛО ИЗМЕНЕНИЙ 3: Кнопка сброса ---
        reset_button = ttk.Button(self.filter_frame, text="Сбросить", command=self._reset_element_filters)
        # Размещаем кнопку в следующей строке, чтобы она была под фильтрами
        reset_button.grid(row=1, column=0, columnspan=col or 1, pady=(10, 0), sticky='w')
        # --- КОНЕЦ ИЗМЕНЕНИЙ 3 ---

        self._apply_filters_and_resort()

    # Остальные методы (_on_mousewheel, _format_chem_value, _apply_filters_and_resort, _populate_results_grid)
    # остаются без изменений. Копируем их как есть.

    def _on_mousewheel(self, event):
        if event.num == 4 or event.delta > 0:
            self.canvas.yview_scroll(-1, "units")
        elif event.num == 5 or event.delta < 0:
            self.canvas.yview_scroll(1, "units")

    def _format_chem_value(self, elem_data):
        if not elem_data: return "-"
        min_v = elem_data.get("min_value")
        max_v = elem_data.get("max_value")
        min_tol = elem_data.get("min_value_tolerance")
        max_tol = elem_data.get("max_value_tolerance")
        if min_v == 0: min_v = None
        if max_v == 0: max_v = None
        if min_v is not None and max_v is not None:
            min_tol_str = f"({min_tol}) " if min_tol not in (None, '') else ""
            max_tol_str = f" ({max_tol})" if max_tol not in (None, '') else ""
            return f"{min_tol_str}{min_v} - {max_v}{max_tol_str}"
        elif max_v is not None:
            max_tol_str = f" ({max_tol})" if max_tol not in (None, '') else ""
            return f"≤ {max_v}{max_tol_str}"
        elif min_v is not None:
            min_tol_str = f" ({min_tol})" if min_tol not in (None, '') else ""
            return f"≥ {min_v}{min_tol_str}"
        else:
            return "-"

    def _apply_filters_and_resort(self, event=None):
        targets = {}
        for elem, entry in self.filter_entries.items():
            val_str = entry.get().strip()
            if val_str:
                try:
                    targets[elem] = float(val_str)
                except ValueError:
                    targets[elem] = None
        processed_data = []
        for comp_data in self.all_composition_data:
            score, cell_colors, is_fully_matching = 0, {}, True
            for elem, target_val in targets.items():
                if target_val is None: continue
                elem_info = comp_data["elements_map"].get(elem)
                if not elem_info:
                    is_fully_matching = False
                    cell_colors[elem] = "light coral"
                    continue
                min_v, max_v = elem_info.get("min_value"), elem_info.get("max_value")
                min_tol_str, max_tol_str = elem_info.get("min_value_tolerance"), elem_info.get("max_value_tolerance")
                lower_bound = float('-inf') if min_v is None else min_v
                if min_tol_str not in (None, ''):
                    try:
                        lower_bound = float(min_tol_str)
                    except (ValueError, TypeError):
                        pass
                upper_bound = float('inf') if max_v is None else max_v
                if max_tol_str not in (None, ''):
                    try:
                        upper_bound = float(max_tol_str)
                    except (ValueError, TypeError):
                        pass
                if lower_bound <= target_val <= upper_bound:
                    score += 1
                    cell_colors[elem] = "pale green"
                else:
                    is_fully_matching = False
                    cell_colors[elem] = "light coral"
            comp_data['is_match'], comp_data['score'], comp_data[
                'cell_colors'] = is_fully_matching, score if is_fully_matching else -1, cell_colors
            processed_data.append(comp_data)
        processed_data.sort(key=lambda x: (x.get('is_match', False), x.get('score', 0)), reverse=True)
        self._populate_results_grid(processed_data)

    def _populate_results_grid(self, data_to_show):
        for widget in self.results_grid_frame.winfo_children(): widget.destroy()
        headers = ["Материал", "Источник", "Основа"] + self.sorted_elements
        header_widths = [150, 200, 60] + [100] * len(self.sorted_elements)
        for col, text in enumerate(headers):
            self.results_grid_frame.columnconfigure(col, minsize=header_widths[col])
            label = ttk.Label(self.results_grid_frame, text=text, font=("TkDefaultFont", 9, "bold"), anchor="center",
                              relief="groove", padding=5)
            label.grid(row=0, column=col, sticky="nsew")
            if text in self.element_tooltips: Tooltip(label, self.element_tooltips[text])
        for row, comp_data in enumerate(data_to_show, start=1):
            row_bg_color = "honeydew" if comp_data.get('is_match', True) else "misty rose"
            l1 = tk.Label(self.results_grid_frame, text=comp_data["material_name"], relief="groove", padx=5, pady=5,
                          background=row_bg_color)
            l1.grid(row=row, column=0, sticky="nsew");
            l1.bind("<MouseWheel>", self._on_mousewheel);
            l1.bind("<Button-4>", self._on_mousewheel);
            l1.bind("<Button-5>", self._on_mousewheel)
            l2 = tk.Label(self.results_grid_frame, text=comp_data["source"], relief="groove", padx=5, pady=5,
                          background=row_bg_color)
            l2.grid(row=row, column=1, sticky="nsew");
            l2.bind("<MouseWheel>", self._on_mousewheel);
            l2.bind("<Button-4>", self._on_mousewheel);
            l2.bind("<Button-5>", self._on_mousewheel)
            l3 = tk.Label(self.results_grid_frame, text=comp_data["base_element"], anchor="center", relief="groove",
                          padx=5, pady=5, background=row_bg_color)
            l3.grid(row=row, column=2, sticky="nsew");
            l3.bind("<MouseWheel>", self._on_mousewheel);
            l3.bind("<Button-4>", self._on_mousewheel);
            l3.bind("<Button-5>", self._on_mousewheel)
            for col, elem_name in enumerate(self.sorted_elements, start=3):
                elem_info = comp_data["elements_map"].get(elem_name)
                text_val = self._format_chem_value(elem_info)
                cell_bg_color = comp_data.get("cell_colors", {}).get(elem_name, row_bg_color)
                cell = tk.Label(self.results_grid_frame, text=text_val, background=cell_bg_color, relief="groove",
                                padx=5, pady=5)
                cell.grid(row=row, column=col, sticky="nsew")
                cell.bind("<MouseWheel>", self._on_mousewheel);
                cell.bind("<Button-4>", self._on_mousewheel);
                cell.bind("<Button-5>", self._on_mousewheel)


class AshbyDiagramTab(ttk.Frame):
    """Вкладка для построения гибких диаграмм Эшби с новым интерфейсом выбора."""

    def __init__(self, parent, app_data):
        super().__init__(parent)
        self.app_data = app_data
        self.listbox_item_map = {}

        self.ashby_properties_map = {
            "temperature": {"name": "Температура", "symbol": "T", "unit": "°С"},
            **ALL_PROPERTIES_MAP
        }
        self.ashby_prop_keys = list(self.ashby_properties_map.keys())
        self.ashby_prop_names = [f"{info['name']} ({info.get('symbol', '')})" for info in
                                 self.ashby_properties_map.values()]

        self._setup_widgets()

    def _setup_widgets(self):
        main_frame = ttk.Frame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        controls_frame = ttk.Frame(main_frame, width=300)
        controls_frame.pack(side="left", fill="y", padx=(0, 10))
        controls_frame.pack_propagate(False)

        ttk.Label(controls_frame, text="Область применения:").pack(fill="x", pady=(0, 2))
        self.area_combo = ttk.Combobox(controls_frame, state="readonly")
        self.area_combo.pack(fill="x", pady=(0, 10))
        self.area_combo.bind("<<ComboboxSelected>>", self._update_search_pool)

        ttk.Label(controls_frame, text="Ось X:").pack(fill="x", pady=(5, 2))
        self.x_axis_combo = ttk.Combobox(controls_frame, state="readonly", values=self.ashby_prop_names)
        self.x_axis_combo.pack(fill="x", pady=(0, 5))
        self.x_axis_combo.bind("<<ComboboxSelected>>", self._on_axis_change)

        ttk.Label(controls_frame, text="Ось Y:").pack(fill="x", pady=(5, 2))
        self.y_axis_combo = ttk.Combobox(controls_frame, state="readonly", values=self.ashby_prop_names)
        self.y_axis_combo.pack(fill="x", pady=(0, 10))
        self.y_axis_combo.bind("<<ComboboxSelected>>", self._on_axis_change)

        ttk.Label(controls_frame, text="Поиск материала:").pack(fill="x", pady=(5, 2))
        self.search_entry = ttk.Entry(controls_frame)
        self.search_entry.pack(fill="x", pady=(0, 5))
        self.search_entry.bind("<KeyRelease>", self._filter_search_results)

        search_list_frame = ttk.LabelFrame(controls_frame, text="Результаты поиска")
        search_list_frame.pack(fill="both", expand=True, pady=(0, 10))
        self.search_listbox = tk.Listbox(search_list_frame, exportselection=False)
        search_scrollbar = ttk.Scrollbar(search_list_frame, orient="vertical", command=self.search_listbox.yview)
        self.search_listbox.config(yscrollcommand=search_scrollbar.set)
        search_scrollbar.pack(side="right", fill="y")
        self.search_listbox.pack(side="left", fill="both", expand=True)
        self.search_listbox.bind("<Double-1>", self._add_material_to_selection)

        selected_list_frame = ttk.LabelFrame(controls_frame, text="Выбранные материалы")
        selected_list_frame.pack(fill="both", expand=True, pady=(0, 10))
        self.selected_listbox = tk.Listbox(selected_list_frame, exportselection=False)
        selected_scrollbar = ttk.Scrollbar(selected_list_frame, orient="vertical", command=self.selected_listbox.yview)
        self.selected_listbox.config(yscrollcommand=selected_scrollbar.set)
        selected_scrollbar.pack(side="right", fill="y")
        self.selected_listbox.pack(side="left", fill="both", expand=True)
        self.selected_listbox.bind("<Double-1>", self._remove_material_from_selection)

        plot_button = ttk.Button(controls_frame, text="Построить диаграмму", command=self._plot_diagram)
        plot_button.pack(fill="x", pady=(0, 5))

        reset_button = ttk.Button(controls_frame, text="Сбросить", command=self._reset_selection)
        reset_button.pack(fill="x")

        self.plot_frame = ttk.Frame(main_frame)
        self.plot_frame.pack(side="right", fill="both", expand=True)
        fig = Figure(figsize=(8, 6), dpi=100)
        self.ax = fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(fig, master=self.plot_frame)
        toolbar = NavigationToolbar2Tk(self.canvas, self.plot_frame)
        toolbar.update()
        self.canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        self.x_axis_combo.set("Предел текучести (σ_0,2)")
        self.y_axis_combo.set("Температура (T)")
        self._on_axis_change()

    def update_lists(self):
        areas = ["Все"] + self.app_data.application_areas
        self.area_combo.config(values=areas)
        self.area_combo.set("Все")
        self._update_search_pool()

    def _update_search_pool(self, event=None):
        self.listbox_item_map.clear()
        selected_area = self.area_combo.get()
        for mat in self.app_data.materials:
            if selected_area != "Все" and selected_area not in mat.data.get("metadata", {}).get("application_area", []):
                continue
            display_name = mat.get_display_name()
            self.listbox_item_map[display_name] = (mat.data, None)
            for cat in mat.data.get("mechanical_properties", {}).get("strength_category", []):
                cat_name = cat.get('value_strength_category', '')
                display_name_with_cat = f"{display_name} {cat_name}".strip()
                self.listbox_item_map[display_name_with_cat] = (mat.data, cat.copy())
        self._filter_search_results()

    def _filter_search_results(self, event=None):
        search_term = self.search_entry.get().lower()
        self.search_listbox.delete(0, tk.END)
        for name in sorted(self.listbox_item_map.keys()):
            if search_term in name.lower():
                self.search_listbox.insert(tk.END, name)

    def _add_material_to_selection(self, event):
        selected_indices = self.search_listbox.curselection()
        if not selected_indices: return
        name_to_add = self.search_listbox.get(selected_indices[0])
        if name_to_add not in self.selected_listbox.get(0, tk.END):
            self.selected_listbox.insert(tk.END, name_to_add)

    def _remove_material_from_selection(self, event):
        selected_indices = self.selected_listbox.curselection()
        if not selected_indices: return
        self.selected_listbox.delete(selected_indices[0])

    def _reset_selection(self):
        self.selected_listbox.delete(0, tk.END)
        self._plot_diagram()

    def _on_axis_change(self, event=None):
        x_selection = self.x_axis_combo.get()
        y_selection = self.y_axis_combo.get()
        if x_selection:
            self.y_axis_combo['values'] = [name for name in self.ashby_prop_names if name != x_selection]
        if y_selection:
            self.x_axis_combo['values'] = [name for name in self.ashby_prop_names if name != y_selection]
        if x_selection: self.x_axis_combo.set(x_selection)
        if y_selection: self.y_axis_combo.set(y_selection)
        self._plot_diagram()

    def _plot_diagram(self):
        x_selection_text = self.x_axis_combo.get()
        y_selection_text = self.y_axis_combo.get()
        if not x_selection_text or not y_selection_text: return

        x_prop_key = self.ashby_prop_keys[self.ashby_prop_names.index(x_selection_text)]
        y_prop_key = self.ashby_prop_keys[self.ashby_prop_names.index(y_selection_text)]
        x_prop_info = self.ashby_properties_map[x_prop_key]
        y_prop_info = self.ashby_properties_map[y_prop_key]

        self.ax.clear()
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22',
                  '#17becf']
        selected_display_names = self.selected_listbox.get(0, tk.END)

        for i, display_name in enumerate(selected_display_names):
            color = colors[i % len(colors)]
            material_data, category_data = self.listbox_item_map.get(display_name, (None, None))

            if not material_data: continue

            # --- НАЧАЛО ИСПРАВЛЕННОЙ ЛОГИКИ ---
            def get_axis_values(axis_prop_key, material_data, category_data):
                """Универсальная функция для получения значений для любой оси."""

                # Определяем, какое свойство является источником температурных точек.
                # Если на другой оси температура, то источником будет текущее свойство.
                # Если на другой оси тоже свойство, то каждое свойство - источник само для себя.
                other_axis_prop_key = x_prop_key if axis_prop_key == y_prop_key else y_prop_key
                source_prop_key = axis_prop_key if axis_prop_key != 'temperature' else other_axis_prop_key

                is_source_mechanical = source_prop_key in MECHANICAL_PROPERTIES_MAP

                prop_data_source = None
                if is_source_mechanical:
                    # Ищем источник данных в категории
                    if category_data and source_prop_key in category_data:
                        prop_data_source = category_data[source_prop_key]
                else:
                    # Ищем источник данных в физ.свойствах
                    if source_prop_key in material_data.get("physical_properties", {}):
                        prop_data_source = material_data["physical_properties"][source_prop_key]

                # Если источник данных для температур не найден, выходим
                if not prop_data_source or "temperature_value_pairs" not in prop_data_source or not prop_data_source[
                    "temperature_value_pairs"]:
                    return None

                # Теперь получаем значения для самой оси
                if axis_prop_key == 'temperature':
                    return [p[0] for p in prop_data_source["temperature_value_pairs"]]
                else:
                    is_axis_mechanical = axis_prop_key in MECHANICAL_PROPERTIES_MAP
                    prop_data_axis = None
                    if is_axis_mechanical:
                        if category_data and axis_prop_key in category_data:
                            prop_data_axis = category_data[axis_prop_key]
                    else:
                        if axis_prop_key in material_data.get("physical_properties", {}):
                            prop_data_axis = material_data["physical_properties"][axis_prop_key]

                    if prop_data_axis and "temperature_value_pairs" in prop_data_axis and prop_data_axis[
                        "temperature_value_pairs"]:
                        return [p[1] for p in prop_data_axis["temperature_value_pairs"]]

                return None

            x_values = get_axis_values(x_prop_key, material_data, category_data)
            y_values = get_axis_values(y_prop_key, material_data, category_data)

            if x_values and y_values:
                # Данные есть, строим эллипс
                min_x, max_x = min(x_values), max(x_values)
                min_y, max_y = min(y_values), max(y_values)
                width, height = max_x - min_x, max_y - min_y
                center_x, center_y = min_x + width / 2, min_y + height / 2

                ellipse = Ellipse(xy=(center_x, center_y),
                                  width=width if width > 0 else 0.1,
                                  height=height if height > 0 else 0.1,
                                  angle=0, facecolor=color, alpha=0.4, label=display_name)
                self.ax.add_patch(ellipse)
                self.ax.text(center_x, center_y, display_name, ha='center', va='center', fontsize=8,
                             bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.6))
            else:
                # Данных нет, добавляем "пустышку" в легенду
                self.ax.plot([], [], marker='o', linestyle='-', label=f"{display_name} (нет данных)", color=color)
            # --- КОНЕЦ ИСПРАВЛЕННОЙ ЛОГИКИ ---

        self.ax.set_xlabel(f"{x_prop_info['name']} [{x_prop_info['unit']}]")
        self.ax.set_ylabel(f"{y_prop_info['name']} [{y_prop_info['unit']}]")
        self.ax.set_title(f"Диаграмма Эшби: {y_prop_info['name']} vs. {x_prop_info['name']}")

        if selected_display_names:
            self.ax.legend(fontsize='small')

        self.ax.grid(True, linestyle='--', alpha=0.7)
        if self.ax.patches:
            self.ax.autoscale_view()
        self.canvas.draw()


# --- Классы для вкладки "Редактор" ---
class EditorFrame(ttk.Frame):
    def __init__(self, parent, app_data, main_app):
        super().__init__(parent)
        self.app_data = app_data
        self.main_app = main_app
        self.editing_copy = None
        self._setup_widgets()
        # Изначально кнопки выключены
        self._update_button_states(False)

    def _setup_widgets(self):
        # --- Верхняя панель управления ---
        top_frame = ttk.Frame(self)
        top_frame.pack(fill="x", padx=10, pady=10)

        ttk.Label(top_frame, text="Выберите материал:").pack(side="left")
        self.mat_combo = ttk.Combobox(top_frame, state="readonly", width=40)
        self.mat_combo.pack(side="left", padx=5)
        self.mat_combo.bind("<<ComboboxSelected>>", self.load_material)

        new_button = ttk.Button(top_frame, text="Создать новый", command=self.create_new_material)
        new_button.pack(side="left", padx=(10, 5))

        # --- НАЧАЛО ИЗМЕНЕНИЙ: Новые кнопки ---
        self.save_button = ttk.Button(top_frame, text="Сохранить", command=self.save_material)
        self.save_button.pack(side="left", padx=5)

        self.save_as_button = ttk.Button(top_frame, text="Сохранить как...", command=self.save_material_as)
        self.save_as_button.pack(side="left", padx=5)

        self.revert_button = ttk.Button(top_frame, text="Отменить изменения", command=self.revert_changes)
        self.revert_button.pack(side="left", padx=5)
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---

        # --- Notebook для вкладок редактора ---
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=(0, 10))

        self.general_tab = GeneralDataTab(self.notebook, self.app_data)
        self.phys_tab = PropertyEditorTab(self.notebook, "physical_properties", PHYSICAL_PROPERTIES_MAP)
        self.mech_tab = MechanicalPropertiesTab(self.notebook)
        self.chem_tab = ChemicalCompositionTab(self.notebook)

        self.notebook.add(self.general_tab, text="Общие данные", state="disabled")
        self.notebook.add(self.phys_tab, text="Физические свойства", state="disabled")
        self.notebook.add(self.mech_tab, text="Механические свойства", state="disabled")
        self.notebook.add(self.chem_tab, text="Химический состав", state="disabled")

    # --- НОВЫЙ МЕТОД: Управление состоянием кнопок ---
    def _update_button_states(self, active=False):
        state = "normal" if active else "disabled"
        self.save_button.config(state=state)
        self.save_as_button.config(state=state)
        self.revert_button.config(state=state)

    def update_view(self):
        mat_names = [m.get_display_name() for m in self.app_data.materials]
        self.mat_combo.config(values=mat_names)

        if self.editing_copy and self.editing_copy.get_display_name() in mat_names:
            self.mat_combo.set(self.editing_copy.get_display_name())
        else:
            self.editing_copy = None
            self.app_data.current_material = None
            self.mat_combo.set("")
            self._set_tabs_state("disabled")
            self._update_button_states(False)  # Выключаем кнопки

    def load_material(self, event=None):
        selected_name = self.mat_combo.get()
        material = next((m for m in self.app_data.materials if m.get_display_name() == selected_name), None)
        if material:
            self.app_data.current_material = material
            self.editing_copy = copy.deepcopy(material)
            self._populate_all_tabs()
            self._set_tabs_state("normal")
            self._update_button_states(True)  # Включаем кнопки
            # --- НОВОЕ ИЗМЕНЕНИЕ ---
            self.notebook.select(0) # Выбираем первую вкладку ("Общие данные")

    def create_new_material(self):
        self.editing_copy = Material()
        self.app_data.current_material = None
        self.mat_combo.set(self.editing_copy.filename)
        self._populate_all_tabs()
        self._set_tabs_state("normal")
        self._update_button_states(True)  # Включаем кнопки
        # --- НОВОЕ ИЗМЕНЕНИЕ ---
        self.notebook.select(0) # Выбираем первую вкладку ("Общие данные")

    # --- ПЕРЕМЕЩЕННЫЕ И АДАПТИРОВАННЫЕ МЕТОДЫ ---
    def save_material(self):
        if not self.editing_copy: return
        self.collect_data()
        material_to_save = self.editing_copy

        original_material = self.app_data.current_material
        if original_material:
            changes = find_changes(original_material.data, material_to_save.data)
            log_changes(material_to_save.get_display_name(), changes)

        if not material_to_save.filepath:
            self.save_material_as()
        else:
            try:
                material_to_save.save()
                messagebox.showinfo("Успех", f"Материал '{material_to_save.get_display_name()}' сохранен.")
                # Вызываем перезагрузку данных через главный класс
                self.main_app.open_directory(self.app_data.work_dir, show_success_message=False)
            except Exception as e:
                messagebox.showerror("Ошибка сохранения", f"Не удалось сохранить файл: {e}")

    def save_material_as(self):
        if not self.editing_copy: return
        self.collect_data()
        material_to_save = self.editing_copy

        original_material = self.app_data.current_material
        if original_material:
            changes = find_changes(original_material.data, material_to_save.data)
            log_changes(f"{material_to_save.get_display_name()} (сохранен из {original_material.get_display_name()})",
                        changes)
        else:
            empty_material_data = Material.get_empty_structure()
            changes = find_changes(empty_material_data, material_to_save.data)
            log_changes(material_to_save.get_display_name(), ["Создан новый материал со следующими данными:"] + changes)

        initial_name = material_to_save.get_name().replace(" ", "_") + ".json"
        new_filepath = filedialog.asksaveasfilename(
            initialdir=self.app_data.work_dir, initialfile=initial_name, title="Сохранить материал как...",
            defaultextension=".json", filetypes=[("JSON files", "*.json")])

        if new_filepath:
            try:
                # Обновляем рабочую директорию в app_data через main_app
                self.main_app.app_data.work_dir = os.path.dirname(new_filepath)
                material_to_save.save(filepath=new_filepath)
                messagebox.showinfo("Успех", f"Материал сохранен как '{os.path.basename(new_filepath)}'.")
                # Вызываем перезагрузку данных через главный класс
                self.main_app.open_directory(self.app_data.work_dir, show_success_message=False)
            except Exception as e:
                messagebox.showerror("Ошибка сохранения", f"Не удалось сохранить файл: {e}")

    def revert_changes(self):
        if not self.editing_copy: return

        if not self.app_data.current_material:
            # Если это новый материал (оригинала нет), то просто сбрасываем редактор
            if messagebox.askyesno("Подтверждение", "Вы уверены, что хотите сбросить создание нового материала?"):
                self.create_new_material()
            return

        if messagebox.askyesno("Подтверждение", "Вы уверены, что хотите отменить все несохраненные изменения?"):
            self.load_material()

    def _populate_all_tabs(self):
        if not self.editing_copy: return
        self.general_tab.populate_form(self.editing_copy)
        self.phys_tab.populate_form(self.editing_copy)
        self.mech_tab.populate_form(self.editing_copy)
        self.chem_tab.populate_form(self.editing_copy)

    def collect_data(self):
        if not self.editing_copy: return
        self.general_tab.collect_data(self.editing_copy)
        self.phys_tab.collect_data(self.editing_copy)
        self.mech_tab.collect_data(self.editing_copy)
        self.chem_tab.collect_data(self.editing_copy)

    def _set_tabs_state(self, state):
        for i in range(self.notebook.index("end")):
            self.notebook.tab(i, state=state)


class GeneralDataTab(ttk.Frame):
    def __init__(self, parent, app_data):
        super().__init__(parent, padding=10)
        self.app_data = app_data
        self.area_widgets = {}
        self._setup_widgets()

    def _on_mousewheel(self, event, canvas_widget):
        if hasattr(event, 'delta') and event.delta != 0:
            canvas_widget.yview_scroll(int(-1 * (event.delta / 120)), "units")
        elif hasattr(event, 'num'):
            if event.num == 4:
                canvas_widget.yview_scroll(-1, "units")
            elif event.num == 5:
                canvas_widget.yview_scroll(1, "units")

    def _setup_widgets(self):
        self.columnconfigure(1, weight=1)

        # Основные поля
        ttk.Label(self, text="Наименование (стандарт):").grid(row=0, column=0, sticky="w", pady=2)
        self.name_entry = ttk.Entry(self, width=60)
        self.name_entry.grid(row=0, column=1, sticky="we", pady=2)
        ttk.Label(self, text="Альтернативные названия\n(через запятую):").grid(row=1, column=0, sticky="nw", pady=2)
        self.alt_names_entry = ttk.Entry(self, width=60)
        self.alt_names_entry.grid(row=1, column=1, sticky="we", pady=2)
        ttk.Label(self, text="Общий комментарий:").grid(row=2, column=0, sticky="nw", pady=2)
        self.comment_entry = ttk.Entry(self, width=60)
        self.comment_entry.grid(row=2, column=1, sticky="we", pady=2)

        # Классификация
        class_frame = ttk.LabelFrame(self, text="Классификация", padding=5)
        class_frame.grid(row=3, column=0, columnspan=2, sticky="we", pady=10)
        class_frame.columnconfigure(1, weight=1)
        ttk.Label(class_frame, text="Категория:").grid(row=0, column=0, sticky="w")
        self.cat_entry = ttk.Entry(class_frame)
        self.cat_entry.grid(row=0, column=1, sticky="we", padx=5)
        ttk.Label(class_frame, text="Класс:").grid(row=1, column=0, sticky="w")
        self.class_entry = ttk.Entry(class_frame)
        self.class_entry.grid(row=1, column=1, sticky="we", padx=5)
        ttk.Label(class_frame, text="Подкласс:").grid(row=2, column=0, sticky="w")
        self.subclass_entry = ttk.Entry(class_frame)
        self.subclass_entry.grid(row=2, column=1, sticky="we", padx=5)

        # Области применения
        area_frame = ttk.LabelFrame(self, text="Области применения", padding=5)
        area_frame.grid(row=4, column=0, columnspan=2, sticky="nsew", pady=10)
        self.rowconfigure(4, weight=1)  # Этот фрейм будет растягиваться по вертикали
        checkbox_canvas = tk.Canvas(area_frame, borderwidth=0, highlightthickness=0)
        scrollbar = ttk.Scrollbar(area_frame, orient="vertical", command=checkbox_canvas.yview)
        self.checkbox_container = ttk.Frame(checkbox_canvas)
        self.checkbox_container.bind("<Configure>",
                                     lambda e: checkbox_canvas.configure(scrollregion=checkbox_canvas.bbox("all")))
        checkbox_canvas.create_window((0, 0), window=self.checkbox_container, anchor="nw")
        checkbox_canvas.configure(yscrollcommand=scrollbar.set)
        on_scroll = lambda e: self._on_mousewheel(e, checkbox_canvas)
        for widget_to_bind in (checkbox_canvas, self.checkbox_container):
            widget_to_bind.bind("<MouseWheel>", on_scroll)
            widget_to_bind.bind("<Button-4>", on_scroll)
            widget_to_bind.bind("<Button-5>", on_scroll)
        checkbox_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # --- НАЧАЛО ИЗМЕНЕНИЙ: Перенос и реорганизация блока добавления области ---
        # Создаем отдельный фрейм для строки добавления, размещаем его в основном гриде
        add_area_frame = ttk.Frame(self)
        add_area_frame.grid(row=5, column=0, columnspan=2, sticky="we", pady=(0, 10))

        # Размещаем виджеты внутри этого фрейма с помощью pack для нужной компоновки
        add_label = ttk.Label(add_area_frame, text="Добавить область применения:")
        add_label.pack(side="left", padx=(0, 5))

        add_button = ttk.Button(add_area_frame, text="Добавить", command=self._add_new_area)
        add_button.pack(side="right")

        self.new_area_entry = ttk.Entry(add_area_frame)
        self.new_area_entry.pack(side="left", fill="x", expand=True, padx=(0, 5))

        # Параметры применения теперь размещаются в ряду 6
        temp_app_frame = ttk.LabelFrame(self, text="Параметры применения", padding=5)
        temp_app_frame.grid(row=6, column=0, columnspan=2, sticky="we", pady=10)  # Было row=5
        temp_app_frame.columnconfigure(1, weight=1)
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---

        ttk.Label(temp_app_frame, text="Температура применения ДО, °С:").grid(row=0, column=0, sticky="w", padx=5,
                                                                              pady=2)
        self.temp_app_value_entry = ttk.Entry(temp_app_frame)
        self.temp_app_value_entry.grid(row=0, column=1, sticky="we", padx=5, pady=2)

        ttk.Label(temp_app_frame, text="Комментарий к температуре:").grid(row=1, column=0, sticky="w", padx=5, pady=2)
        self.temp_app_comment_entry = ttk.Entry(temp_app_frame)
        self.temp_app_comment_entry.grid(row=1, column=1, sticky="we", padx=5, pady=2)

    def _add_new_area(self):
        new_area = self.new_area_entry.get().strip()
        if not new_area: return
        if new_area in self.area_widgets:
            messagebox.showinfo("Информация", f"Область '{new_area}' уже есть в списке.", parent=self)
            return
        var = tk.BooleanVar(value=True)
        cb = ttk.Checkbutton(self.checkbox_container, text=new_area, variable=var)
        cb.pack(anchor="w", padx=5, pady=1)
        canvas_widget = self.checkbox_container.master
        on_scroll = lambda e: self._on_mousewheel(e, canvas_widget)
        cb.bind("<MouseWheel>", on_scroll)
        cb.bind("<Button-4>", on_scroll)
        cb.bind("<Button-5>", on_scroll)
        self.area_widgets[new_area] = (cb, var)
        self.new_area_entry.delete(0, tk.END)

    def populate_form(self, material):
        meta = material.data.get("metadata", {})
        self.name_entry.delete(0, tk.END)
        self.name_entry.insert(0, meta.get("name_material_standard", ""))
        alt_names_list = meta.get("name_material_alternative", [])
        self.alt_names_entry.delete(0, tk.END)
        self.alt_names_entry.insert(0, ", ".join(alt_names_list))
        self.comment_entry.delete(0, tk.END)
        self.comment_entry.insert(0, meta.get("comment", ""))
        cls = meta.get("classification", {})
        self.cat_entry.delete(0, tk.END)
        self.cat_entry.insert(0, cls.get("classification_category", ""))
        self.class_entry.delete(0, tk.END)
        self.class_entry.insert(0, cls.get("classification_class", ""))
        self.subclass_entry.delete(0, tk.END)
        self.subclass_entry.insert(0, cls.get("classification_subclass", ""))
        for widget, var in self.area_widgets.values():
            widget.destroy()
        self.area_widgets.clear()
        all_known_areas = set()
        for mat_from_db in self.app_data.materials:
            areas = mat_from_db.data.get("metadata", {}).get("application_area", [])
            all_known_areas.update(areas)
        current_material_areas = set(meta.get("application_area", []))
        all_known_areas.update(current_material_areas)
        sorted_areas = sorted(list(all_known_areas))
        canvas_widget = self.checkbox_container.master
        on_scroll = lambda e: self._on_mousewheel(e, canvas_widget)
        for area in sorted_areas:
            var = tk.BooleanVar()
            if area in current_material_areas:
                var.set(True)
            cb = ttk.Checkbutton(self.checkbox_container, text=area, variable=var)
            cb.pack(anchor="w", padx=5, pady=1)
            cb.bind("<MouseWheel>", on_scroll)
            cb.bind("<Button-4>", on_scroll)
            cb.bind("<Button-5>", on_scroll)
            self.area_widgets[area] = (cb, var)

        # Использование .get() гарантирует, что код не сломается на старых файлах
        temp_app_data = meta.get("temperature_application", {})
        self.temp_app_value_entry.delete(0, tk.END)
        # Если значение None или его нет, вставится пустая строка
        self.temp_app_value_entry.insert(0, temp_app_data.get("value", ""))
        self.temp_app_comment_entry.delete(0, tk.END)
        self.temp_app_comment_entry.insert(0, temp_app_data.get("comment", ""))

    def collect_data(self, material):
        meta = material.data["metadata"]
        meta["name_material_standard"] = self.name_entry.get()
        alt_names_str = self.alt_names_entry.get()
        meta["name_material_alternative"] = [name.strip() for name in alt_names_str.split(',') if name.strip()]
        meta["comment"] = self.comment_entry.get().strip()
        cls = meta["classification"]
        cls["classification_category"] = self.cat_entry.get()
        cls["classification_class"] = self.class_entry.get()
        cls["classification_subclass"] = self.subclass_entry.get()
        selected_areas = [area_name for area_name, (widget, var) in self.area_widgets.items() if var.get()]
        meta["application_area"] = selected_areas

        temp_val_str = self.temp_app_value_entry.get().strip()
        temp_comment_str = self.temp_app_comment_entry.get().strip()

        # Преобразуем температуру в число, если это возможно
        temp_val = None
        if temp_val_str:
            try:
                # Используем float для большей гибкости (например, 20.5)
                temp_val = float(temp_val_str)
            except ValueError:
                # Если введено не число, просто сохраняем None
                pass

                # Сохраняем блок temperature_application, только если есть что сохранять
        if temp_val is not None or temp_comment_str:
            # setdefault создаст словарь, если его нет
            temp_app_data = meta.setdefault("temperature_application", {})
            temp_app_data["value"] = temp_val
            temp_app_data["comment"] = temp_comment_str
        elif "temperature_application" in meta:
            # Если оба поля были очищены, удаляем весь блок из JSON для чистоты
            del meta["temperature_application"]


class PropertyEditorTab(ttk.Frame):
    """Универсальная вкладка для редактирования набора свойств с графиком в реальном времени."""

    def __init__(self, parent, prop_group_key, prop_map):
        super().__init__(parent)
        self.prop_group_key = prop_group_key
        self.prop_map = prop_map
        self.prop_widgets = {}
        self._setup_widgets()

    def _on_mousewheel(self, event, widget):
        if event.num == 4 or event.delta > 0:
            widget.yview_scroll(-1, "units")
        elif event.num == 5 or event.delta < 0:
            widget.yview_scroll(1, "units")

    def _setup_widgets(self):
        canvas = tk.Canvas(self)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        on_scroll = lambda e: self._on_mousewheel(e, canvas)
        canvas.bind("<MouseWheel>", on_scroll)
        scrollable_frame.bind("<MouseWheel>", on_scroll)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        for prop_key, prop_info in self.prop_map.items():
            frame = ttk.LabelFrame(scrollable_frame, text=f"{prop_info['name']} ({prop_info['symbol']} [{prop_info['unit']}])", padding=10)
            frame.pack(fill="x", expand=True, padx=10, pady=5)
            frame.bind("<MouseWheel>", on_scroll)

            # --- Разделение на левую (данные) и правую (график) панели ---
            content_frame = ttk.Frame(frame)
            content_frame.pack(fill="both", expand=True)

            left_panel = ttk.Frame(content_frame)
            left_panel.pack(side="left", fill="y", padx=(0, 10))

            right_panel = ttk.Frame(content_frame)
            right_panel.pack(side="right", fill="both", expand=True)

            # Создаем коллбэк-функцию с замыканием на prop_key
            update_callback = lambda p_key=prop_key: self.update_graph(p_key)

            widgets = self._create_prop_fields(left_panel, update_callback)

            # --- Настройка графика ---
            fig = Figure(figsize=(4, 3), dpi=90)
            ax = fig.add_subplot(111)
            graph_canvas = FigureCanvasTkAgg(fig, master=right_panel)
            graph_canvas.get_tk_widget().pack(fill="both", expand=True)
            widgets.update({'fig': fig, 'ax': ax, 'canvas': graph_canvas})

            self.prop_widgets[prop_key] = widgets

    def _create_prop_fields(self, parent_frame, on_update_callback):
        parent_frame.columnconfigure(1, weight=1)
        widgets = {}
        # ... (поля source, subsource, comment без изменений)
        ttk.Label(parent_frame, text="Источник:").grid(row=0, column=0, sticky="w", pady=2)
        widgets["source"] = ttk.Entry(parent_frame)
        widgets["source"].grid(row=0, column=1, columnspan=2, sticky="we")

        ttk.Label(parent_frame, text="Под-источник:").grid(row=1, column=0, sticky="w", pady=2)
        widgets["subsource"] = ttk.Entry(parent_frame)
        widgets["subsource"].grid(row=1, column=1, columnspan=2, sticky="we")

        ttk.Label(parent_frame, text="Комментарий:").grid(row=2, column=0, sticky="w", pady=2)
        widgets["comment"] = ttk.Entry(parent_frame)
        widgets["comment"].grid(row=2, column=1, columnspan=2, sticky="we")

        table_frame = ttk.Frame(parent_frame)
        table_frame.grid(row=3, column=0, columnspan=3, sticky="we", pady=5)
        table_frame.columnconfigure(0, weight=1)

        # Передаем callback в create_editable_treeview
        tree = create_editable_treeview(table_frame, on_update_callback=on_update_callback)
        tree["columns"] = ("temp", "value")
        tree.heading("temp", text="Температура, °C")
        tree.column("temp", width=140)
        tree.heading("value", text="Значение")
        tree.column("value", width=140)
        tree.grid(row=0, column=0, sticky="nsew")
        widgets["tree"] = tree

        btn_frame = ttk.Frame(table_frame)
        btn_frame.grid(row=0, column=1, sticky="ns", padx=5)

        # Обновляем команды кнопок, чтобы они тоже вызывали callback
        add_cmd = lambda t=tree, cb=on_update_callback: (t.insert("", "end", values=["0", "0"]), cb() if cb else None)
        del_cmd = lambda t=tree, cb=on_update_callback: (t.delete(t.selection()), cb() if cb else None)

        ttk.Button(btn_frame, text="+", width=2, command=add_cmd).pack(pady=2)
        ttk.Button(btn_frame, text="-", width=2, command=del_cmd).pack(pady=2)

        return widgets

    def update_graph(self, prop_key):
        """Обновляет график для конкретного свойства."""
        widgets = self.prop_widgets.get(prop_key)
        if not widgets: return

        tree = widgets['tree']
        ax = widgets['ax']
        canvas = widgets['canvas']

        points = []
        for item_id in tree.get_children():
            values = tree.set(item_id)
            try:
                temp = float(values["temp"])
                val = float(values["value"])
                points.append((temp, val))
            except (ValueError, KeyError):
                continue

        # Сортируем точки по температуре для корректного отображения линии
        points.sort(key=lambda p: p[0])
        temps = [p[0] for p in points]
        values = [p[1] for p in points]

        ax.clear()
        if temps and values:
            ax.plot(temps, values, marker='o', linestyle='-', markersize=4)

        prop_info = self.prop_map[prop_key]
        ax.set_title(f"{prop_info['name']}", fontsize=9)
        ax.set_xlabel("t, °C", fontsize=8)
        ax.set_ylabel(f"{prop_info['unit']}", fontsize=8)
        ax.grid(True, linestyle='--', alpha=0.6)
        ax.tick_params(axis='both', which='major', labelsize=8)
        widgets['fig'].tight_layout(pad=0.5)

        canvas.draw()

    def populate_form(self, material):
        prop_group = material.data.get(self.prop_group_key, {})
        for prop_key, widgets in self.prop_widgets.items():
            prop_data = prop_group.get(prop_key, {})
            widgets["source"].delete(0, tk.END)
            widgets["source"].insert(0, prop_data.get("property_source", ""))
            widgets["subsource"].delete(0, tk.END)
            widgets["subsource"].insert(0, prop_data.get("property_subsource", ""))
            widgets["comment"].delete(0, tk.END)
            widgets["comment"].insert(0, prop_data.get("comment", ""))

            tree = widgets["tree"]
            for i in tree.get_children(): tree.delete(i)
            for temp, val in prop_data.get("temperature_value_pairs", []):
                tree.insert("", "end", values=[temp, val])

            # Обновляем график после заполнения таблицы
            self.update_graph(prop_key)

    def collect_data(self, material):
        if self.prop_group_key not in material.data:
            material.data[self.prop_group_key] = {}
        prop_group = material.data[self.prop_group_key]

        for prop_key, widgets in self.prop_widgets.items():
            pairs = []
            for item_id in widgets["tree"].get_children():
                values = widgets["tree"].set(item_id)
                try:
                    pairs.append([float(values["temp"]), float(values["value"])])
                except (ValueError, KeyError):
                    continue

            source = widgets["source"].get()
            subsource = widgets["subsource"].get()
            comment = widgets["comment"].get()

            if pairs or source or subsource or comment:
                prop_data = prop_group.setdefault(prop_key, {})
                prop_data["property_source"] = source
                prop_data["property_subsource"] = subsource
                prop_data["comment"] = comment
                prop_data["temperature_value_pairs"] = pairs
                if "property_name" not in prop_data:
                    prop_info = self.prop_map[prop_key]
                    prop_data["property_name"] = prop_info["name"]
                    prop_data["property_unit"] = prop_info["unit"]
            elif prop_key in prop_group:
                del prop_group[prop_key]


class MechanicalPropertiesTab(ttk.Frame):
    """Вкладка для редактирования механических свойств по категориям прочности с графиками."""

    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.material = None
        self.current_category_idx = -1
        self.prop_widgets = {}
        self._setup_widgets()

    def _on_mousewheel(self, event, widget):
        # Эта функция для прокрутки, без изменений
        if event.num == 4 or event.delta > 0:
            widget.yview_scroll(-1, "units")
        elif event.num == 5 or event.delta < 0:
            widget.yview_scroll(1, "units")

    def _setup_widgets(self):
        # --- Верхняя панель с выбором категории ---
        top_frame = ttk.Frame(self)
        top_frame.pack(fill="x", pady=(0, 10))
        ttk.Label(top_frame, text="Категория прочности:").pack(side="left", padx=(0, 5))
        self.category_combo = ttk.Combobox(top_frame, state="readonly", width=40)
        self.category_combo.pack(side="left", fill="x", expand=True)
        self.category_combo.bind("<<ComboboxSelected>>", self._on_category_select)
        ttk.Button(top_frame, text="+", width=3, command=self._add_category).pack(side="left", padx=5)
        ttk.Button(top_frame, text="-", width=3, command=self._delete_category).pack(side="left")

        # --- Основной контейнер для полей редактора (изначально скрыт) ---
        self.editor_content_frame = ttk.Frame(self)
        # pack() будет вызван в populate_form, когда появятся данные

        # --- Поле для названия категории ---
        name_frame = ttk.Frame(self.editor_content_frame)
        name_frame.pack(fill="x", pady=5)
        ttk.Label(name_frame, text="Название категории:").pack(side="left")
        self.category_name_entry = ttk.Entry(name_frame)
        self.category_name_entry.pack(side="left", fill="x", expand=True, padx=5)

        # --- Прокручиваемая область для всех свойств ---
        prop_canvas = tk.Canvas(self.editor_content_frame)
        scrollbar = ttk.Scrollbar(self.editor_content_frame, orient="vertical", command=prop_canvas.yview)
        scrollable_frame = ttk.Frame(prop_canvas)
        scrollable_frame.bind("<Configure>", lambda e: prop_canvas.configure(scrollregion=prop_canvas.bbox("all")))
        prop_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        prop_canvas.configure(yscrollcommand=scrollbar.set)
        on_scroll = lambda e: self._on_mousewheel(e, prop_canvas)
        prop_canvas.bind("<MouseWheel>", on_scroll)
        scrollable_frame.bind("<MouseWheel>", on_scroll)
        prop_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # --- Создание виджетов для каждого механического свойства ---
        for prop_key, prop_info in MECHANICAL_PROPERTIES_MAP.items():
            frame = ttk.LabelFrame(scrollable_frame, text=f"{prop_info['name']} ({prop_info['symbol']} [{prop_info['unit']}])", padding=10)
            frame.pack(fill="x", expand=True, padx=10, pady=5)
            frame.bind("<MouseWheel>", on_scroll)

            content_frame = ttk.Frame(frame)
            content_frame.pack(fill="both", expand=True)
            left_panel = ttk.Frame(content_frame)
            left_panel.pack(side="left", fill="y", padx=(0, 10))
            right_panel = ttk.Frame(content_frame)
            right_panel.pack(side="right", fill="both", expand=True)

            update_callback = lambda p_key=prop_key: self.update_mech_graph(p_key)
            widgets = self._create_prop_fields_for_editor(left_panel, update_callback)

            fig = Figure(figsize=(4, 3), dpi=90)
            ax = fig.add_subplot(111)
            graph_canvas = FigureCanvasTkAgg(fig, master=right_panel)
            graph_canvas.get_tk_widget().pack(fill="both", expand=True)
            widgets.update({'fig': fig, 'ax': ax, 'canvas': graph_canvas})

            self.prop_widgets[prop_key] = widgets

        # --- Создание виджетов для твердости ---
        hardness_frame = ttk.LabelFrame(scrollable_frame, text="Твердость (Hardness)", padding=10)
        hardness_frame.pack(fill="x", expand=True, padx=10, pady=5)
        hardness_frame.bind("<MouseWheel>", on_scroll)
        self.hardness_tree = self._create_hardness_table(hardness_frame)

    def _create_prop_fields_for_editor(self, parent_frame, on_update_callback):
        parent_frame.columnconfigure(1, weight=1)
        widgets = {}

        ttk.Label(parent_frame, text="Источник:").grid(row=0, column=0, sticky="w", pady=2)
        widgets["source"] = ttk.Entry(parent_frame)
        widgets["source"].grid(row=0, column=1, columnspan=2, sticky="we")

        ttk.Label(parent_frame, text="Под-источник:").grid(row=1, column=0, sticky="w", pady=2)
        widgets["subsource"] = ttk.Entry(parent_frame)
        widgets["subsource"].grid(row=1, column=1, columnspan=2, sticky="we")

        ttk.Label(parent_frame, text="Комментарий:").grid(row=2, column=0, sticky="w", pady=2)
        widgets["comment"] = ttk.Entry(parent_frame)
        widgets["comment"].grid(row=2, column=1, columnspan=2, sticky="we")

        table_frame = ttk.Frame(parent_frame)
        table_frame.grid(row=3, column=0, columnspan=3, sticky="we", pady=5)
        table_frame.columnconfigure(0, weight=1)

        tree = create_editable_treeview(table_frame, on_update_callback=on_update_callback)
        tree["columns"] = ("temp", "value")
        tree.heading("temp", text="Температура, °C")
        tree.column("temp", width=140)
        tree.heading("value", text="Значение")
        tree.column("value", width=140)
        tree.grid(row=0, column=0, sticky="nsew")
        widgets["tree"] = tree

        btn_frame = ttk.Frame(table_frame)
        btn_frame.grid(row=0, column=1, sticky="ns", padx=5)

        add_cmd = lambda t=tree, cb=on_update_callback: (t.insert("", "end", values=["0", "0"]), cb() if cb else None)
        del_cmd = lambda t=tree, cb=on_update_callback: (t.delete(t.selection()), cb() if cb else None)

        ttk.Button(btn_frame, text="+", width=2, command=add_cmd).pack(pady=2)
        ttk.Button(btn_frame, text="-", width=2, command=del_cmd).pack(pady=2)
        return widgets

    def _create_hardness_table(self, parent_frame):
        parent_frame.columnconfigure(0, weight=1)
        table_frame = ttk.Frame(parent_frame)
        table_frame.pack(fill="both", expand=True)
        table_frame.columnconfigure(0, weight=1)

        tree = create_editable_treeview(table_frame)
        tree["columns"] = ("source", "subsource", "min", "max", "unit")
        tree.heading("source", text="Источник")
        tree.column("source", width=150)
        tree.heading("subsource", text="Под-источник")
        tree.column("subsource", width=100)
        tree.heading("min", text="Min")
        tree.column("min", width=60)
        tree.heading("max", text="Max")
        tree.column("max", width=60)
        tree.heading("unit", text="Ед. изм.")
        tree.column("unit", width=60)
        tree.pack(side="left", fill="both", expand=True)

        btn_frame = ttk.Frame(table_frame)
        btn_frame.pack(side="left", fill="y", padx=5)
        ttk.Button(btn_frame, text="+", width=2,
                   command=lambda: tree.insert("", "end", values=["", "", "", "", ""])).pack(pady=2)
        ttk.Button(btn_frame, text="-", width=2, command=lambda: tree.delete(tree.selection())).pack(pady=2)
        return tree

    def update_mech_graph(self, prop_key):
        """Обновляет график для конкретного механического свойства."""
        widgets = self.prop_widgets.get(prop_key)
        if not widgets: return

        tree, ax, canvas, fig = widgets['tree'], widgets['ax'], widgets['canvas'], widgets['fig']
        points = []
        for item_id in tree.get_children():
            values = tree.set(item_id)
            try:
                temp = float(values.get("temp", 0))
                val = float(values.get("value", 0))
                points.append((temp, val))
            except (ValueError, KeyError, TypeError):
                continue

        points.sort(key=lambda p: p[0])
        temps = [p[0] for p in points]
        values = [p[1] for p in points]

        ax.clear()
        if temps and values:
            ax.plot(temps, values, marker='o', linestyle='-', markersize=4)

        prop_info = MECHANICAL_PROPERTIES_MAP[prop_key]
        ax.set_title(f"{prop_info['name']}", fontsize=9, wrap=True)
        ax.set_xlabel("t, °C", fontsize=8)
        ax.set_ylabel(f"{prop_info['unit']}", fontsize=8)
        ax.grid(True, linestyle='--', alpha=0.6)
        ax.tick_params(axis='both', which='major', labelsize=8)
        fig.tight_layout(pad=0.5)
        canvas.draw()

    def _populate_category_fields(self, category_data):
        """Заполняет все поля формы данными из указанной категории."""
        self.category_name_entry.delete(0, tk.END)
        self.category_name_entry.insert(0, category_data.get("value_strength_category", ""))

        for prop_key, widgets in self.prop_widgets.items():
            prop_data = category_data.get(prop_key, {})
            widgets["source"].delete(0, tk.END)
            widgets["source"].insert(0, prop_data.get("property_source", ""))
            widgets["subsource"].delete(0, tk.END)
            widgets["subsource"].insert(0, prop_data.get("property_subsource", ""))
            widgets["comment"].delete(0, tk.END)
            widgets["comment"].insert(0, prop_data.get("comment", ""))

            tree = widgets["tree"]
            for i in tree.get_children(): tree.delete(i)
            for temp, val in prop_data.get("temperature_value_pairs", []):
                tree.insert("", "end", values=[temp, val])

            # КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Обновляем график после заполнения таблицы.
            self.update_mech_graph(prop_key)

        for i in self.hardness_tree.get_children(): self.hardness_tree.delete(i)
        for h_data in category_data.get("hardness", []):
            self.hardness_tree.insert("", "end", values=[
                h_data.get("property_source", ""), h_data.get("property_subsource", ""),
                h_data.get("min_value", ""), h_data.get("max_value", ""), h_data.get("unit_value", "")
            ])

    def populate_form(self, material):
        """Заполняет всю вкладку данными из указанного материала."""
        if self.material and self.material != material:
            self._save_current_category()

        self.material = material
        self.current_category_idx = -1

        categories = material.data.get("mechanical_properties", {}).get("strength_category", [])
        category_names = [cat.get("value_strength_category", f"Категория {i + 1}") for i, cat in enumerate(categories)]
        self.category_combo["values"] = category_names

        if categories:
            self.editor_content_frame.pack(fill="both", expand=True)
            self.category_combo.current(0)
            self._on_category_select()
        else:
            self.category_combo.set("")
            self.editor_content_frame.pack_forget()

    def _on_category_select(self, event=None):
        """Обработчик выбора категории в combobox."""
        new_idx = self.category_combo.current()
        if new_idx == -1: return

        # Сохраняем данные предыдущей категории, только если она была выбрана и это не она же
        if self.current_category_idx != -1 and self.current_category_idx != new_idx:
            self._save_current_category()

        self.current_category_idx = new_idx
        category_data = self.material.data["mechanical_properties"]["strength_category"][self.current_category_idx]
        self._populate_category_fields(category_data)
        self.editor_content_frame.pack(fill="both", expand=True)

    def _add_category(self):
        if not self.material: return
        self._save_current_category()

        new_category_name = f"Новая категория {len(self.category_combo['values']) + 1}"
        new_category = {"value_strength_category": new_category_name, "hardness": []}

        if "mechanical_properties" not in self.material.data:
            self.material.data["mechanical_properties"] = {"strength_category": []}

        categories = self.material.data["mechanical_properties"]["strength_category"]
        categories.append(new_category)

        current_values = list(self.category_combo['values'])
        current_values.append(new_category_name)
        self.category_combo['values'] = current_values
        self.category_combo.current(len(categories) - 1)
        self._on_category_select()

    def _delete_category(self):
        if not self.material or self.current_category_idx == -1: return

        if messagebox.askyesno("Подтверждение", "Вы уверены, что хотите удалить эту категорию прочности?"):
            categories = self.material.data["mechanical_properties"]["strength_category"]
            del categories[self.current_category_idx]
            self.current_category_idx = -1  # Сбрасываем индекс
            self.populate_form(self.material)

    def _save_current_category(self):
        if not self.material or self.current_category_idx == -1: return

        try:
            category_data = self.material.data["mechanical_properties"]["strength_category"][self.current_category_idx]
        except (KeyError, IndexError):
            return

        new_name = self.category_name_entry.get()
        category_data["value_strength_category"] = new_name

        # Обновляем имя в выпадающем списке
        category_names = list(self.category_combo['values'])
        category_names[self.current_category_idx] = new_name
        self.category_combo['values'] = category_names

        for prop_key, widgets in self.prop_widgets.items():
            pairs = []
            for item_id in widgets["tree"].get_children():
                values = widgets["tree"].set(item_id)
                try:
                    pairs.append([float(values["temp"]), float(values["value"])])
                except (ValueError, KeyError, TypeError):
                    continue
            source = widgets["source"].get()
            subsource = widgets["subsource"].get()
            comment = widgets["comment"].get()

            if pairs or source or subsource or comment:
                prop_data = category_data.setdefault(prop_key, {})
                prop_data["property_source"] = source
                prop_data["property_subsource"] = subsource
                prop_data["comment"] = comment
                prop_data["temperature_value_pairs"] = pairs
                if "property_name" not in prop_data:
                    prop_info = MECHANICAL_PROPERTIES_MAP[prop_key]
                    prop_data["property_name"] = prop_info["name"]
                    prop_data["property_unit"] = prop_info["unit"]
            elif prop_key in category_data:
                del category_data[prop_key]

        hardness_list = []
        for item_id in self.hardness_tree.get_children():
            v = self.hardness_tree.set(item_id)
            h_data = {
                "property_source": v["source"], "property_subsource": v["subsource"], "unit_value": v["unit"],
                "min_value": None, "max_value": None
            }
            try:
                h_data["min_value"] = float(v["min"]) if v["min"] else None
            except ValueError:
                pass
            try:
                h_data["max_value"] = float(v["max"]) if v["max"] else None
            except ValueError:
                pass

            if h_data["property_source"] or h_data["property_subsource"] or h_data["min_value"] is not None or h_data[
                "max_value"] is not None:
                hardness_list.append(h_data)
        category_data["hardness"] = hardness_list

    def collect_data(self, material):
        """Собирает данные из формы перед сохранением или сменой материала."""
        # Убеждаемся, что текущая редактируемая категория сохранена
        if self.material == material:
            self._save_current_category()
        # self.material будет обновлен в populate_form, так что здесь менять не нужно.


class Tooltip:
    """
    Создает всплывающую подсказку для виджета.
    """

    def __init__(self, widget, text, delay=500):
        self.widget = widget
        self.text = text
        self.delay = delay  # Задержка перед появлением подсказки в миллисекундах
        self.tip_window = None
        self.id = None
        self.widget.bind("<Enter>", self.schedule_tip)
        self.widget.bind("<Leave>", self.hide_tip)

    def schedule_tip(self, event=None):
        """Планирует показ подсказки через self.delay миллисекунд."""
        self.id = self.widget.after(self.delay, self.show_tip)

    def show_tip(self, event=None):
        """Отображает окно с подсказкой."""
        if self.tip_window or not self.text:
            return

        # Получаем координаты курсора относительно экрана
        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25
        y += self.widget.winfo_rooty() + 20

        # Создаем всплывающее окно
        self.tip_window = tk.Toplevel(self.widget)
        self.tip_window.wm_overrideredirect(True)  # Убираем рамку и заголовок окна
        self.tip_window.wm_geometry(f"+{x}+{y}")

        label = tk.Label(self.tip_window, text=self.text, justify=tk.LEFT,
                         background="#ffffe0", relief=tk.SOLID, borderwidth=1,
                         font=("TkDefaultFont", 10, "normal"), wraplength=300)
        label.pack(ipadx=5, ipady=3)

    def hide_tip(self, event=None):
        """Скрывает подсказку и отменяет запланированный показ."""
        if self.id:
            self.widget.after_cancel(self.id)
            self.id = None
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None


class ChemicalCompositionTab(ttk.Frame):
    """Вкладка для редактирования химического состава по источникам."""

    def __init__(self, parent):
        super().__init__(parent, padding=10)
        self.material = None
        self.current_source_idx = -1
        self._setup_widgets()

    def _setup_widgets(self):
        # --- Верхняя панель для управления источниками ---
        top_frame = ttk.Frame(self)
        top_frame.pack(fill="x", pady=(0, 10))
        ttk.Label(top_frame, text="Источник состава:").pack(side="left", padx=(0, 5))
        self.source_combo = ttk.Combobox(top_frame, state="readonly", width=40)
        self.source_combo.pack(side="left", fill="x", expand=True)
        self.source_combo.bind("<<ComboboxSelected>>", self._on_source_select)
        ttk.Button(top_frame, text="+", width=3, command=self._add_source).pack(side="left", padx=5)
        ttk.Button(top_frame, text="-", width=3, command=self._delete_source).pack(side="left")

        # --- Фрейм для редактирования ---
        self.editor_content_frame = ttk.Frame(self)
        self.editor_content_frame.pack(fill="both", expand=True)
        self.editor_content_frame.pack_forget()

        # Поля для метаданных источника
        meta_frame = ttk.LabelFrame(self.editor_content_frame, text="Данные источника", padding=5)
        meta_frame.pack(fill="x", pady=5)
        meta_frame.columnconfigure(1, weight=1)

        ttk.Label(meta_frame, text="Источник:").grid(row=0, column=0, sticky="w")
        self.source_entry = ttk.Entry(meta_frame)
        self.source_entry.grid(row=0, column=1, sticky="we", padx=5, pady=2)
        ttk.Label(meta_frame, text="Под-источник:").grid(row=1, column=0, sticky="w")
        self.subsource_entry = ttk.Entry(meta_frame)
        self.subsource_entry.grid(row=1, column=1, sticky="we", padx=5, pady=2)
        ttk.Label(meta_frame, text="Комментарий:").grid(row=2, column=0, sticky="w")
        self.comment_entry = ttk.Entry(meta_frame)
        self.comment_entry.grid(row=2, column=1, sticky="we", padx=5, pady=2)
        ttk.Label(meta_frame, text="Основной элемент:").grid(row=3, column=0, sticky="w")
        self.base_element_entry = ttk.Entry(meta_frame)
        self.base_element_entry.grid(row=3, column=1, sticky="we", padx=5, pady=2)

        # Таблица для элементов
        elements_frame = ttk.LabelFrame(self.editor_content_frame, text="Элементы", padding=5)
        elements_frame.pack(fill="both", expand=True, pady=5)
        self.elements_tree = self._create_elements_table(elements_frame)

    def _create_elements_table(self, parent_frame):
        table_frame = ttk.Frame(parent_frame)
        table_frame.pack(fill="both", expand=True)
        table_frame.columnconfigure(0, weight=1)
        tree = create_editable_treeview(table_frame)
        tree["columns"] = ("elem", "min", "max", "unit", "min_tol", "max_tol")
        tree.heading("elem", text="Элемент")
        tree.column("elem", width=80)
        tree.heading("min", text="Min")
        tree.column("min", width=80)
        tree.heading("max", text="Max")
        tree.column("max", width=80)
        tree.heading("unit", text="Ед.изм.")
        tree.column("unit", width=60)
        tree.heading("min_tol", text="Допуск Min")
        tree.column("min_tol", width=100)
        tree.heading("max_tol", text="Допуск Max")
        tree.column("max_tol", width=100)
        tree.pack(side="left", fill="both", expand=True)
        btn_frame = ttk.Frame(table_frame)
        btn_frame.pack(side="left", fill="y", padx=5)
        ttk.Button(btn_frame, text="+", width=2,
                   command=lambda: tree.insert("", "end", values=["", "", "", "%", "", ""])).pack(pady=2)
        ttk.Button(btn_frame, text="-", width=2, command=lambda: tree.delete(tree.selection())).pack(pady=2)
        return tree

    def populate_form(self, material):
        # 1. Если до этого был открыт другой материал, сначала сохраняем его текущие данные.
        if self.material and self.material != material:
            self._save_current_source()

        # 2. Устанавливаем НОВЫЙ материал и сбрасываем индекс, чтобы избежать ошибок.
        self.material = material
        self.current_source_idx = -1

        # 3. Получаем список источников состава из нового материала.
        compositions = material.data.get("chemical_properties", {}).get("composition", [])
        self.source_combo["values"] = [comp.get("composition_source", f"Источник {i + 1}") for i, comp in
                                       enumerate(compositions)]

        # 4. Обрабатываем, есть ли у материала источники.
        if compositions:
            # Выбираем первый источник в списке
            self.source_combo.current(0)
            # Вызываем _on_source_select, который сам выставит индекс и заполнит поля.
            # Важно: он сначала вызовет _save_current_source, но т.к. current_source_idx = -1, ничего не произойдет.
            self._on_source_select()
        else:
            # Если источников нет, очищаем комбобокс и скрываем область редактирования.
            self.source_combo.set("")
            self.editor_content_frame.pack_forget()

    def _on_source_select(self, event=None):
        # Сохраняем предыдущий источник, если он был выбран.
        self._save_current_source()

        idx = self.source_combo.current()
        if idx == -1:
            self.editor_content_frame.pack_forget()  # Скрываем, если ничего не выбрано
            return

        # Устанавливаем новый активный индекс
        self.current_source_idx = idx

        # Получаем данные и заполняем поля
        comp_data = self.material.data["chemical_properties"]["composition"][idx]
        self._populate_source_fields(comp_data)
        self.editor_content_frame.pack(fill="both", expand=True)  # Показываем область редактирования

    def _populate_source_fields(self, comp_data):
        self.source_entry.delete(0, tk.END)
        self.source_entry.insert(0, comp_data.get("composition_source", ""))
        self.subsource_entry.delete(0, tk.END)
        self.subsource_entry.insert(0, comp_data.get("composition_subsource", ""))
        self.comment_entry.delete(0, tk.END)
        self.comment_entry.insert(0, comp_data.get("comment", ""))
        self.base_element_entry.delete(0, tk.END)
        self.base_element_entry.insert(0, comp_data.get("base_element", ""))

        for i in self.elements_tree.get_children(): self.elements_tree.delete(i)
        for elem in comp_data.get("other_elements", []):
            self.elements_tree.insert("", "end", values=[
                elem.get("element", ""), elem.get("min_value", ""), elem.get("max_value", ""),
                elem.get("unit_value", "%"), elem.get("min_value_tolerance", ""), elem.get("max_value_tolerance", "")
            ])

    def _add_source(self):
        if not self.material: return
        self._save_current_source()
        new_source = {"composition_source": "Новый источник", "other_elements": []}
        compositions = self.material.data["chemical_properties"]["composition"]
        compositions.append(new_source)
        self.populate_form(self.material)
        self.source_combo.current(len(compositions) - 1)
        self._on_source_select()

    def _delete_source(self):
        if not self.material or self.current_source_idx == -1: return
        if messagebox.askyesno("Подтверждение", "Вы уверены, что хотите удалить этот источник хим. состава?"):
            compositions = self.material.data["chemical_properties"]["composition"]
            del compositions[self.current_source_idx]
            self.source_combo.set("")
            self.populate_form(self.material)

    def _save_current_source(self):
        if not self.material or self.current_source_idx == -1: return
        try:
            comp_data = self.material.data["chemical_properties"]["composition"][self.current_source_idx]
        except IndexError:
            return

        comp_data["composition_source"] = self.source_entry.get()
        comp_data["composition_subsource"] = self.subsource_entry.get()
        comp_data["comment"] = self.comment_entry.get()
        comp_data["base_element"] = self.base_element_entry.get()

        elements_list = []
        for item_id in self.elements_tree.get_children():
            values = self.elements_tree.set(item_id)
            if not values.get("elem"): continue  # Пропускаем строки без названия элемента

            elem_data = {"element": values["elem"], "unit_value": values["unit"]}
            for key, val_key in [("min_value", "min"), ("max_value", "max")]:
                if values[val_key]:
                    try:
                        elem_data[key] = float(values[val_key])
                    except ValueError:
                        pass

            for key, val_key in [("min_value_tolerance", "min_tol"), ("max_value_tolerance", "max_tol")]:
                if values[val_key]:
                    elem_data[key] = values[val_key]

            elements_list.append(elem_data)
        comp_data["other_elements"] = elements_list

    def collect_data(self, material):
        # Перед тем, как главный редактор заберет данные,
        # мы должны убедиться, что последняя активная категория сохранена во временную копию.
        self._save_current_source()
        # Убедимся, что мы работаем с правильным объектом материала.
        self.material = material


class SourcesManagerTab(ttk.Frame):
    """Вкладка для просмотра всех источников данных и открытия связанных файлов."""

    def __init__(self, parent, app_data, main_app):
        super().__init__(parent)
        self.app_data = app_data
        self._setup_widgets()

    def _setup_widgets(self):
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.sources_tree = ttk.Treeview(
            tree_frame,
            columns=("num", "source", "link"),
            show="headings"
        )

        self.sources_tree.heading("num", text="№")
        self.sources_tree.column("num", width=50, stretch=False, anchor="center")
        self.sources_tree.heading("source", text="Источник")
        self.sources_tree.column("source", width=500)
        self.sources_tree.heading("link", text="Ссылка/Файл")
        self.sources_tree.column("link", width=250)

        self.sources_tree.tag_configure(
            'hyperlink',
            foreground='blue',
            font=('TkDefaultFont', 9, 'underline')
        )

        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.sources_tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.sources_tree.xview)
        self.sources_tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        vsb.pack(side="right", fill="y")
        hsb.pack(side="bottom", fill="x")
        self.sources_tree.pack(fill="both", expand=True)

        self.sources_tree.bind("<Button-1>", self._on_link_click)

    def update_view(self):
        """Собирает все источники и подисточники, ищет файлы и заполняет таблицу."""
        self.sources_tree.delete(*self.sources_tree.get_children())

        # --- ИЗМЕНЕНИЕ 2: Собираем источники и подисточники в один набор ---
        all_sources_set = set()

        def add_sources_from_dict(data_dict):
            """Вспомогательная функция для добавления источника и подисточника."""
            if not data_dict or not isinstance(data_dict, dict):
                return

            # Добавляем основной источник, если он есть
            main_source = data_dict.get("property_source") or data_dict.get("composition_source")
            if main_source:
                all_sources_set.add(main_source)

            # Добавляем подисточник, если он есть
            sub_source = data_dict.get("property_subsource") or data_dict.get("composition_subsource")
            if sub_source:
                all_sources_set.add(sub_source)

        for mat in self.app_data.materials:
            for prop in mat.data.get("physical_properties", {}).values():
                add_sources_from_dict(prop)
            for cat in mat.data.get("mechanical_properties", {}).get("strength_category", []):
                for prop_key, prop_val in cat.items():
                    add_sources_from_dict(prop_val)
                for h_data in cat.get("hardness", []):
                    add_sources_from_dict(h_data)
            for comp in mat.data.get("chemical_properties", {}).get("composition", []):
                add_sources_from_dict(comp)

        sorted_sources = sorted(list(all_sources_set), key=str.lower)

        sources_dir = os.path.join(get_app_directory(), "Источники")

        for i, source_name in enumerate(sorted_sources, start=1):
            file_path = os.path.join(sources_dir, source_name)

            if os.path.isfile(file_path):
                link_text = source_name
                tags = ('hyperlink',)
            else:
                found = False
                # Список популярных расширений документов
                extensions_to_check = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.png']
                for ext in extensions_to_check:
                    path_with_ext = file_path + ext
                    if os.path.isfile(path_with_ext):
                        link_text = os.path.basename(path_with_ext)
                        tags = ('hyperlink',)
                        found = True
                        break
                if not found:
                    link_text = "-"
                    tags = ()

            self.sources_tree.insert(
                "", "end",
                values=(i, source_name, link_text),
                tags=tags
            )

    def _on_link_click(self, event):
        item_id = self.sources_tree.identify_row(event.y)
        if not item_id: return
        column_id = self.sources_tree.identify_column(event.x)
        if column_id != '#3': return
        tags = self.sources_tree.item(item_id, "tags")
        if 'hyperlink' not in tags: return

        # --- ИЗМЕНЕНИЕ: Берем имя файла из колонки "Ссылка", а не "Источник" ---
        file_name_in_cell = self.sources_tree.item(item_id, "values")[2]

        sources_dir = os.path.join(get_app_directory(), "Источники")
        file_path = os.path.join(sources_dir, file_name_in_cell)

        try:
            if sys.platform == "win32":
                os.startfile(file_path)
            elif sys.platform == "darwin":
                subprocess.call(["open", file_path])
            else:
                subprocess.call(["xdg-open", file_path])
        except FileNotFoundError:
            messagebox.showerror("Ошибка", f"Файл не найден:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Ошибка", f"Не удалось открыть файл:\n{e}")


class MainApplication(tk.Tk):
    def __init__(self):
        super().__init__()
        self.app_data = AppData()
        self.title("Material_Lib")
        self.geometry("1200x800")

        # Этот код для горячих клавиш можно оставить или убрать, если он не работает
        self.bind_class("Entry", "<KeyPress>", self._handle_russian_hotkeys)
        self.bind_class("Text", "<KeyPress>", self._handle_russian_hotkeys)
        self.bind_class("ttk::Combobox", "<KeyPress>", self._handle_russian_hotkeys)

        self.create_menu()
        self.create_widgets()

        try:
            default_dir = os.path.join(get_app_directory(), "БД Материалов")
            if os.path.isdir(default_dir):
                self.open_directory(directory=default_dir, show_success_message=False)
        except Exception as e:
            print(f"Ошибка при автоматической загрузке директории по умолчанию: {e}")

    def _handle_russian_hotkeys(self, event):
        is_ctrl_pressed = (event.state & 4) != 0
        if is_ctrl_pressed:
            key = event.keysym.lower()
            if key == 'с':
                event.widget.event_generate("<<Copy>>")
                return "break"
            elif key == 'м':
                event.widget.event_generate("<<Paste>>")
                return "break"
            elif key == 'ч':
                event.widget.event_generate("<<Cut>>")
                return "break"
            elif key == 'ф':
                if isinstance(event.widget, tk.Text):
                    event.widget.tag_add("sel", "1.0", "end")
                elif isinstance(event.widget, tk.Entry):
                    event.widget.selection_range(0, 'end')
                return "break"

    def create_menu(self):
        """Создает главное меню приложения."""
        self.menu_bar = tk.Menu(self)
        self.config(menu=self.menu_bar)

        file_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="Файл", menu=file_menu)
        file_menu.add_command(label="Открыть директорию...", command=self.open_directory)

        file_menu.add_separator()
        file_menu.add_command(label="Выход", command=self.quit)
        self.file_menu = file_menu

        help_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="Справка", menu=help_menu)
        help_menu.add_command(label="Инструкция", command=self.show_instructions)
        help_menu.add_command(label="О приложении", command=self.show_about_info)
        help_menu.add_command(label="Список изменений", command=self.show_change)

    def create_widgets(self):
        """Создает основные виджеты окна."""
        self.main_notebook = ttk.Notebook(self)
        self.main_notebook.pack(expand=True, fill="both", padx=10, pady=10)

        self.viewer_frame = ViewerFrame(self.main_notebook, self.app_data)
        self.editor_frame = EditorFrame(self.main_notebook, self.app_data, self)
        self.sources_frame = SourcesManagerTab(self.main_notebook, self.app_data, self)

        self.main_notebook.add(self.viewer_frame, text="Подбор материала")
        self.main_notebook.add(self.editor_frame, text="Добавление / Редактирование материала")
        self.main_notebook.add(self.sources_frame, text="Работа с источниками")

    def open_directory(self, directory=None, show_success_message=True):
        if not directory:
            filepath = filedialog.askopenfilename(
                title="Выберите любой .json файл в рабочей директории",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
            if filepath:
                directory = os.path.dirname(filepath)
            else:
                return

        if directory:
            try:
                self.app_data.load_materials_from_dir(directory)
                if show_success_message:
                    messagebox.showinfo("Успех", f"Загружено {len(self.app_data.materials)} материалов.")
                self.on_data_load()
            except Exception as e:
                messagebox.showerror("Ошибка", f"Не удалось загрузить данные: {e}")

    def on_data_load(self):
        """Вызывается после загрузки/перезагрузки данных из директории."""
        self.editor_frame.editing_copy = None
        self.app_data.current_material = None
        self.viewer_frame.update_view()
        self.editor_frame.update_view()
        self.sources_frame.update_view()


    def show_about_info(self):
        title = "О приложении"
        message = read_text_from_file("app_list.txt")
        messagebox.showinfo(title, message, parent=self)

    def show_instructions(self):
        instr_window = tk.Toplevel(self)
        instr_window.title("Инструкция по использованию")
        instr_window.geometry("750x600")
        instr_window.minsize(500, 400)
        instruction_text = read_text_from_file("instruction_list.txt")
        text_frame = ttk.Frame(instr_window, padding=10)
        text_frame.pack(fill="both", expand=True)
        text_widget = tk.Text(text_frame, wrap=tk.WORD, state="disabled", font=("Arial", 10), padx=5, pady=5)
        scrollbar = ttk.Scrollbar(text_frame, orient="vertical", command=text_widget.yview)
        text_widget.config(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        text_widget.pack(side="left", fill="both", expand=True)
        text_widget.config(state="normal")
        text_widget.insert("1.0", instruction_text.strip())
        text_widget.config(state="disabled")
        ok_button = ttk.Button(instr_window, text="OK", command=instr_window.destroy)
        ok_button.pack(pady=(0, 10))

    def show_change(self):
        instr_window = tk.Toplevel(self)
        instr_window.title("Список изменений")
        instr_window.geometry("750x600")
        instr_window.minsize(500, 400)
        instruction_text = read_text_from_file("change_list.txt")
        text_frame = ttk.Frame(instr_window, padding=10)
        text_frame.pack(fill="both", expand=True)
        text_widget = tk.Text(text_frame, wrap=tk.WORD, state="disabled", font=("Arial", 10), padx=5, pady=5)
        scrollbar = ttk.Scrollbar(text_frame, orient="vertical", command=text_widget.yview)
        text_widget.config(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        text_widget.pack(side="left", fill="both", expand=True)
        text_widget.config(state="normal")
        text_widget.insert("1.0", instruction_text.strip())
        text_widget.config(state="disabled")
        ok_button = ttk.Button(instr_window, text="OK", command=instr_window.destroy)
        ok_button.pack(pady=(0, 10));


if __name__ == "__main__":
    app = MainApplication()
    app.mainloop()
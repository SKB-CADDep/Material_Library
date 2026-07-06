# План декомпозиции Material Library

Проверка схемы против [`tasks.md`](tasks.md) / [`tasks_roadmap.md`](tasks_roadmap.md).

**Стек (решение команды):** **FastAPI** + **React** + **pywebview** (вместо PyQt).

**Gate фазы 2:** задачи **18 → 19 → 20 → 23 → 25** закрыты, миграция прогнана на всей библиотеке, smoke-тест API+React = паритет с Tkinter.

---

## 1. Целевая структура каталогов

```
Material_Library/
├── main.py                          # Точка входа десктопа: pywebview-лаунчер (или dev: только API)
├── pyproject.toml
├── requirements.txt                 # FastAPI, uvicorn, pywebview, jsonschema, …
│
├── backend/                         # FastAPI-приложение
│   ├── main.py                      # app = FastAPI()
│   ├── dependencies.py              # StorageBackend, сервисы
│   └── routers/
│       ├── materials.py
│       ├── sources.py
│       ├── catalogs.py              # properties, units, elements, hardness
│       ├── selection.py             # подбор, расчёт, сравнение, эшби
│       └── help.py                  # docs/*.md
│
├── frontend/                        # React SPA
│   ├── package.json
│   ├── src/
│   │   ├── api/                     # клиент к OpenAPI
│   │   ├── pages/
│   │   │   ├── Selection/           # 5 вкладок подбора
│   │   │   ├── Editor/              # 4 вкладки редактора
│   │   │   └── Sources/
│   │   ├── components/              # таблицы, графики, фильтры, tooltips
│   │   └── App.tsx
│   └── dist/                        # сборка для production / pywebview
│
├── desktop/
│   ├── launcher.py                  # single instance, splash, uvicorn, pywebview
│   └── config.py                    # порт, пути, dev/prod
│
├── config/
│   ├── physical_properties.json
│   ├── mechanical_properties.json
│   ├── units_registry.json
│   ├── hardness_table.json
│   ├── elements_catalog.json
│   ├── classification.json
│   └── app_manifest.json
│
├── schema/
│   ├── material.schema.json
│   └── CHANGELOG_SCHEMA.md
│
├── migrations/
│   ├── base.py
│   └── v1_0_to_v2_0.py
│
├── docs/
│   ├── instruction.md
│   ├── about.md
│   ├── changelog.md
│   └── tasks/
│       └── intern_34_elements_catalog.md
│
├── src/                             # общая бизнес-логика (без UI)
│   ├── core/
│   │   ├── schema_keys.py
│   │   ├── models/material.py
│   │   ├── models/source.py
│   │   └── math/interpolation.py
│   │
│   ├── services/
│   │   ├── interfaces.py
│   │   ├── material_repository.py
│   │   ├── source_service.py
│   │   ├── properties_catalog.py
│   │   ├── unit_converter.py
│   │   ├── hardness_table.py
│   │   ├── elements_catalog.py
│   │   ├── material_validator.py
│   │   ├── changelog_service.py
│   │   ├── larson_miller.py
│   │   └── audit_service.py
│   │
│   └── infrastructure/
│       ├── paths.py
│       ├── storage_backend.py       # LocalDirectoryStorage (десктоп)
│       └── single_instance.py
│
├── platform/
│   ├── build_onedir.py              # PyInstaller: launcher + backend + frontend/dist
│   └── updater.py
│
├── tests/
│   ├── test_math_utils.py
│   ├── test_unit_converter.py
│   ├── test_migration_v1_v2.py
│   └── test_api_materials.py
│
├── scripts/
│   ├── extract_elements_catalog.py
│   └── validate_elements_catalog.py
│
└── main_legacy.py                   # опционально: старый Tkinter до полного паритета
```

**Принцип:** `src/services/` не знает про React и pywebview. `backend/` — тонкий HTTP-слой. `frontend/` — только UI. `desktop/` — только запуск.

---

## 2. Полный порядок работ

### Блок A. Согласование · задача 18

1. Утвердить структуру (этот документ).
2. Контракты в `services/interfaces.py` + черновик OpenAPI.
3. Блокеры: **сдаточная** (2.1), **колонка НТД** (8).

---

### Блок B. Схема и конфиги · 19 → 20 → 29 → 24

| Шаг | Задача | Действие |
|-----|--------|----------|
| B1 | **19** | `schema/material.schema.json`, `schema_version: "2.0"` |
| B2 | **20** | `config/physical_properties.json` + `mechanical_properties.json`; типы δ/ψ/угол |
| B3 | **29** | `config/hardness_table.json` + `HardnessTable` сервис |
| B4 | **24** | `config/units_registry.json` + `display_labels`; удалить REGISTRY из кода |
| B5 | **21** | `config/classification.json` |
| B6 | **22** | `tolerance_type` в schema химии |

---

### Блок C. Миграция · 23

`migrations/` → прогон на полной библиотеке → gate.

---

### Блок D. Вынос логики из main.py · параллельно B–C

| Модуль | Откуда в main.py |
|--------|------------------|
| `core/schema_keys.py` | class Schema |
| `core/math/interpolation.py` | MathUtils |
| `core/models/material.py` | class Material |
| `services/source_service.py` | SourceManager |
| `services/unit_converter.py` | UnitManager |
| `services/properties_catalog.py` | PHYSICAL/MECHANICAL_MAP |
| `services/material_repository.py` | AppData |
| `services/changelog_service.py` | find_changes |
| `infrastructure/storage_backend.py` | работа с папкой JSON |

**Проверка:** unit-тесты без UI.

---

### Блок E. FastAPI + React + pywebview · 25

| Шаг | Задача | Действие |
|-----|--------|----------|
| E1 | **25.1** | `backend/`: FastAPI, роутеры, `StorageBackend`, OpenAPI |
| E2 | **25.2** | `frontend/`: React-каркас, 3 раздела, вкладки, API-клиент |
| E3 | **25.2** | Таблицы (AG Grid), графики (plotly/recharts), общие виджеты |
| E4 | **25.3** | `desktop/launcher.py`: uvicorn + pywebview |
| E5 | **1** | Splash + single instance в лаунчере |
| E6 | — | **Smoke-тест:** загрузка папки, подбор, сохранение = паритет Tkinter |

**Не делать на E-этапе:** сдаточные, Larson, мультивыбор — фаза 2.

**Параллельно (стажёр):** **34.0** — `elements_catalog.json` без UI.

---

### Блок F. Инфраструктура релиза · 26, 27, 28, 37, 38

| Задача | Действие |
|--------|----------|
| **28** | CRUD источников в React |
| **37** | Убрать AI из текстов |
| **38** | `docs/*.md`, React рендерит справку |
| **26** | `platform/build_onedir.py`: launcher + backend + `frontend/dist` + config |
| **27** | `platform/updater.py` по B+_desktop |

---

### Блок G. Справочники · 34, 36

| Задача | Действие |
|--------|----------|
| **34** | API + React: `elements_catalog`, CRUD, `display_symbol` (O₂) |
| **36** | Подписи свойств из `display_labels` |
| — | Удалить `element_tooltips`, `ELEMENTS_MAP` из legacy-кода |

---

### Блок H. Фаза 2

Порядок — [`tasks_roadmap.md`](tasks_roadmap.md). Все UI-изменения — в `frontend/`, расчёты — в `src/services/` + API.

---

## 3. Соответствие слоёв

```
┌─────────────────────────────────────────────────────────┐
│  pywebview (desktop/launcher.py)                        │
│       │                                                   │
│       ▼                                                   │
│  React SPA (frontend/)  ──HTTP──►  FastAPI (backend/)    │
│                                         │                 │
│                                         ▼                 │
│                              src/services/ + src/core/    │
│                                         │                 │
│                                         ▼                 │
│                              StorageBackend → JSON на диске│
└─────────────────────────────────────────────────────────┘

Будущий веб: тот же React + FastAPI на сервере (без pywebview).
```

---

## 4. Что отменено

| Было | Статус |
|------|--------|
| PyQt6 (`src/ui/` на Qt) | **Отменено** → React |
| Блок N (tkinter-рефакторинг 30–41) | **Отменено** → фаза 1 |
| `main.py` как единственный UI | **Legacy** до паритета; новый UI — React |

---

## 5. Минимальные вехи

- [ ] **M1:** schema v2.0 + properties + units_registry + hardness_table
- [ ] **M2:** migration v1→v2 на всей БД
- [ ] **M3:** сервисы + unit-тесты; `main.py` (Tkinter) не раздувается
- [ ] **M4:** FastAPI OpenAPI + React smoke (загрузка материала)
- [ ] **M5:** pywebview десктоп = паритет с Tkinter
- [ ] **M6:** CRUD источников, docs md, elements_catalog
- [ ] **M7:** onedir-сборка + updater
- [ ] **M8:** фаза 2 P1 закрыты
- [ ] **M9:** релиз

---

## 6. Оценка трудоёмкости (ориентир)

| Блок | Часы |
|------|------|
| A + B + C + D (данные, сервисы) | 60–80 |
| E (API + React + pywebview) | 100–150 |
| F + G (инфра, справочники) | 40–60 |
| H (фаза 2) | 40–60 |
| **Итого** | **~240–350** |

Параллельно: backend (E1) и frontend (E2) от OpenAPI-контракта после блока D.

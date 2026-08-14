from __future__ import annotations

from pathlib import Path

from src.core.models.material import Material
from src.core.schema_keys import Schema
from src.infrastructure.storage_backend import LocalDirectoryStorage
from src.services.source_service import SourceService


class MaterialRepository:
    """Состояние рабочей папки: материалы, области применения, источники."""

    def __init__(
        self,
        source_service: SourceService | None = None,
        storage: LocalDirectoryStorage | None = None,
    ):
        self.work_dir: str = ""
        self.materials: list[Material] = []
        self.application_areas: list[str] = []
        self.current_material: Material | None = None
        self.source_manager = source_service or SourceService()
        self._storage = storage

    def load_materials_from_dir(self, directory: str | Path) -> None:
        directory = Path(directory)
        self.work_dir = str(directory)
        self.materials.clear()
        self._storage = LocalDirectoryStorage(directory)

        if not directory.is_dir():
            self.application_areas = []
            return

        for path in self._storage.list_material_paths():
            try:
                self.materials.append(Material(filepath=str(path)))
            except Exception as e:
                print(f"Ошибка чтения {path.name}: {e}")

        self.materials.sort(key=lambda m: m.get_display_name())
        self.load_application_areas()

    def load_application_areas(self) -> None:
        all_areas: set[str] = set()
        for m in self.materials:
            all_areas.update(m.data.get(Schema.METADATA, {}).get(Schema.APP_AREA, []))
        self.application_areas = sorted(all_areas)

    def get_by_id(self, material_id: str) -> Material | None:
        for m in self.materials:
            if m.data.get("material_id") == material_id:
                return m
        return None

    def list_summary(self) -> list[dict]:
        result = []
        for m in self.materials:
            meta = m.data.get(Schema.METADATA, {})
            chem = m.data.get(Schema.CHEMICAL, {}) or {}
            composition = chem.get(Schema.COMPOSITION, []) or []
            result.append({
                "id": m.data.get("material_id"),
                "name": m.get_display_name(),
                "areas": meta.get(Schema.APP_AREA, []),
                "filename": m.filename,
                "has_composition": len(composition) > 0,
            })
        return result

    def list_chem_composition_entries(self) -> list[dict]:
        entries: list[dict] = []
        for material in self.materials:
            chem = material.data.get(Schema.CHEMICAL, {}) or {}
            composition = chem.get(Schema.COMPOSITION, []) or []
            if not composition:
                continue

            meta = material.data.get(Schema.METADATA, {})
            material_id = str(material.data.get("material_id", ""))
            for comp in composition:
                entries.append(
                    {
                        "material_id": material_id,
                        "material_name": material.get_display_name(),
                        "areas": meta.get(Schema.APP_AREA, []),
                        "composition": comp,
                    }
                )
        return entries

    def save_material(self, material: Material) -> None:
        if not material.filepath:
            raise ValueError("Путь для сохранения не указан")
        if not self.work_dir:
            raise ValueError("Workspace не открыт")

        material_path = Path(material.filepath)
        is_new_file = self._storage is None or not self._storage.exists(material_path)
        material.save()

        if is_new_file:
            self.materials.append(material)
        self.materials.sort(key=lambda m: m.get_display_name())
        self.load_application_areas()

    def materials_using_source(self, source_id: str) -> list[Material]:
        if not source_id:
            return []
        return [material for material in self.materials if material.uses_source_ref(source_id)]


AppData = MaterialRepository

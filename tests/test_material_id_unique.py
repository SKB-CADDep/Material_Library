from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from src.core.models.material import Material
from src.services.material_repository import (
    DuplicateMaterialIdError,
    MaterialRepository,
)


def _minimal(material_id: str, name: str) -> dict:
    return {
        "material_id": material_id,
        "metadata": {
            "name_material_standard": name,
            "application_area": [],
        },
        "chemical_properties": {"composition": []},
        "mechanical_properties": {"strength_category": []},
        "physical_properties": {},
    }


def test_load_skips_duplicate_material_id(tmp_path: Path):
    shared = "dup-id-0001"
    (tmp_path / "a_first.json").write_text(
        json.dumps(_minimal(shared, "Alpha"), ensure_ascii=False),
        encoding="utf-8",
    )
    (tmp_path / "z_second.json").write_text(
        json.dumps(_minimal(shared, "Zeta"), ensure_ascii=False),
        encoding="utf-8",
    )

    repo = MaterialRepository()
    repo.load_materials_from_dir(tmp_path)

    assert len(repo.materials) == 1
    assert repo.materials[0].filename == "a_first.json"
    assert repo.get_by_id(shared) is not None


def test_save_rejects_duplicate_material_id(tmp_path: Path):
    mid_a = str(uuid4())
    mid_b = str(uuid4())
    path_a = tmp_path / "mat_a.json"
    path_b = tmp_path / "mat_b.json"
    path_a.write_text(json.dumps(_minimal(mid_a, "A"), ensure_ascii=False), encoding="utf-8")
    path_b.write_text(json.dumps(_minimal(mid_b, "B"), ensure_ascii=False), encoding="utf-8")

    repo = MaterialRepository()
    repo.load_materials_from_dir(tmp_path)

    conflict = Material(data=_minimal(mid_a, "Clone"))
    conflict.filepath = str(path_b)

    try:
        repo.save_material(conflict)
        raised = None
    except DuplicateMaterialIdError as e:
        raised = e

    assert raised is not None
    assert mid_a in str(raised)
    # исходный файл B не перезаписан чужим id
    saved_b = json.loads(path_b.read_text(encoding="utf-8"))
    assert saved_b["material_id"] == mid_b


def test_post_rejects_duplicate_material_id(client, material_id, open_workspace):
    detail = client.get(f"/api/materials/{material_id}").json()
    duplicate = json.loads(json.dumps(detail))
    # тот же id, новый файл
    new_filename = f"dup_id_{uuid4().hex[:8]}.json"

    response = client.post(
        "/api/materials",
        json=duplicate,
        params={"filename": new_filename},
    )
    assert response.status_code == 409
    assert "material_id" in response.json()["detail"]
    assert not (Path(open_workspace["directory"]) / new_filename).exists()

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4


def test_post_material_creates_new_file_without_touching_original(
    client,
    material_id,
    open_workspace,
):
    detail = client.get(f"/api/materials/{material_id}").json()
    original_name = detail["metadata"]["name_material_standard"]
    materials_before = client.get("/api/materials").json()
    original_item = next(item for item in materials_before if item["id"] == material_id)
    original_path = Path(open_workspace["directory"]) / original_item["filename"]
    original_bytes = original_path.read_bytes()

    new_id = str(uuid4())
    new_body = json.loads(json.dumps(detail))
    new_body["material_id"] = new_id
    new_body["metadata"]["name_material_standard"] = "SaveAsNewFileApiTest"
    new_filename = f"save_as_new_{uuid4().hex[:8]}.json"

    response = client.post(
        "/api/materials",
        json=new_body,
        params={"filename": new_filename},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == new_filename

    assert original_path.read_bytes() == original_bytes
    reloaded_original = client.get(f"/api/materials/{material_id}").json()
    assert reloaded_original["metadata"]["name_material_standard"] == original_name

    new_path = Path(open_workspace["directory"]) / new_filename
    assert new_path.is_file()
    new_data = json.loads(new_path.read_text(encoding="utf-8"))
    assert new_data["material_id"] == new_id

    new_path.unlink(missing_ok=True)


def test_post_material_rejects_duplicate_filename(client, material_id, open_workspace):
    detail = client.get(f"/api/materials/{material_id}").json()
    materials = client.get("/api/materials").json()
    existing_filename = next(item for item in materials if item["id"] == material_id)["filename"]

    duplicate = json.loads(json.dumps(detail))
    duplicate["material_id"] = str(uuid4())

    response = client.post(
        "/api/materials",
        json=duplicate,
        params={"filename": existing_filename},
    )
    assert response.status_code == 409

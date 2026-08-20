import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.dependencies import get_app_state
from backend.settings import MATERIALS_DIR_ENV

@pytest.fixture
def source_id(client):
    response = client.post("/api/sources",
        json={
            "group": "property_sources",
            "name": "Тест API",
            "description": "smoke",
            "hyperlink": "https://example.com",
        })
    assert response.status_code == 201
    sid = response.json()["id_source"]
    yield sid
    client.delete(f"/api/sources/{sid}")

def test_get_health(monkeypatch):
    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)
    get_app_state.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "workspace": None, "materials_dir": None}

def test_workspace_open(client):
    user_data = {"directory": "C:\\Users\\Лиза\\Desktop\\jbsidian\\data"}
    response = client.post("/api/workspace/open", json=user_data)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 0
    assert data["directory"] == user_data["directory"]

def test_get_workspace(client, open_workspace):
    response = client.get("/api/workspace")
    data = response.json()
    assert response.status_code == 200
    assert data["count"] > 0
    assert data["directory"] == open_workspace["directory"]

def test_get_health_after_open(client, open_workspace):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["workspace"] == open_workspace["directory"]
    assert "materials_dir" in payload

def test_get_materials(client, open_workspace):
    response = client.get("/api/materials")
    data = response.json()
    assert isinstance(data, list)
    item = data[0]
    assert {"id", "name", "areas", "filename"} <= set(item.keys())
    assert response.status_code == 200

def test_get_materials_by_id(client, material_id):
    response = client.get(f"/api/materials/{material_id}")
    assert response.status_code == 200
    assert response.json()["material_id"] == material_id

def test_get_properties(client):
    response = client.get(f"/api/catalogs/properties")
    data = response.json()
    assert response.status_code == 200
    assert len(data["physical"]) > 0
    assert len(data["mechanical"]) > 0

def test_get_classification_catalog(client):
    response = client.get("/api/catalogs/classification")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert len(data["categories"]) > 0
    first = data["categories"][0]
    assert "name" in first
    assert "classes" in first
    assert len(first["classes"]) > 0
    assert "subclasses" in first["classes"][0]

def test_get_columns(client):
    response = client.get("/api/catalogs/hardness/columns")
    data = response.json()
    assert response.status_code == 200
    assert data["columns"] is not None
    assert data["system_unit"] == "HB"

def test_post_convert(client):
    usage_data = {"value":600, "from_unit": "HB", "to_unit": "HRC"}
    response = client.post("/api/catalogs/hardness/convert", json=usage_data)
    data = response.json()
    assert response.status_code == 200
    assert data["result"] is not None

def test_get_sources(client):
    response = client.get("/api/sources")
    assert response.status_code == 200
    data = response.json()
    assert {"property_sources", "strength_sources", "chemical_sources"} <= set(data.keys())
    for group in ("property_sources", "strength_sources", "chemical_sources"):
        assert isinstance(data[group], list)
        if data[group]:
            assert {
                "id_source",
                "name_source",
                "description",
                "hyperlink",
                "user_name_change",
                "data_change",
                "user_name_found",
                "data_found",
            } <= set(data[group][0].keys())

SOURCE_ITEM_FIELDS = {
    "id_source",
    "name_source",
    "description",
    "hyperlink",
    "user_name_change",
    "data_change",
    "user_name_found",
    "data_found",
}

def test_post_sources(client):
    usage_data = {
        "group": "property_sources",
        "name": "Тест API",
        "description": "smoke",
        "hyperlink": "https://example.com"
    }
    response = client.post("/api/sources", json=usage_data)
    data = response.json()
    assert response.status_code == 201
    assert SOURCE_ITEM_FIELDS <= set(data.keys())
    assert data["name_source"] == "Тест API"
    assert data["id_source"]

def test_get_sources_by_id(client, source_id):
    response = client.get(f"/api/sources/{source_id}")
    assert response.status_code == 200
    assert SOURCE_ITEM_FIELDS <= set(response.json().keys())

def test_update_source(client, source_id):
    usage_data = { "name": "Тест API (обновлён)", "description": "smoke", "hyperlink": "" }
    response = client.put(f"/api/sources/{source_id}", json=usage_data)
    assert response.status_code == 200
    data = response.json()
    assert SOURCE_ITEM_FIELDS <= set(data.keys())
    assert data["name_source"] == "Тест API (обновлён)"

def test_post_source_rejects_empty_name(client):
    response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "",
            "description": "",
            "hyperlink": "",
        },
    )
    assert response.status_code == 422

def test_post_source_rejects_whitespace_name(client):
    response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "   ",
            "description": "",
            "hyperlink": "",
        },
    )
    assert response.status_code == 422

def test_update_source_rejects_empty_name(client, source_id):
    response = client.put(
        f"/api/sources/{source_id}",
        json={
            "name": "",
            "description": "",
            "hyperlink": "",
        },
    )
    assert response.status_code == 422

def test_delete_source(client, source_id):
    response = client.delete(f"/api/sources/{source_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True

def test_delete_unused_source_with_open_workspace(client, open_workspace):
    create_response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "Источник для удаления",
            "description": "",
            "hyperlink": "",
        },
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id_source"]

    delete_response = client.delete(f"/api/sources/{source_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["ok"] is True

def test_get_false_workspace(client):
    user_data = {"directory": "/no/such/data"}
    response = client.post("/api/workspace/open", json=user_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "Путь не существует"

def test_get_false_materials(client):
    response = client.get("/api/materials")
    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace не открыт"

def test_get_nonexistent_id(client, open_workspace):
    response = client.get("/api/materials/0000000-0000000000-00000000000")
    assert response.status_code == 404

def test_get_nonexistant_source(client):
    response = client.get("/api/sources/000000000-0000")
    assert response.status_code == 404


def test_put_material_updates_list_summary_name(client, material_id):
    detail = client.get(f"/api/materials/{material_id}").json()
    original_name = detail["metadata"]["name_material_standard"]
    test_name = "B6bListSummaryTest"
    detail["metadata"]["name_material_standard"] = test_name
    detail["metadata"]["name_material_alternative"] = []

    put = client.put(f"/api/materials/{material_id}", json=detail)
    assert put.status_code == 200

    materials = client.get("/api/materials").json()
    item = next(item for item in materials if item["id"] == material_id)
    assert item["name"] == test_name

    detail["metadata"]["name_material_standard"] = original_name
    restore = client.put(f"/api/materials/{material_id}", json=detail)
    assert restore.status_code == 200


def test_put_material_normalizes_alternatives_to_string_list(client, material_id):
    detail = client.get(f"/api/materials/{material_id}").json()
    original_alts = detail["metadata"].get("name_material_alternative", [])
    detail["metadata"]["name_material_alternative"] = " Alt A , Alt B "

    put = client.put(f"/api/materials/{material_id}", json=detail)
    assert put.status_code == 200

    reloaded = client.get(f"/api/materials/{material_id}").json()
    assert reloaded["metadata"]["name_material_alternative"] == ["Alt A", "Alt B"]

    materials = client.get("/api/materials").json()
    item = next(item for item in materials if item["id"] == material_id)
    assert "Alt A" in item["name"]

    detail["metadata"]["name_material_alternative"] = original_alts
    restore = client.put(f"/api/materials/{material_id}", json=detail)
    assert restore.status_code == 200
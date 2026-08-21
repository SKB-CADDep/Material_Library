"""negative API responses (404 / 409 / 422)."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.dependencies import get_app_state
from backend.settings import MATERIALS_DIR_ENV
from tests.fixtures.workspace_paths import FIXTURE_FULL_ID, FIXTURE_PROPERTY_SOURCE_ID

UNKNOWN_MATERIAL_ID = "00000000-0000-4000-8000-000000009999"
UNKNOWN_SOURCE_ID = "00000000-0000-4000-8000-000000000088"


@pytest.fixture
def closed_workspace(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


@pytest.fixture
def sources_without_materials_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from backend.settings import SOURCE_JSON_PATH_ENV

    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)
    workspace = tmp_path / "sources_only"
    workspace.mkdir()
    source_file = workspace / "source.json"
    source_file.write_text(
        '{"property_sources":[],"strength_sources":[],"chemical_sources":[]}',
        encoding="utf-8",
    )
    monkeypatch.setenv(SOURCE_JSON_PATH_ENV, str(source_file))
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()




def test_get_workspace_returns_404_when_closed(client, closed_workspace) -> None:
    response = client.get("/api/workspace")
    assert response.status_code == 404
    assert "не открыт" in response.json()["detail"].lower()


def test_workspace_open_rejects_missing_directory(client, closed_workspace) -> None:
    response = client.post(
        "/api/workspace/open",
        json={"directory": "/no/such/workspace/path"},
    )
    assert response.status_code == 400
    assert "не существует" in response.json()["detail"].lower()


def test_workspace_open_rejects_file_path(
    client,
    closed_workspace,
    tmp_path,
) -> None:
    file_path = tmp_path / "not-a-dir.json"
    file_path.write_text("{}", encoding="utf-8")
    response = client.post("/api/workspace/open", json={"directory": str(file_path)})
    assert response.status_code == 400
    assert "не каталог" in response.json()["detail"].lower()


def test_workspace_open_rejects_invalid_body(client, closed_workspace) -> None:
    response = client.post("/api/workspace/open", json={})
    assert response.status_code == 422



@pytest.mark.parametrize(
    ("method", "path", "json_body", "params"),
    [
        ("GET", "/api/materials", None, None),
        ("GET", f"/api/materials/{UNKNOWN_MATERIAL_ID}", None, None),
        (
            "PUT",
            f"/api/materials/{UNKNOWN_MATERIAL_ID}",
            {
                "material_id": UNKNOWN_MATERIAL_ID,
                "metadata": {"name_material_standard": "X"},
            },
            None,
        ),
        (
            "POST",
            "/api/materials",
            {
                "material_id": UNKNOWN_MATERIAL_ID,
                "metadata": {"name_material_standard": "X"},
            },
            {"filename": "new-material.json"},
        ),
    ],
)
def test_materials_endpoints_require_open_workspace(
    client,
    closed_workspace,
    method: str,
    path: str,
    json_body: dict | None,
    params: dict | None,
) -> None:
    response = client.request(method, path, json=json_body, params=params)
    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace не открыт"


def test_get_material_unknown_id_returns_404(client, open_workspace) -> None:
    response = client.get(f"/api/materials/{UNKNOWN_MATERIAL_ID}")
    assert response.status_code == 404


def test_put_material_unknown_id_returns_404(client, open_workspace) -> None:
    response = client.put(
        f"/api/materials/{UNKNOWN_MATERIAL_ID}",
        json={
            "material_id": UNKNOWN_MATERIAL_ID,
            "metadata": {"name_material_standard": "Missing"},
        },
    )
    assert response.status_code == 404


def test_put_material_rejects_mismatched_id(
    client,
    open_workspace,
    material_id: str,
) -> None:
    detail = client.get(f"/api/materials/{material_id}").json()
    detail["material_id"] = UNKNOWN_MATERIAL_ID
    response = client.put(f"/api/materials/{material_id}", json=detail)
    assert response.status_code == 400
    assert "не совпадают" in response.json()["detail"].lower()


def test_put_material_rejects_missing_metadata(
    client,
    open_workspace,
    material_id: str,
) -> None:
    detail = client.get(f"/api/materials/{material_id}").json()
    detail.pop("metadata", None)
    response = client.put(f"/api/materials/{material_id}", json=detail)
    assert response.status_code == 400
    assert "отсутствуют" in response.json()["detail"].lower()



def test_get_unknown_source_returns_404(client, open_workspace) -> None:
    response = client.get(f"/api/sources/{UNKNOWN_SOURCE_ID}")
    assert response.status_code == 404


def test_put_unknown_source_returns_404(client, open_workspace) -> None:
    response = client.put(
        f"/api/sources/{UNKNOWN_SOURCE_ID}",
        json={"name": "Missing", "description": "", "hyperlink": ""},
    )
    assert response.status_code == 404


def test_delete_unknown_source_returns_404(client, open_workspace) -> None:
    response = client.delete(f"/api/sources/{UNKNOWN_SOURCE_ID}")
    assert response.status_code == 404


def test_post_source_rejects_invalid_group_returns_422(client, open_workspace) -> None:
    response = client.post(
        "/api/sources",
        json={
            "group": "invalid_group",
            "name": "Bad group",
            "description": "",
            "hyperlink": "",
        },
    )
    assert response.status_code == 422


def test_get_source_usage_requires_open_workspace(
    client,
    sources_without_materials_workspace,
) -> None:
    created = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "T2g closed workspace usage",
            "description": "",
            "hyperlink": "",
        },
    )
    assert created.status_code == 201
    source_id = created.json()["id_source"]

    response = client.get(f"/api/sources/{source_id}/usage")
    assert response.status_code == 409
    assert "не открыта" in response.json()["detail"].lower()


def test_delete_source_requires_open_workspace_for_usage_check(
    client,
    sources_without_materials_workspace,
) -> None:
    created = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "T2g closed workspace delete",
            "description": "",
            "hyperlink": "",
        },
    )
    assert created.status_code == 201
    source_id = created.json()["id_source"]

    response = client.delete(f"/api/sources/{source_id}")
    assert response.status_code == 409
    assert "не открыта" in response.json()["detail"].lower()


def test_delete_source_in_use_returns_409(client, open_workspace) -> None:
    response = client.delete(f"/api/sources/{FIXTURE_PROPERTY_SOURCE_ID}")
    assert response.status_code == 409
    assert "материал" in response.json()["detail"].lower()



@pytest.mark.parametrize(
    ("method", "path", "json_body"),
    [
        ("POST", "/api/selection/temperature", {"prop_type": "physical", "temperature": 20}),
        (
            "POST",
            "/api/selection/calculate",
            {"material_id": FIXTURE_FULL_ID, "category_index": 0},
        ),
        ("GET", "/api/selection/chem/composition-entries", None),
    ],
)
def test_selection_endpoints_require_open_workspace(
    client,
    closed_workspace,
    method: str,
    path: str,
    json_body: dict | None,
) -> None:
    response = client.request(method, path, json=json_body)
    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace не открыт"


def test_temperature_selection_rejects_invalid_prop_type(
    client,
    open_workspace,
) -> None:
    response = client.post(
        "/api/selection/temperature",
        json={"prop_type": "invalid", "temperature": 20},
    )
    assert response.status_code == 422


def test_temperature_selection_rejects_empty_body(
    client,
    open_workspace,
) -> None:
    response = client.post("/api/selection/temperature", json={})
    assert response.status_code == 422


def test_calculate_unknown_material_returns_404(client, open_workspace) -> None:
    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": UNKNOWN_MATERIAL_ID,
            "category_index": 0,
            "custom_temperatures": [],
        },
    )
    assert response.status_code == 404


def test_calculate_invalid_category_index_returns_404(
    client,
    material_with_composition: str,
) -> None:
    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": material_with_composition,
            "category_index": 99,
            "custom_temperatures": [],
        },
    )
    assert response.status_code == 404
    assert "category_index" in response.json()["detail"].lower()


def test_calculate_rejects_empty_body(client, open_workspace) -> None:
    response = client.post("/api/selection/calculate", json={})
    assert response.status_code == 422


def test_ashby_rejects_empty_body(client, open_workspace) -> None:
    response = client.post("/api/selection/ashby", json={})
    assert response.status_code == 422

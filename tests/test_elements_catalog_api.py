"""API CRUD для справочника элементов."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from src.services import elements_catalog as elements_catalog_mod


@pytest.fixture()
def elements_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    catalog_path = tmp_path / "elements_catalog.json"
    catalog_path.write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "elements": [
                    {
                        "symbol": "C",
                        "display_symbol": "C",
                        "name": "Углерод",
                        "color": "#2B2B2B",
                        "influence": "Углерод.\nПовышает: Прочность.\nСнижает: -.",
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(elements_catalog_mod, "_catalog_path", lambda: catalog_path)
    monkeypatch.setattr(elements_catalog_mod, "_frontend_catalog_path", lambda: None)
    elements_catalog_mod._catalog = None

    with TestClient(app) as client:
        yield client

    elements_catalog_mod._catalog = None


def test_get_elements_catalog(elements_client: TestClient) -> None:
    response = elements_client.get("/api/catalogs/elements")
    assert response.status_code == 200
    data = response.json()
    assert data["schema_version"] == "1.0"
    assert len(data["elements"]) == 1
    assert data["elements"][0]["symbol"] == "C"


def test_create_update_delete_element(elements_client: TestClient) -> None:
    create = elements_client.post(
        "/api/catalogs/elements",
        json={
            "symbol": "Fe",
            "name": "Железо",
            "display_symbol": "Fe",
            "color": "#8C3E26",
            "influence": None,
        },
    )
    assert create.status_code == 200
    assert create.json()["symbol"] == "Fe"

    update = elements_client.put(
        "/api/catalogs/elements/Fe",
        json={"name": "Железо (основа)", "color": None},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Железо (основа)"
    assert update.json()["color"] is None

    conflict = elements_client.post(
        "/api/catalogs/elements",
        json={"symbol": "C", "name": "Дубль"},
    )
    assert conflict.status_code == 400

    delete = elements_client.delete("/api/catalogs/elements/Fe")
    assert delete.status_code == 200
    assert delete.json()["ok"] is True

    missing = elements_client.get("/api/catalogs/elements/Fe")
    assert missing.status_code == 404

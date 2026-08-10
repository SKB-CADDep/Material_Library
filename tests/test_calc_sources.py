from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from tests.test_smoke_data_paths import _prepare_smoke_workspace

BRACKET_SOURCE_ID = re.compile(r"^\[(\d+)\]$")


def _source_index(sources: list[dict], source_id: str) -> int:
    for index, item in enumerate(sources):
        if item.get("id_source") == source_id:
            return index
    return -1


def _resolve_bracket_ref(sub: str, property_sources: list[dict]) -> str | None:
    match = BRACKET_SOURCE_ID.match(sub.strip())
    if not match:
        return None
    index = int(match.group(1)) - 1
    if index < 0 or index >= len(property_sources):
        return None
    return property_sources[index].get("id_source")


def _resolve_strength_name(cat: dict, strength_sources: list[dict]) -> str:
    ref_id = str(cat.get("source_ref_id") or "").strip()
    if ref_id:
        for src in strength_sources:
            if src.get("id_source") == ref_id:
                return str(src.get("name_source") or "")
        return ref_id
    return str(cat.get("source_strength_category") or "").strip()


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


def test_calc_source_refs_and_ntd_after_crud(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
) -> None:
    workspace = tmp_path / "materials"
    _prepare_smoke_workspace(workspace)
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(workspace))

    property_name = "28f Calc Property Source"
    strength_name = "28f Calc Strength Source"

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

        materials = client.get("/api/materials").json()
        assert materials
        mat_id = materials[0]["id"]

        prop_created = client.post(
            "/api/sources",
            json={
                "group": "property_sources",
                "name": property_name,
                "description": "28f",
                "hyperlink": "",
            },
        )
        assert prop_created.status_code == 201
        property_id = prop_created.json()["id_source"]

        strength_created = client.post(
            "/api/sources",
            json={
                "group": "strength_sources",
                "name": strength_name,
                "description": "28f NTD",
                "hyperlink": "",
            },
        )
        assert strength_created.status_code == 201
        strength_id = strength_created.json()["id_source"]

        listed = client.get("/api/sources").json()
        property_sources = listed["property_sources"]
        strength_sources = listed["strength_sources"]

        prop_index = _source_index(property_sources, property_id)
        assert prop_index >= 0
        bracket_label = f"[{prop_index + 1}]"
        resolved_id = _resolve_bracket_ref(bracket_label, property_sources)
        assert resolved_id == property_id

        material = client.get(f"/api/materials/{mat_id}").json()
        material["physical_properties"]["modulus_elasticity"]["source_ref_id"] = property_id
        material["physical_properties"]["modulus_elasticity"]["property_subsource"] = bracket_label

        categories = material["mechanical_properties"].get("strength_category") or []
        assert categories, "smoke material must have strength categories"
        categories[0]["source_ref_id"] = strength_id
        categories[0]["source_strength_category"] = strength_name
        material["mechanical_properties"]["strength_category"] = categories

        assert client.put(f"/api/materials/{mat_id}", json=material).status_code == 200

        listed_after_bind = client.get("/api/sources").json()
        ntd_name = _resolve_strength_name(
            categories[0],
            listed_after_bind["strength_sources"],
        )
        assert ntd_name == strength_name

        calc = client.post(
            "/api/selection/calculate",
            json={
                "material_id": mat_id,
                "category_index": 0,
                "custom_temperatures": [],
            },
        )
        assert calc.status_code == 200
        assert calc.json().get("db_rows")

        renamed = client.put(
            f"/api/sources/{property_id}",
            json={"name": f"{property_name} (edited)", "description": "28f", "hyperlink": ""},
        )
        assert renamed.status_code == 200

        listed_after_edit = client.get("/api/sources").json()
        assert _source_index(listed_after_edit["property_sources"], property_id) == prop_index
        assert (
            _resolve_bracket_ref(bracket_label, listed_after_edit["property_sources"])
            == property_id
        )

        assert client.delete(f"/api/sources/{property_id}").status_code == 200
        assert client.delete(f"/api/sources/{strength_id}").status_code == 200

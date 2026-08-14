from src.core.models.material import Material
from src.core.schema_keys import Schema
from src.services.material_repository import MaterialRepository
from src.services.source_usage import (
    find_material_display_names_using_source,
    resolve_materials_directories,
)

SOURCE_ID = "015011a5-ab25-4aab-9bce-b69d10e7f54b"
OTHER_SOURCE_ID = "00000000-0000-0000-0000-000000000001"


def _material_with_physical_source_ref(source_id: str) -> Material:
    return Material(
        data={
            "material_id": "mat-1",
            Schema.METADATA: {Schema.NAME_STD: "08Х13"},
            Schema.PHYSICAL: {
                Schema.PROPERTIES: [
                    {
                        Schema.PROP_NAME: "density",
                        Schema.REF_ID: source_id,
                    }
                ]
            },
            Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        }
    )


def test_material_uses_source_ref_in_physical_properties():
    material = _material_with_physical_source_ref(SOURCE_ID)
    assert material.uses_source_ref(SOURCE_ID) is True
    assert material.uses_source_ref(OTHER_SOURCE_ID) is False


def test_material_uses_source_ref_in_strength_category():
    material = Material(
        data={
            "material_id": "mat-2",
            Schema.METADATA: {Schema.NAME_STD: "Сталь"},
            Schema.PHYSICAL: {Schema.PROPERTIES: []},
            Schema.MECHANICAL: {
                Schema.STRENGTH_CAT: [
                    {Schema.VAL_STR_CAT: "КП 490", Schema.REF_ID: SOURCE_ID}
                ]
            },
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        }
    )
    assert material.uses_source_ref(SOURCE_ID) is True


def test_material_uses_source_ref_in_chemical_composition():
    material = Material(
        data={
            "material_id": "mat-3",
            Schema.METADATA: {Schema.NAME_STD: "Сплав"},
            Schema.PHYSICAL: {Schema.PROPERTIES: []},
            Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
            Schema.CHEMICAL: {
                Schema.COMPOSITION: [
                    {"composition_source": "ГОСТ", Schema.REF_ID: SOURCE_ID}
                ]
            },
        }
    )
    assert material.uses_source_ref(SOURCE_ID) is True


def test_repository_materials_using_source():
    repo = MaterialRepository()
    repo.materials = [
        _material_with_physical_source_ref(SOURCE_ID),
        _material_with_physical_source_ref(OTHER_SOURCE_ID),
    ]

    used = repo.materials_using_source(SOURCE_ID)
    assert len(used) == 1
    assert used[0].get_name() == "08Х13"


def test_resolve_materials_directories_uses_source_json_parent(tmp_path):
    material_path = tmp_path / "demo.json"
    material_path.write_text(
        '{"material_id":"m1","metadata":{"name_material_standard":"Demo"},'
        f'"physical_properties":{{"properties":[{{"property_name":"density","source_ref_id":"{SOURCE_ID}"}}]}},'
        '"mechanical_properties":{"strength_category":[]},'
        '"chemical_properties":{"composition":[]}}',
        encoding="utf-8",
    )
    (tmp_path / "source.json").write_text("{}", encoding="utf-8")

    directories = resolve_materials_directories(None, tmp_path / "source.json")
    assert directories == [tmp_path.resolve()]


def test_find_material_display_names_using_source(tmp_path):
    material_path = tmp_path / "demo.json"
    material_path.write_text(
        '{"material_id":"m1","metadata":{"name_material_standard":"Demo"},'
        f'"physical_properties":{{"properties":[{{"property_name":"density","source_ref_id":"{SOURCE_ID}"}}]}},'
        '"mechanical_properties":{"strength_category":[]},'
        '"chemical_properties":{"composition":[]}}',
        encoding="utf-8",
    )

    names = find_material_display_names_using_source([tmp_path], SOURCE_ID)
    assert names == ["Demo"]


def test_delete_source_rejects_when_used_in_material(client, open_workspace):
    response = client.delete(f"/api/sources/{SOURCE_ID}")
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "материал" in detail.lower()


def test_get_source_usage_when_used_in_material(client, open_workspace):
    response = client.get(f"/api/sources/{SOURCE_ID}/usage")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] > 0
    assert len(payload["examples"]) > 0


def test_get_source_usage_for_unused_source(client, open_workspace):
    create_response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "Unused usage check",
            "description": "",
            "hyperlink": "",
        },
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id_source"]

    usage_response = client.get(f"/api/sources/{source_id}/usage")
    assert usage_response.status_code == 200
    payload = usage_response.json()
    assert payload["count"] == 0
    assert payload["examples"] == []

    client.delete(f"/api/sources/{source_id}")

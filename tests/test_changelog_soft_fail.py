from __future__ import annotations

from unittest.mock import patch

from uuid import uuid4


def test_put_succeeds_when_changelog_raises(
    client,
    material_id,
    caplog,
):
    """L4: сбой material_changelog не откатывает успешный save."""
    detail = client.get(f"/api/materials/{material_id}").json()
    detail["metadata"]["comment"] = f"changelog-soft-fail-{uuid4().hex[:8]}"

    with patch(
        "backend.routers.materials.log_changes",
        side_effect=OSError("changelog unavailable"),
    ):
        with caplog.at_level("ERROR"):
            put = client.put(f"/api/materials/{material_id}", json=detail)

    assert put.status_code == 200
    assert put.json()["ok"] is True
    reloaded = client.get(f"/api/materials/{material_id}").json()
    assert reloaded["metadata"]["comment"] == detail["metadata"]["comment"]
    assert any(
        "material_changelog" in record.message for record in caplog.records
    )

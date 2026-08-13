from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.services.source_link import (
    collect_sources_attachment_directories,
    is_external_url,
    resolve_local_file_path,
)


def test_is_external_url():
    assert is_external_url("https://example.com/doc.pdf") is True
    assert is_external_url("normacs://normacs.ru/page") is True
    assert is_external_url("scan.pdf") is False
    assert is_external_url(r"C:\docs\scan.pdf") is False


def test_resolve_relative_file_in_sources_dir(tmp_path: Path):
    sources_dir = tmp_path / "Источники"
    sources_dir.mkdir()
    file_path = sources_dir / "manual.pdf"
    file_path.write_bytes(b"%PDF-1.4")

    resolved = resolve_local_file_path("manual.pdf", [sources_dir.resolve()])
    assert resolved == file_path.resolve()


def test_resolve_relative_file_blocks_path_traversal(tmp_path: Path):
    sources_dir = tmp_path / "Источники"
    sources_dir.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")

    with pytest.raises(FileNotFoundError):
        resolve_local_file_path("../secret.txt", [sources_dir.resolve()])


def test_resolve_absolute_file_path(tmp_path: Path):
    file_path = tmp_path / "absolute.pdf"
    file_path.write_bytes(b"%PDF-1.4")

    resolved = resolve_local_file_path(str(file_path), [])
    assert resolved == file_path.resolve()


def test_open_source_link_serves_local_file(client: TestClient, tmp_path: Path, monkeypatch):
    sources_dir = tmp_path / "Источники"
    sources_dir.mkdir()
    file_path = sources_dir / "local.pdf"
    file_path.write_bytes(b"%PDF-local")

    monkeypatch.setattr(
        "backend.routers.sources.collect_sources_attachment_directories",
        lambda **_: [sources_dir.resolve()],
    )

    create_response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "Link test source",
            "description": "",
            "hyperlink": "local.pdf",
        },
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id_source"]

    response = client.get(f"/api/sources/{source_id}/open-link")
    assert response.status_code == 200
    assert response.content == b"%PDF-local"
    assert "application/pdf" in response.headers.get("content-type", "")

    client.delete(f"/api/sources/{source_id}")


def test_open_source_link_redirects_external_url(client: TestClient):
    create_response = client.post(
        "/api/sources",
        json={
            "group": "property_sources",
            "name": "External link source",
            "description": "",
            "hyperlink": "https://example.com/manual.pdf",
        },
    )
    assert create_response.status_code == 201
    source_id = create_response.json()["id_source"]

    response = client.get(f"/api/sources/{source_id}/open-link", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "https://example.com/manual.pdf"

    client.delete(f"/api/sources/{source_id}")

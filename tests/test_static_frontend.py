
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers import health
from backend.static_frontend import DEFAULT_FRONTEND_DIST, mount_frontend_dist


def test_mount_frontend_dist_serves_index_and_preserves_api(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>ML</title>", encoding="utf-8")

    app = FastAPI()
    app.include_router(health.router, prefix="/api")
    assert mount_frontend_dist(app, dist) is True

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200
        root = client.get("/")
        assert root.status_code == 200
        assert "ML" in root.text
        spa = client.get("/editor")
        assert spa.status_code == 200
        assert "ML" in spa.text


def test_mount_frontend_dist_skips_missing_directory(tmp_path: Path) -> None:
    app = FastAPI()
    assert mount_frontend_dist(app, tmp_path / "missing") is False


@pytest.mark.skipif(
    not DEFAULT_FRONTEND_DIST.is_dir(),
    reason="frontend/dist not built",
)
def test_repo_dist_is_mounted_by_main_app() -> None:
    from backend.main import app

    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


class SPAStaticFiles(StaticFiles):

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or scope["method"] not in ("GET", "HEAD"):
                raise
            if path == "index.html":
                raise
            return await super().get_response("index.html", scope)


def mount_frontend_dist(
    application: FastAPI,
    dist_dir: Path | None = None,
) -> bool:
    target = (dist_dir or DEFAULT_FRONTEND_DIST).resolve()
    if not target.is_dir():
        return False

    application.mount(
        "/",
        SPAStaticFiles(directory=str(target), html=True),
        name="static",
    )
    return True

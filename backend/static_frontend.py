from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

# Для hashed /assets/* SPA-fallback на index.html ломает dynamic import
# (браузер получает HTML вместо JS → Failed to fetch dynamically imported module).
_NO_SPA_FALLBACK_PREFIXES = ("assets/",)
_NO_SPA_FALLBACK_SUFFIXES = (
    ".js",
    ".css",
    ".map",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".json",
)


def _should_spa_fallback(path: str) -> bool:
    normalized = path.lstrip("/").replace("\\", "/")
    if not normalized or normalized == "index.html":
        return False
    lower = normalized.lower()
    if any(lower.startswith(prefix) for prefix in _NO_SPA_FALLBACK_PREFIXES):
        return False
    if any(lower.endswith(suffix) for suffix in _NO_SPA_FALLBACK_SUFFIXES):
        return False
    return True


class SPAStaticFiles(StaticFiles):

    async def get_response(self, path: str, scope: Scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or scope["method"] not in ("GET", "HEAD"):
                raise
            if not _should_spa_fallback(path):
                raise
            response = await super().get_response("index.html", scope)

        # После пересборки кэш старого index.html тянет несуществующие chunk'и.
        content_type = ""
        if hasattr(response, "headers"):
            content_type = (response.headers.get("content-type") or "").lower()
        request_path = path.lstrip("/").replace("\\", "/")
        is_html_shell = (
            request_path in ("", ".", "index.html")
            or content_type.startswith("text/html")
        )
        if is_html_shell and hasattr(response, "headers"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        return response


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

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from src.infrastructure.help_docs import HELP_TITLES, load_help_markdown

router = APIRouter(tags=["Help"])

_VALID_IDS = frozenset(HELP_TITLES)


@router.get("/help", response_model=list[dict[str, str]])
def list_help():
    return [
        {"id": doc_id, "title": HELP_TITLES[doc_id]}
        for doc_id in ("about", "instruction", "changelog")
    ]


@router.get("/help/{doc_id}", response_class=PlainTextResponse)
def get_help_document(doc_id: str):
    if doc_id not in _VALID_IDS:
        raise HTTPException(status_code=404, detail="Документ справки не найден")
    try:
        return load_help_markdown(doc_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

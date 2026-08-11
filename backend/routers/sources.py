from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import AppState, get_state
from backend.schemas import SourcesResponse, SourceItem, SourceCreateRequest, OkResponse, SourceUpdateRequest

router = APIRouter(tags=["Sources"])


def _source_items(raw_items: list[dict]) -> list[SourceItem]:
    return [SourceItem.from_dict(item) for item in raw_items]


@router.get("/sources", response_model=SourcesResponse)
def get_sources(state: AppState = Depends(get_state)):
    groups = state.sources.sources
    return SourcesResponse(
        property_sources=_source_items(groups["property_sources"]),
        strength_sources=_source_items(groups["strength_sources"]),
        chemical_sources=_source_items(groups["chemical_sources"]),
    )


@router.get("/sources/{source_id}", response_model=SourceItem)
def get_source_by_id(source_id: str, state: AppState = Depends(get_state)):
    res = state.sources.get_source_by_id(source_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    return SourceItem.from_dict(res)


@router.post("/sources", status_code=201, response_model=SourceItem)
def post_source(body: SourceCreateRequest, state: AppState = Depends(get_state)):
    id_source = state.sources.add_source(
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
        group=body.group,
    )
    created = state.sources.get_source_by_id(id_source)
    if created is None:
        raise HTTPException(status_code=500, detail="Источник создан, но не найден")
    return SourceItem.from_dict(created)


@router.put("/sources/{source_id}", response_model=SourceItem)
def put_source(source_id: str, body: SourceUpdateRequest, state: AppState = Depends(get_state)):
    updated = state.sources.update_source(
        source_id=source_id,
        name=body.name,
        description=body.description,
        hyperlink=body.hyperlink,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Не удалось обновить источник")
    res = state.sources.get_source_by_id(source_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    return SourceItem.from_dict(res)


@router.delete("/sources/{source_id}", response_model=OkResponse)
def delete_by_id(source_id: str, state: AppState = Depends(get_state)):
    if state.sources.get_source_by_id(source_id) is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    state.sources.delete_source(source_id)
    return OkResponse(ok=True)

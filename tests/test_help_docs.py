"""API /api/help."""

from __future__ import annotations

import pytest

from src.infrastructure.help_docs import (
    HELP_TITLES,
    list_help_documents,
    load_help_markdown,
    markdown_to_plain,
)

HELP_DOC_IDS = ("about", "instruction", "changelog")


@pytest.mark.parametrize("doc_id", HELP_DOC_IDS)
def test_load_help_markdown_reads_committed_docs(doc_id: str) -> None:
    text = load_help_markdown(doc_id)
    assert isinstance(text, str)
    assert text.strip()
    assert doc_id in HELP_TITLES


def test_list_help_documents_covers_all_ids() -> None:
    docs = list_help_documents()
    assert {item["id"] for item in docs} == set(HELP_DOC_IDS)
    for item in docs:
        assert item["title"] == HELP_TITLES[item["id"]]
        assert item["filename"].endswith(".md")


def test_markdown_to_plain_strips_heading_markers() -> None:
    plain = markdown_to_plain("# Title\n\n**bold** line")
    assert "Title" in plain
    assert "**" not in plain
    assert "bold" in plain


def test_api_list_help(client) -> None:
    response = client.get("/api/help")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(HELP_DOC_IDS)
    assert {item["id"] for item in body} == set(HELP_DOC_IDS)
    for item in body:
        assert item["title"] == HELP_TITLES[item["id"]]


@pytest.mark.parametrize("doc_id", HELP_DOC_IDS)
def test_api_get_help_document_returns_plain_markdown(client, doc_id: str) -> None:
    response = client.get(f"/api/help/{doc_id}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert response.text.strip()
    assert response.text == load_help_markdown(doc_id)


def test_api_get_help_unknown_document_returns_404(client) -> None:
    response = client.get("/api/help/not-a-doc")
    assert response.status_code == 404
    assert "не найден" in response.json()["detail"].lower()

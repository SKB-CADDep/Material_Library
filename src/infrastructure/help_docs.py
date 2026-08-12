

from __future__ import annotations

import re
from pathlib import Path

from src.infrastructure.paths import docs_dir

HELP_DOCS: dict[str, str] = {
    "about": "about.md",
    "instruction": "instruction.md",
    "changelog": "changelog.md",
}

LEGACY_TXT_TO_DOC: dict[str, str] = {
    "app_list.txt": "about.md",
    "instruction_list.txt": "instruction.md",
    "change_list.txt": "changelog.md",
}

HELP_TITLES: dict[str, str] = {
    "about": "О приложении",
    "instruction": "Инструкция по использованию",
    "changelog": "Список изменений",
}


def _resolve_doc_path(filename: str) -> Path:
    if filename in HELP_DOCS:
        return docs_dir() / HELP_DOCS[filename]
    if filename in LEGACY_TXT_TO_DOC.values():
        return docs_dir() / filename
    if filename in LEGACY_TXT_TO_DOC:
        return docs_dir() / LEGACY_TXT_TO_DOC[filename]
    raise FileNotFoundError(filename)


def load_help_markdown(key: str) -> str:
    """key: about | instruction | changelog или legacy *.txt."""
    path = _resolve_doc_path(key if key.endswith(".md") else key)
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8").strip()


def load_help_by_legacy_filename(filename: str) -> str:
    return load_help_markdown(filename)


def markdown_to_plain(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            lines.append(stripped.lstrip("#").strip())
            continue
        lines.append(re.sub(r"\*\*(.+?)\*\*", r"\1", line))
    return "\n".join(lines).strip()


def list_help_documents() -> list[dict[str, str]]:
    return [
        {"id": doc_id, "title": HELP_TITLES[doc_id], "filename": fname}
        for doc_id, fname in HELP_DOCS.items()
    ]

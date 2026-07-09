import os
import re
import requests
from github import Github, Auth
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# КОНФИГУРАЦИЯ
# ═══════════════════════════════════════════════════════════════
# Используем бесплатную модель GPT-4o-mini через GitHub Models
MODEL_NAME = "gpt-4o-mini"
API_URL = "https://models.inference.ai.azure.com/chat/completions"
MAX_DIFF_CHARS = 60000

# ═══════════════════════════════════════════════════════════════
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ═══════════════════════════════════════════════════════════════
def get_system_prompt() -> str:
    return """
Ты — Senior Software Engineer с 15+ годами опыта. Проводишь код-ревью на русском языке.

## Твоя задача
Проанализируй предоставленный diff и дай структурированный отзыв.

## Структура ответа (строго соблюдай)

### 🔴 Критические проблемы
Баги, уязвимости безопасности, утечки памяти, гонки данных.
Если нет — напиши «Не обнаружено».

### 🟡 Улучшения
Производительность, читаемость, нарушения принципов SOLID/DRY/KISS.
Если нет — напиши «Не обнаружено».

### 🟢 Хорошие решения
Что сделано хорошо — обязательно отметь.

### 💡 Рекомендации
Конкретные предложения с примерами кода (если применимо).

### ✅ Итог
Одна строка: можно мёрджить / нужны правки / блокирую мёрдж.

## Правила
- Будь конкретным: указывай файл и строку где возможно.
- Не придирайся к стилю если есть линтер (eslint/flake8/etc).
- Игнорируй изменения в lock-файлах (package-lock.json, poetry.lock и т.п.).
- Если diff слишком большой — сфокусируйся на логике, а не форматировании.
"""

def read_file_safe(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""

def truncate_diff(diff: str) -> str:
    # Удаляем lock-файлы
    lock_pattern = re.compile(
        r'diff --git a/.*?(package-lock\.json|poetry\.lock|yarn\.lock|Pipfile\.lock).*?(?=diff --git|$)',
        re.DOTALL
    )
    diff = lock_pattern.sub('', diff)
    if len(diff) <= MAX_DIFF_CHARS:
        return diff
    return diff[:MAX_DIFF_CHARS] + "\n\n... [DIFF TRUNCATED] ..."

# ══════════════════════════════════════════════════════════════
# ВЫЗОВ GITHUB MODELS (БЕСПЛАТНО, БЕЗ ВНЕШНИХ КЛЮЧЕЙ)
# ═══════════════════════════════════════════════════════════════
def call_github_models(system_prompt: str, user_prompt: str) -> str:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN не найден")

    print(f">>> Вызываем GitHub Model: {MODEL_NAME}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 4096
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
    
    print(f"    HTTP статус: {response.status_code}")
    
    if response.status_code != 200:
        raise Exception(f"API Error {response.status_code}: {response.text[:500]}")
    
    result = response.json()
    return result["choices"][0]["message"]["content"]

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def main() -> int:
    print("=" * 60)
    print("Starting AI Code Review (GitHub Models)")
    print("=" * 60)
    
    github_token = os.environ.get("GITHUB_TOKEN")
    pr_number    = int(os.environ.get("PR_NUMBER", 0))
    repo_name    = os.environ.get("REPO_NAME", "")
    pr_title     = os.environ.get("PR_TITLE", "Untitled")
    pr_body      = os.environ.get("PR_BODY") or "No description"
    pr_author    = os.environ.get("PR_AUTHOR", "unknown")

    if not all([github_token, pr_number, repo_name]):
        print("❌ Отсутствуют обязательные переменные")
        return 1

    diff          = read_file_safe("pr_diff.txt")
    changed_files = read_file_safe("changed_files.txt")

    if not diff.strip():
        print("Diff пустой — пропускаем.")
        return 0

    diff_for_review = truncate_diff(diff)
    print(f"Diff: {len(diff)} → {len(diff_for_review)} символов")

    system_prompt = get_system_prompt()
    user_prompt = (
        f"**Автор:** @{pr_author}\n"
        f"**Название:** {pr_title}\n\n"
        f"**Описание:**\n{pr_body}\n\n"
        f"**Изменённые файлы:**\n```\n{changed_files}\n```\n\n"
        f"**Diff:**\n```diff\n{diff_for_review}\n```\n\n"
        "Проведи код-ревью этого PR."
    )

    print("Вызываем модель...")
    try:
        review_text = call_github_models(system_prompt, user_prompt)
        print(f"✅ Ревью получено ({len(review_text)} символов)")
    except Exception as e:
        review_text = f"**⚠️ Ошибка AI:** `{e}`\n\nПроверь логи workflow."
        print(f"❌ Ошибка: {e}")

    print("Постим комментарий в PR...")
    try:
        gh   = Github(auth=Auth.Token(github_token))
        repo = gh.get_repo(repo_name)
        pr   = repo.get_pull(pr_number)
        
        comment = (
            "## 🤖 AI Code Review\n\n"
            f"{review_text}\n\n"
            "---\n"
            f"<sub>Model: `{MODEL_NAME}` via GitHub Models (Free)</sub>"
        )
        pr.create_issue_comment(comment)
        print("✅ Комментарий опубликован!")
    except Exception as e:
        print(f"❌ Не удалось опубликовать: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
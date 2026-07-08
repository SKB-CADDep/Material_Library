import os
import requests

def get_pr_diff():
    """Получает diff из pull request"""
    repo = os.environ['REPO_NAME']
    pr_number = os.environ['PR_NUMBER']
    token = os.environ['GITHUB_TOKEN']
    
    print(f"📦 Repo: {repo}, PR: {pr_number}")
    
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3.diff'
    }
    
    url = f'https://api.github.com/repos/{repo}/pulls/{pr_number}'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        print("✅ Diff получен успешно")
        return response.text
    else:
        print(f"❌ Ошибка получения diff: {response.status_code}")
        return ""

def review_with_github_models(diff):
    """Отправляет код на ревью через GitHub Models (бесплатно)"""
    token = os.environ['GITHUB_TOKEN']
    
    print("🤖 Отправляю на ревью через GitHub Models...")
    
    prompt = f"""Роль
Ты — опытный Senior Software Engineer и Tech Lead. Проводишь code review Pull Request'ов так, как это делают в сильных продуктовых компаниях (Google, Meta, Amazon, JetBrains, Stripe и др.).
Твоя задача — помочь разработчику сделать код более качественным, безопасным, поддерживаемым и понятным.
Не придирайся к стилю без причины. Комментируй только то, что действительно улучшает код.

Что необходимо проверить
1. Correctness (Правильность)
Проверь:
логические ошибки;
неверные алгоритмы;
пропущенные проверки;
неправильную обработку ошибок;
потенциальные баги;
некорректную работу на edge cases.
Если видишь возможный баг — объясни сценарий, при котором он возникнет.

2. Readability (Читаемость)
Проверь:
понятность кода;
сложность условий;
сложность функций;
слишком длинные методы;
дублирование логики;
удачные ли названия переменных, функций и классов.
Предлагай упрощения только если они действительно делают код понятнее.

3. Architecture
Проверь:
соблюдение SOLID;
разделение ответственности;
связанность компонентов;
чрезмерную связанность модулей;
нарушение существующей архитектуры проекта;
возможные улучшения структуры.
Не советуй переписывать половину проекта ради красоты.

4. Python Best Practices
Проверь:
соответствие PEP8;
Pythonic-подход;
использование стандартной библиотеки вместо самописного кода;
работу с контекстными менеджерами;
использование dataclass, Enum, typing, pathlib, itertools, collections и других стандартных возможностей там, где они действительно упрощают код.
Не навязывай модные конструкции без пользы.

5. Производительность
Обрати внимание на:
лишние проходы по коллекциям;
неоптимальные алгоритмы;
ненужные запросы к БД;
проблему N+1;
лишние копирования объектов;
неоправданное создание списков вместо генераторов;
неоптимичную работу со строками;
неэффективные циклы.
Поясняй, если улучшение имеет измеримый эффект.

6. Безопасность
Проверь:
SQL Injection;
Command Injection;
Path Traversal;
небезопасную работу с файлами;
утечки секретов;
хранение паролей;
небезопасную сериализацию;
XSS (если есть веб-код);
CSRF (если применимо);
SSRF;
использование eval/exec;
небезопасные subprocess.

7. Надёжность
Проверь:
обработку исключений;
откат транзакций;
корректное освобождение ресурсов;
работу при отсутствии данных;
поведение при таймаутах;
идемпотентность операций (если применимо).

8. Работа с БД
Если код взаимодействует с БД, оцени:
индексы;
количество запросов;
транзакции;
блокировки;
атомарность операций;
возможные race condition.

9. Тестируемость
Проверь:
легко ли тестировать код;
нет ли скрытых зависимостей;
можно ли использовать dependency injection;
не нарушает ли код существующие тесты;
хватает ли тестов для новой функциональности.
Если тестов не хватает — предложи, что именно стоит проверить.

10. Поддерживаемость
Оцени:
насколько код будет понятен через год;
можно ли его безопасно изменять;
есть ли "магические числа";
есть ли сложные конструкции без необходимости;
есть ли скрытые побочные эффекты.

Формат ответа
Для каждой найденной проблемы используй формат:
🔴 Critical
Что не так.
Почему это проблема.
Как исправить.

🟠 Major
Что можно улучшить.
Почему это важно.
Предложение по исправлению.

🟡 Minor
Небольшое замечание.

💡 Suggestion
Не ошибка, но идея улучшения.

Если проблем нет
Не выдумывай замечания.
Если код действительно хороший — так и напиши.
Дополнительно перечисли сильные стороны PR.

Общие правила
Не придирайся к личным предпочтениям.
Не требуй переписывать код без веской причины.
Всегда объясняй, почему замечание важно.
По возможности показывай пример исправленного кода.
Если есть несколько вариантов решения — кратко сравни их.
Учитывай контекст проекта и существующий стиль кода.
Если не уверен в замечании — явно укажи степень уверенности.
Не комментируй форматирование, если его уже проверяет линтер.
Сосредоточься на изменениях в Pull Request, а не на всём проекте.
В конце дай краткое итоговое заключение: готов ли PR к слиянию, требует ли исправлений или нуждается в дополнительном обсуждении."""

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Используем бесплатную модель GPT-4o через GitHub Models
    payload = {
        'model': 'gpt-4o',
        'messages': [
            {'role': 'system', 'content': 'Ты опытный senior developer, который проводит code review. Отвечай на русском языке.'},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': 2000
    }
    
    try:
        response = requests.post(
            'https://models.inference.ai.azure.com/chat/completions',
            headers=headers,
            json=payload,
            timeout=60
        )
        
        print(f"📡 Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()['choices'][0]['message']['content']
            print("✅ Ревью получено!")
            return result
        else:
            print(f"❌ Ошибка API: {response.text}")
            return f"API Error: {response.status_code}\n{response.text}"
            
    except Exception as e:
        print(f"❌ Исключение: {str(e)}")
        return f"Error: {str(e)}"

def post_review_comment(review_text):
    """Публикует ревью как комментарий к PR"""
    repo = os.environ['REPO_NAME']
    pr_number = os.environ['PR_NUMBER']
    token = os.environ['GITHUB_TOKEN']
    
    print("📝 Публикую комментарий...")
    
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    url = f'https://api.github.com/repos/{repo}/issues/{pr_number}/comments'
    
    comment_body = f"## 🤖 AI Code Review\n\n{review_text}"
    
    payload = {'body': comment_body}
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"📡 Статус публикации: {response.status_code}")
        
        if response.status_code == 201:
            print("✅ Комментарий опубликован!")
            return True
        else:
            print(f"❌ Ошибка: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Исключение при публикации: {str(e)}")
        return False

def main():
    print("🚀 Запуск AI Code Review...")
    
    diff = get_pr_diff()
    
    if not diff.strip():
        print("⚠️ Нет изменений для ревью")
        return
    
    review = review_with_github_models(diff)
    
    with open('review_result.md', 'w', encoding='utf-8') as f:
        f.write(review)
    print("💾 Ревью сохранено в review_result.md")
    
    success = post_review_comment(review)
    
    if success:
        print("🎉 Готово!")
    else:
        print("⚠️ Ревью создано, но не опубликовано")

if __name__ == '__main__':
    main()
"""Customer launcher without PowerShell (fileserver / corporate policy safe).

Started by: Запуск Material Library.bat -> runtime\\python\\python.exe this file

Runs uvicorn IN THIS SAME console window so:
- errors are visible
- bat pushd drive stays mapped while the app is running
- no second PowerShell / python window that corporate policy kills
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path


APP_URL = "http://127.0.0.1:8000"
HEALTH_URL = f"{APP_URL}/api/health"
PID_FILE = Path(os.environ.get("TEMP", ".")) / "material-library-server.pid"


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def to_unc(path: Path) -> str:
    """Convert mapped drive path (Z:\\...) to \\\\server\\share\\... when possible."""
    text = str(path)
    try:
        text = str(path.resolve())
    except OSError:
        pass
    if text.startswith("\\\\"):
        return text
    drive, tail = os.path.splitdrive(text)
    if len(drive) == 2 and drive[1] == ":":
        try:
            import ctypes
            from ctypes import wintypes

            buf = ctypes.create_unicode_buffer(1024)
            size = wintypes.DWORD(1024)
            err = ctypes.windll.mpr.WNetGetConnectionW(drive, buf, ctypes.byref(size))
            if err == 0 and buf.value:
                remote = buf.value.rstrip("\\")
                rest = tail.replace("/", "\\")
                if rest in ("", "\\"):
                    return remote
                return remote + rest
        except Exception:
            pass
    return text


def resolve_materials_dir(root: Path) -> Path:
    """Materials workspace is always project_root/data (unless MATERIALS_DIR is set)."""
    env = os.environ.get("MATERIALS_DIR")
    if env and Path(env).is_dir():
        return Path(to_unc(Path(env)))
    return Path(to_unc(root / "data"))


def resolve_source_json(root: Path, materials_dir: Path) -> Path | None:
    """source.json lives next to materials in data/source.json."""
    env = os.environ.get("SOURCE_JSON_PATH")
    if env and Path(env).is_file():
        return Path(to_unc(Path(env)))

    target = Path(materials_dir) / "source.json"
    if target.is_file():
        return Path(to_unc(target))
    return None


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def wait_http(url: str, timeout_sec: float = 90.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if 200 <= getattr(resp, "status", 200) < 500:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def open_workspace(directory: Path) -> bool:
    body = json.dumps({"directory": str(directory)}).encode("utf-8")
    req = urllib.request.Request(
        f"{APP_URL}/api/workspace/open",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return 200 <= getattr(resp, "status", 200) < 300
    except Exception:
        return False


def browser_candidates() -> list:
    local = os.environ.get("LOCALAPPDATA", "")
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    return [
        Path(local) / "Yandex" / "YandexBrowser" / "Application" / "browser.exe",
        Path(pf) / "Yandex" / "YandexBrowser" / "Application" / "browser.exe",
        Path(pf86) / "Yandex" / "YandexBrowser" / "Application" / "browser.exe",
        Path(pf) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(pf86) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(pf) / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(pf86) / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(local) / "Google" / "Chrome" / "Application" / "chrome.exe",
    ]


def open_browser(url: str) -> None:
    for exe in browser_candidates():
        if exe.is_file():
            subprocess.Popen([str(exe), url], close_fds=True)
            return
    try:
        os.startfile(url)  # type: ignore[attr-defined]
    except OSError:
        print(f"Откройте браузер вручную: {url}")


def fail(title: str, steps: list) -> int:
    print()
    print("=" * 40)
    print(f"  {title}")
    print("=" * 40)
    for step in steps:
        print(f"  - {step}")
    print()
    return 1


def after_server_ready(data_dir: Path) -> None:
    if not wait_http(HEALTH_URL, 90):
        print("Сервер не ответил вовремя — смотрите сообщения выше.")
        return
    print("Сервер готов")
    if not wait_http(APP_URL, 30):
        print("Интерфейс ещё не готов — откройте http://127.0.0.1:8000 вручную.")
        return
    print("Интерфейс готов")

    if data_dir.is_dir():
        print("==> Загрузка базы материалов")
        if open_workspace(data_dir):
            print(f"База материалов: {data_dir}")
        else:
            print("Не удалось автоматически открыть папку data")
            print(f"На экране программы введите путь: {data_dir}")

    print()
    print("=" * 40)
    print("  Готово — не закрывайте это окно")
    print(f"  {APP_URL}")
    print("=" * 40)
    print("Остановка: «Остановить Material Library.bat» или Ctrl+C")
    print()
    print("==> Открытие браузера")
    open_browser(APP_URL)


def main() -> int:
    root = project_root()
    # Portable python312._pth ignores PYTHONPATH — put project on sys.path explicitly.
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
    try:
        os.chdir(root_str)
    except OSError as exc:
        return fail(
            "Не удалось открыть папку программы",
            [str(exc), "Запускайте «Запуск Material Library.bat» из папки на файлсервере."],
        )

    data_dir = resolve_materials_dir(root)
    dist_index = root / "frontend" / "dist" / "index.html"

    print("Material Library — запуск")
    print(f"Папка программы: {root}")
    print("Подробная инструкция: ИНСТРУКЦИЯ.txt")
    print()

    if not dist_index.is_file():
        return fail(
            "Не найден собранный интерфейс (frontend/dist)",
            ["Дистрибутив неполный. Запросите полный архив у разработчиков."],
        )

    if port_in_use(8000):
        return fail(
            "Порт 8000 занят (сервер)",
            [
                "Возможно, программа уже запущена",
                "Запустите файл: Остановить Material Library.bat",
                "Затем запустите снова",
            ],
        )

    if data_dir.is_dir():
        os.environ["MATERIALS_DIR"] = str(data_dir)
        print(f"MATERIALS_DIR={data_dir}")
    else:
        print(f"Папка с материалами не найдена: {data_dir}")
        print("На экране программы укажите путь к папке с JSON-файлами.")

    source_json = resolve_source_json(root, data_dir)
    if source_json is not None:
        os.environ["SOURCE_JSON_PATH"] = str(source_json)
        print(f"SOURCE_JSON_PATH={source_json}")
    else:
        print("source.json не найден рядом с программой / в базе материалов.")

    try:
        PID_FILE.write_text(str(os.getpid()), encoding="ascii")
    except OSError:
        pass

    ready = threading.Thread(target=after_server_ready, args=(data_dir,), daemon=True)
    ready.start()

    print()
    print("==> Запуск сервера (это окно должно оставаться открытым)")
    try:
        import uvicorn
    except ImportError:
        return fail(
            "В runtime не найден uvicorn",
            ["Дистрибутив неполный. Запросите полный архив у разработчиков."],
        )

    try:
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")
    except Exception as exc:
        return fail("Ошибка сервера", [str(exc)])
    finally:
        try:
            PID_FILE.unlink(missing_ok=True)
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nОстановлено.")
        raise SystemExit(0)

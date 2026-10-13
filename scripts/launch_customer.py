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


def listening_pids(port: int) -> list[int]:
    found: list[int] = []
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"],
            text=True,
            errors="ignore",
        )
    except Exception:
        return found
    needle = f":{port}"
    for line in out.splitlines():
        if "LISTENING" not in line.upper() or needle not in line:
            continue
        parts = line.split()
        if not parts or not parts[-1].isdigit():
            continue
        pid = int(parts[-1])
        if pid not in found and pid != os.getpid():
            found.append(pid)
    return found


def release_port(port: int) -> bool:
    """Останавливает прошлый запуск на этом порту. Закрытие окна должно делать то же самое."""
    pids = listening_pids(port)
    if not pids:
        return True
    print(f"Порт {port} ещё занят предыдущим запуском. Останавливаю его.")
    for pid in pids:
        subprocess.call(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    deadline = time.time() + 8
    while time.time() < deadline:
        if not port_in_use(port):
            return True
        time.sleep(0.3)
    return not port_in_use(port)


def install_console_close_stop() -> None:
    """Закрытие окна консоли сразу завершает процесс и освобождает порт."""
    if os.name != "nt":
        return
    import ctypes
    from ctypes import wintypes

    ctrl_c = 0
    ctrl_break = 1
    ctrl_close = 2
    ctrl_logoff = 5
    ctrl_shutdown = 6

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
    def _on_console_ctrl(ctrl_type: int) -> bool:
        if ctrl_type in (ctrl_c, ctrl_break, ctrl_close, ctrl_logoff, ctrl_shutdown):
            os._exit(0)
        return False

    global _CONSOLE_CLOSE_HANDLER
    _CONSOLE_CLOSE_HANDLER = _on_console_ctrl
    ctypes.windll.kernel32.SetConsoleCtrlHandler(_CONSOLE_CLOSE_HANDLER, True)


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
    print("  Готово")
    print(f"  {APP_URL}")
    print("=" * 40)
    print("Остановка: закройте это окно или нажмите Ctrl+C.")
    print("Закрытие вкладки в браузере программу не останавливает.")
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

    install_console_close_stop()

    if port_in_use(8000) and not release_port(8000):
        return fail(
            "Порт 8000 занят",
            [
                "Его занимает другая программа, остановить её не удалось",
                "Закройте ту программу или запустите «Остановить Material Library.bat»",
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
    print("==> Запуск сервера")
    print("Чтобы остановить программу, закройте это окно или нажмите Ctrl+C.")
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

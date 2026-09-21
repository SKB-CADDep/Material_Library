"""Stop Material Library server without PowerShell."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PID_FILE = Path(os.environ.get("TEMP", ".")) / "material-library-server.pid"


def pids_on_port(port: int) -> list[int]:
    found: list[int] = []
    try:
        out = subprocess.check_output(["netstat", "-ano"], text=True, errors="ignore")
    except Exception:
        return found
    needle = f":{port}"
    for line in out.splitlines():
        if "LISTENING" not in line.upper():
            continue
        if needle not in line:
            continue
        parts = line.split()
        if not parts:
            continue
        pid_text = parts[-1]
        if pid_text.isdigit():
            pid = int(pid_text)
            if pid not in found:
                found.append(pid)
    return found


def kill_pid(pid: int) -> bool:
    try:
        subprocess.check_call(
            ["taskkill", "/F", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def main() -> int:
    print("Material Library — остановка")
    print()

    pids = set(pids_on_port(8000))
    if PID_FILE.is_file():
        try:
            pids.add(int(PID_FILE.read_text(encoding="ascii").strip()))
        except Exception:
            pass

    if not pids:
        print("Активных процессов на порту 8000 не найдено.")
        print()
        return 0

    for pid in sorted(pids):
        if kill_pid(pid):
            print(f"Остановлен процесс PID {pid} (порт 8000)")
        else:
            print(f"Не удалось остановить PID {pid}")

    try:
        PID_FILE.unlink(missing_ok=True)
    except OSError:
        pass

    print()
    print("Готово.")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

@echo off
setlocal EnableExtensions
title Material Library stop

pushd "%~dp0" 2>nul
if errorlevel 1 goto fail_pushd

set "PY="
if exist "%CD%\runtime\python\python.exe" set "PY=%CD%\runtime\python\python.exe"
if not defined PY if exist "%CD%\.venv\Scripts\python.exe" set "PY=%CD%\.venv\Scripts\python.exe"

if defined PY goto do_py_stop
goto do_net_stop

:do_py_stop
"%PY%" "%CD%\scripts\stop_customer.py"
goto done

:do_net_stop
echo Python not found - killing port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1 && echo Stopped PID %%a
)
goto done

:done
echo.
echo   Done. Press any key to close.
pause >nul
popd
endlocal
exit /b 0

:fail_pushd
echo ERROR: cannot open folder:
echo %~dp0
pause
endlocal
exit /b 1

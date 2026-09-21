@echo off
setlocal EnableExtensions
title Material Library server

REM pushd is required: CMD cannot use UNC as current directory.
pushd "%~dp0" 2>nul
if errorlevel 1 goto fail_pushd

echo.
echo   Material Library - starting...
echo   Folder: %CD%
echo   See INSTRUKCIYA / instruction file in this folder.
echo   Do not close this window while working.
echo.

set "LOG=%TEMP%\material-library-launch.log"
echo [%DATE% %TIME%] start CD=%CD%>"%LOG%"

set "PY="
if exist "%CD%\runtime\python\python.exe" set "PY=%CD%\runtime\python\python.exe"
if not defined PY if exist "%CD%\.venv\Scripts\python.exe" set "PY=%CD%\.venv\Scripts\python.exe"
if not defined PY goto fail_python

if not exist "%CD%\scripts\launch_customer.py" goto fail_script

echo PY=%PY%>>"%LOG%"
echo   Python: %PY%
echo   Log: %LOG%
echo.

"%PY%" "%CD%\scripts\launch_customer.py"
set "EXITCODE=%ERRORLEVEL%"
echo exit=%EXITCODE%>>"%LOG%"
echo.
if not "%EXITCODE%"=="0" echo   ERROR: launch failed, code %EXITCODE%
if not "%EXITCODE%"=="0" echo   See log: %LOG%
echo.
echo   Server stopped. Press any key to close.
pause >nul
popd
endlocal
exit /b %EXITCODE%

:fail_pushd
echo.
echo   ERROR: cannot open folder:
echo   %~dp0
echo   CMD does not support UNC as current directory; pushd failed.
echo.
echo   Press any key to close.
pause >nul
endlocal
exit /b 1

:fail_python
echo.
echo   ERROR: python.exe not found
echo   Need: runtime\python\python.exe
echo   Log: %LOG%
echo.
echo python missing>>"%LOG%"
echo   Press any key to close.
pause >nul
popd
endlocal
exit /b 1

:fail_script
echo.
echo   ERROR: scripts\launch_customer.py not found
echo   Log: %LOG%
echo.
echo launch_customer.py missing>>"%LOG%"
echo   Press any key to close.
pause >nul
popd
endlocal
exit /b 1

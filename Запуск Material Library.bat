@echo off
chcp 65001 >nul
title Material Library — запуск
REM pushd maps UNC (\\fileserver\...) to a temporary drive letter.
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo.
  echo   Не удалось открыть папку:
  echo   %~dp0
  echo.
  pause
  exit /b 1
)
echo.
echo   Material Library — запуск...
echo   Папка: %CD%
echo   Подробная инструкция: ИНСТРУКЦИЯ.txt
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-web.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
popd
pause
exit /b %EXITCODE%

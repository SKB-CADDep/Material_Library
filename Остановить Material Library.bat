@echo off
chcp 65001 >nul
title Material Library — остановка
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo Не удалось открыть папку: %~dp0
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\stop-web.ps1"
echo.
popd
pause

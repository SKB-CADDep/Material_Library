@echo off
chcp 65001 >nul
title Material Library — остановка
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-web.ps1"
echo.
pause

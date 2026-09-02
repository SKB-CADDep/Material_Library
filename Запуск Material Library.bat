@echo off
chcp 65001 >nul
title Material Library — запуск
cd /d "%~dp0"
echo.
echo   Material Library — запуск...
echo   Подробная инструкция: ИНСТРУКЦИЯ.txt
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-web.ps1"
echo.
pause

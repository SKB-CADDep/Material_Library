@echo off
chcp 65001 >nul
title Material Library — остановка
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-demo-local.ps1"
echo.
pause

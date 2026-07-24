@echo off
chcp 65001 >nul
title Material Library - start
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo-local.ps1"
echo.
pause

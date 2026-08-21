@echo off
chcp 65001 >nul
title Material Library - release check
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release_check.ps1" %*
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE% neq 0 (
    echo Release check FAILED. Exit code: %EXITCODE%
) else (
    echo Release check PASSED.
)
pause
exit /b %EXITCODE%

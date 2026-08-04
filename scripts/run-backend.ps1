$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $ProjectRoot
$python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
Write-Host "Material Library - BACKEND (do not close)" -ForegroundColor Green
Write-Host "API: http://127.0.0.1:8000/api" -ForegroundColor DarkGray
& $python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $ProjectRoot

try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$msgPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "launch-window-messages.json"
$ui = Get-Content -LiteralPath $msgPath -Raw -Encoding UTF8 | ConvertFrom-Json

$python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$DataDir = Join-Path $ProjectRoot "data"

$Host.UI.RawUI.WindowTitle = $ui.backend_title

Write-Host $ui.backend_header -ForegroundColor Green
Write-Host $ui.backend_hint -ForegroundColor DarkGray
Write-Host $ui.backend_api -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path -LiteralPath $python)) {
    Write-Host $ui.backend_no_venv_title -ForegroundColor Red
    Write-Host ""
    Write-Host $ui.what_to_do -ForegroundColor Yellow
    foreach ($step in $ui.backend_no_venv_steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
    Read-Host $ui.press_enter
    exit 1
}

if (Test-Path -LiteralPath $DataDir) {
    $env:MATERIALS_DIR = $DataDir
}

try {
    & $python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
} catch {
    Write-Host ""
    Write-Host ($ui.backend_error -f $_.Exception.Message) -ForegroundColor Red
    Write-Host $ui.backend_retry -ForegroundColor Yellow
    Read-Host $ui.press_enter
    exit 1
}

if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
    Write-Host ""
    Write-Host ($ui.backend_exit -f $LASTEXITCODE) -ForegroundColor Red
    Read-Host $ui.press_enter
    exit $LASTEXITCODE
}

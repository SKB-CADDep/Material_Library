$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $ProjectRoot

try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

. "$PSScriptRoot\customer-launch.ps1"
$uiWindow = Get-Content -LiteralPath (Join-Path $PSScriptRoot "launch-window-messages.json") -Raw -Encoding UTF8 | ConvertFrom-Json

$DataDir = Join-Path $ProjectRoot "data"
$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
$python = Resolve-PythonExe -ProjectRoot $ProjectRoot -PreferVenv

$Host.UI.RawUI.WindowTitle = $uiWindow.server_title

Write-Host $uiWindow.server_header -ForegroundColor Green
Write-Host $uiWindow.server_hint -ForegroundColor DarkGray
Write-Host $uiWindow.server_url -ForegroundColor DarkGray
Write-Host ""

if (-not $python) {
    Write-Host $uiWindow.no_python_title -ForegroundColor Red
    Write-Host ""
    Write-Host $uiWindow.what_to_do -ForegroundColor Yellow
    foreach ($step in $uiWindow.no_python_steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
    Read-Host $uiWindow.press_enter
    exit 1
}

if (-not (Test-Path -LiteralPath $DistIndex)) {
    Write-Host $uiWindow.no_dist_title -ForegroundColor Red
    Write-Host ""
    Write-Host $uiWindow.what_to_do -ForegroundColor Yellow
    foreach ($step in $uiWindow.no_dist_steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
    Read-Host $uiWindow.press_enter
    exit 1
}

if (Test-Path -LiteralPath $DataDir) {
    $env:MATERIALS_DIR = $DataDir
}

try {
    Invoke-PythonExe -PythonExe $python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
} catch {
    Write-Host ""
    Write-Host ($uiWindow.server_error -f $_.Exception.Message) -ForegroundColor Red
    Write-Host $uiWindow.server_retry -ForegroundColor Yellow
    Read-Host $uiWindow.press_enter
    exit 1
}

if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
    Write-Host ""
    Write-Host ($uiWindow.server_exit -f $LASTEXITCODE) -ForegroundColor Red
    Read-Host $uiWindow.press_enter
    exit $LASTEXITCODE
}



param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

try {
    . "$PSScriptRoot\customer-launch.ps1"
    $uiWindow = Get-Content -LiteralPath (Join-Path $PSScriptRoot "launch-window-messages.json") -Raw -Encoding UTF8 | ConvertFrom-Json

    if (-not $ProjectRoot) {
        $ProjectRoot = Split-Path -Parent $PSScriptRoot
    }
    $ProjectRoot = Get-NativeFilesystemPath $ProjectRoot

    try {
        Set-Location -LiteralPath $ProjectRoot
    } catch {
        $env:PYTHONPATH = $ProjectRoot
    }

    $DataDir = Join-Path $ProjectRoot "data"
    $DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
    $python = Resolve-PythonExe -ProjectRoot $ProjectRoot -PreferVenv

    try {
        $Host.UI.RawUI.WindowTitle = $uiWindow.server_title
    } catch {}

    Write-Host $uiWindow.server_header -ForegroundColor Green
    Write-Host $uiWindow.server_hint -ForegroundColor DarkGray
    Write-Host $uiWindow.server_url -ForegroundColor DarkGray
    Write-Host "Root: $ProjectRoot" -ForegroundColor DarkGray
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

    if (-not $env:PYTHONPATH) {
        $env:PYTHONPATH = $ProjectRoot
    } elseif ($env:PYTHONPATH -notlike "*$ProjectRoot*") {
        $env:PYTHONPATH = "$ProjectRoot;$env:PYTHONPATH"
    }

    Write-Host "Python: $python" -ForegroundColor DarkGray
    Write-Host ""

    Invoke-PythonExe -PythonExe $python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        Write-Host ""
        Write-Host ($uiWindow.server_exit -f $LASTEXITCODE) -ForegroundColor Red
        Read-Host $uiWindow.press_enter
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    Write-Host ""
    try {
        Read-Host "Press Enter to close"
    } catch {}
    exit 1
}

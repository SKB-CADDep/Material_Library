# Material Library - local launch (Windows PowerShell 5.1+)

param(
    [switch]$SkipSetup,
    [switch]$SkipBrowser,
    [switch]$SkipWorkspace
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\customer-launch.ps1"
$ui = Get-LaunchMessages

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DataDir = Join-Path $ProjectRoot "data"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$VenvPip = Join-Path $ProjectRoot ".venv\Scripts\pip.exe"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RunBackend = Join-Path $PSScriptRoot "run-backend.ps1"
$RunFrontend = Join-Path $PSScriptRoot "run-frontend.ps1"
$BackendUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://localhost:5173"
$HealthUrl = "$BackendUrl/api/health"

function Ensure-Setup {
    $pythonExe = Resolve-PythonExe -ProjectRoot $ProjectRoot -PreferVenv
    if (-not $pythonExe) { Fail-PythonMissing }
    if (-not (Test-CommandExists "npm")) { Fail-NodeMissing }

    Write-LaunchStep $ui.setup_venv
    if (-not (Test-Path $VenvPython)) {
        Write-Host $ui.setup_venv_first
        Push-Location -LiteralPath $ProjectRoot
        if ($pythonExe -like "py -*") {
            Invoke-Expression "$pythonExe -m venv .venv"
        } else {
            & $pythonExe -m venv .venv
        }
        Pop-Location
        if (-not (Test-Path $VenvPython)) {
            Show-LaunchFailure $ui.setup_venv_fail_title @($ui.setup_venv_fail_steps)
            exit 1
        }
    }

    Write-LaunchStep $ui.setup_pip
    Write-Host $ui.setup_pip_wait
    & $VenvPip install -r (Join-Path $ProjectRoot "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        Show-LaunchFailure $ui.setup_pip_fail_title @($ui.setup_pip_fail_steps)
        exit 1
    }

    Write-LaunchStep $ui.setup_npm
    Push-Location -LiteralPath $FrontendDir
    npm install
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Show-LaunchFailure $ui.setup_npm_fail_title @($ui.setup_npm_fail_steps)
        exit 1
    }
    Pop-Location
}

function Start-BackendWindow {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $RunBackend
    ) -WindowStyle Normal
}

function Start-FrontendWindow {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $RunFrontend
    ) -WindowStyle Normal
}

function Open-Workspace {
    if (-not (Test-Path -LiteralPath $DataDir)) {
        Write-LaunchWarn ($ui.workspace_missing -f $DataDir)
        Write-Host $ui.workspace_manual
        return
    }

    Write-LaunchStep $ui.workspace_load
    $body = @{ directory = $DataDir } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod `
            -Uri "$BackendUrl/api/workspace/open" `
            -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body $body | Out-Null
        Write-LaunchOk ($ui.workspace_ok -f $DataDir)
    } catch {
        Write-LaunchWarn $ui.workspace_fail
        Write-Host ($ui.workspace_path_hint -f $DataDir)
    }
}

Clear-Host
Write-Host $ui.start_title -ForegroundColor White
Write-Host ($ui.start_project_root -f $ProjectRoot) -ForegroundColor DarkGray
Write-Host $ui.start_hint -ForegroundColor DarkGray
Write-Host ""

try {
    if (Test-PortListening 8000) { Fail-PortBusy 8000 $ui.port_label_backend }
    if (Test-PortListening 5173) { Fail-PortBusy 5173 $ui.port_label_frontend }

    if (-not $SkipSetup) {
        Ensure-Setup
    } elseif (-not (Test-Path -LiteralPath $VenvPython)) {
        Show-LaunchFailure $ui.not_ready_title @($ui.not_ready_steps)
        exit 1
    }

    Write-LaunchStep $ui.backend_start
    Start-BackendWindow

    if (-not (Wait-ForHttp $HealthUrl 90)) { Fail-BackendTimeout }
    Write-LaunchOk $ui.backend_ok

    if (-not $SkipWorkspace) { Open-Workspace }

    Write-LaunchStep $ui.frontend_start
    Start-FrontendWindow

    if (-not (Wait-ForHttp $FrontendUrl 90)) { Fail-FrontendTimeout }
    Write-LaunchOk $ui.frontend_ok

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  $($ui.success_title)" -ForegroundColor Green
    Write-Host "  $($ui.success_url -f $FrontendUrl)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host $ui.success_hint_backend
    Write-Host $ui.success_hint_stop
    Write-Host ""

    if (-not $SkipBrowser) {
        Start-Sleep -Seconds 1
        Start-Process $FrontendUrl
    }
} catch {
    $steps = @($_.Exception.Message) + @($ui.unexpected_steps_extra)
    Show-LaunchFailure $ui.unexpected_title $steps
    exit 1
}

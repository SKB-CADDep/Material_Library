

param(
    [switch]$SkipSetup,
    [switch]$SkipBrowser,
    [switch]$SkipWorkspace
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\customer-launch.ps1"
$ui = Get-LaunchMessages

$ProjectRoot = Get-LaunchProjectRoot -ScriptsDir $PSScriptRoot
$DataDir = Join-Path $ProjectRoot "data"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$VenvPip = Join-Path $ProjectRoot ".venv\Scripts\pip.exe"
$RunWeb = Join-Path $PSScriptRoot "run-web.ps1"
$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
$AppUrl = "http://127.0.0.1:8000"
$HealthUrl = "$AppUrl/api/health"

function Ensure-DevVenv {
    param([string]$PythonExe)

    Write-LaunchStep $ui.setup_venv
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Write-Host $ui.setup_venv_first
        Push-Location -LiteralPath $ProjectRoot
        try {
            if ($PythonExe -like "py -*") {
                Invoke-Expression "$PythonExe -m venv .venv"
            } else {
                & $PythonExe -m venv .venv
            }
        } finally {
            Pop-Location
        }
        if (-not (Test-Path -LiteralPath $VenvPython)) {
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
}

function Ensure-Setup {
    if (Test-PortableRuntimeReady -ProjectRoot $ProjectRoot) {
        Write-LaunchStep $ui.portable_runtime_ok
        return
    }

    $pythonExe = Resolve-PythonExe -ProjectRoot $ProjectRoot
    if (-not $pythonExe) { Fail-PythonMissing }
    Ensure-DevVenv -PythonExe $pythonExe
}

function Start-WebWindow {
    $argList = @(
        "-NoProfile",
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $RunWeb,
        "-ProjectRoot", $ProjectRoot
    )

    $startInfo = @{
        FilePath = "powershell.exe"
        ArgumentList = $argList
        WindowStyle = "Normal"
    }

    if ($ProjectRoot -match '^[A-Za-z]:\\') {
        $startInfo["WorkingDirectory"] = $ProjectRoot
    }

    Start-Process @startInfo | Out-Null
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
            -Uri "$AppUrl/api/workspace/open" `
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
    if (-not (Test-Path -LiteralPath $DistIndex)) {
        Show-LaunchFailure $ui.no_dist_title @($ui.no_dist_steps)
        exit 1
    }

    if (Test-PortListening 8000) { Fail-PortBusy 8000 $ui.port_label_server }

    if (-not $SkipSetup) {
        Ensure-Setup
    } else {
        $readyPython = Resolve-PythonExe -ProjectRoot $ProjectRoot -PreferVenv
        if (-not $readyPython) {
            Show-LaunchFailure $ui.not_ready_title @($ui.not_ready_steps)
            exit 1
        }
    }

    Write-LaunchStep $ui.server_start
    Start-WebWindow

    if (-not (Wait-ForHttp $HealthUrl 90)) { Fail-ServerTimeout }
    Write-LaunchOk $ui.server_ok

    if (-not (Wait-ForHttp $AppUrl 90)) { Fail-UiTimeout }
    Write-LaunchOk $ui.ui_ok

    if (-not $SkipWorkspace) { Open-Workspace }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  $($ui.success_title)" -ForegroundColor Green
    Write-Host "  $($ui.success_url -f $AppUrl)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host $ui.success_hint_window
    Write-Host $ui.success_hint_stop
    Write-Host ""

    if (-not $SkipBrowser) {
        Write-LaunchStep $ui.browser_open
        $resized = Open-CustomerBrowser -Url $AppUrl
        if ($resized) {
            Write-LaunchOk $ui.browser_window_ok
        } else {
            Write-LaunchWarn $ui.browser_window_warn
        }
    }
} catch {
    $steps = @($_.Exception.Message) + @($ui.unexpected_steps_extra)
    Show-LaunchFailure $ui.unexpected_title $steps
    exit 1
}

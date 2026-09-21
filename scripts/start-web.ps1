# Material Library - launch (Python + built frontend)
# Runs from the folder as-is (local disk or file server via pushd drive letter).
# Does NOT copy the app to the PC. Starts python.exe directly (no second .ps1 window).

param(
    [switch]$SkipSetup,
    [switch]$SkipBrowser,
    [switch]$SkipWorkspace
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\customer-launch.ps1"
$ui = Get-LaunchMessages

$ProjectRoot = Get-LaunchProjectRoot -ScriptsDir $PSScriptRoot
# Materials: sibling "data" folder (UNC after pushd/popd). source.json is inside data/.
$DataDir = Resolve-MaterialsDataDir -ProjectRoot $ProjectRoot
$SourceJson = Resolve-SourceJsonPath -ProjectRoot $ProjectRoot -MaterialsDir $DataDir
$DistIndex = Join-Path $ProjectRoot "frontend\dist\index.html"
$WorkDir = $ProjectRoot
if ($ProjectRoot -notmatch '^[A-Za-z]:\\') {
    # Prefer a drive-letter cwd when available (Start-Process cannot use UNC WorkingDirectory).
    $WorkDir = $ProjectRoot
}

$AppUrl = "http://127.0.0.1:8000"
$HealthUrl = "$AppUrl/api/health"
$ServerPidFile = Join-Path $env:TEMP "material-library-server.pid"

function Ensure-DevVenv {
    param([string]$PythonExe)

    $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    $VenvPip = Join-Path $ProjectRoot ".venv\Scripts\pip.exe"

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

function Start-WebServerProcess {
    $python = Resolve-PythonExe -ProjectRoot $ProjectRoot -PreferVenv
    if (-not $python) { Fail-PythonMissing }

    if (Test-Path -LiteralPath $DataDir) {
        $env:MATERIALS_DIR = $DataDir
        Write-Host ("MATERIALS_DIR=" + $DataDir) -ForegroundColor DarkGray
    }
    if ($SourceJson) {
        $env:SOURCE_JSON_PATH = $SourceJson
        Write-Host ("SOURCE_JSON_PATH=" + $SourceJson) -ForegroundColor DarkGray
    }

    $argList = @(
        "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8000"
    )

    # Start python.exe directly — avoids a second PowerShell -File window
    # that corporate policy often kills on network shares.
    $startParams = @{
        FilePath = $python
        ArgumentList = $argList
        WindowStyle = "Normal"
        PassThru = $true
    }

    # Start-Process -WorkingDirectory does not support raw UNC (\\server\...).
    # After Запуск*.bat pushd, ProjectRoot is usually a drive letter (Z:\...).
    if ($WorkDir -match '^[A-Za-z]:\\') {
        $startParams["WorkingDirectory"] = $WorkDir
    } else {
        try {
            Set-Location -LiteralPath $WorkDir
        } catch {
            $env:PYTHONPATH = $WorkDir
        }
    }

    $proc = Start-Process @startParams

    if (-not $proc) {
        throw "Failed to start python/uvicorn process"
    }

    Set-Content -LiteralPath $ServerPidFile -Value $proc.Id -Encoding ASCII
    return $proc
}

function Open-Workspace {
    param([string]$Directory = $DataDir)

    if (-not (Test-Path -LiteralPath $Directory)) {
        Write-LaunchWarn ($ui.workspace_missing -f $Directory)
        Write-Host $ui.workspace_manual
        return
    }

    Write-LaunchStep $ui.workspace_load
    $body = @{ directory = $Directory } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod `
            -Uri "$AppUrl/api/workspace/open" `
            -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body $body | Out-Null
        Write-LaunchOk ($ui.workspace_ok -f $Directory)
    } catch {
        Write-LaunchWarn $ui.workspace_fail
        Write-Host ($ui.workspace_path_hint -f $Directory)
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
    $serverProc = Start-WebServerProcess
    Write-Host ($ui.server_pid_hint -f $serverProc.Id) -ForegroundColor DarkGray

    if (-not (Wait-ForHttp $HealthUrl 90)) {
        if ($serverProc -and -not $serverProc.HasExited) {
            Write-LaunchWarn $ui.server_still_starting
        }
        Fail-ServerTimeout
    }
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

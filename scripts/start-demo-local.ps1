# Material Library local demo launcher (Windows PowerShell 5.1+)
# Run: scripts\Start Demo.bat

param(
    [switch]$SkipSetup,
    [switch]$SkipBrowser,
    [switch]$SkipWorkspace
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$DataDir = Join-Path $ProjectRoot "data"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$VenvPip = Join-Path $ProjectRoot ".venv\Scripts\pip.exe"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RunBackend = Join-Path $ScriptDir "run-backend.ps1"
$RunFrontend = Join-Path $ScriptDir "run-frontend.ps1"
$BackendUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://localhost:5173"
$HealthUrl = "$BackendUrl/api/health"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-ForHttp([string]$Url, [int]$TimeoutSec = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

function Ensure-Setup {
    if (-not (Test-CommandExists "python")) {
        throw "Python not found. Install Python 3.10+ and add to PATH."
    }
    if (-not (Test-CommandExists "npm")) {
        throw "Node.js/npm not found. Install Node.js 20 LTS."
    }

    Write-Step "Python virtual environment"
    if (-not (Test-Path $VenvPython)) {
        Write-Host "Creating .venv (first run may take a few minutes)..."
        Push-Location -LiteralPath $ProjectRoot
        python -m venv .venv
        Pop-Location
    }

    Write-Step "Installing Python packages"
    & $VenvPip install -r (Join-Path $ProjectRoot "requirements.txt") -q

    Write-Step "Installing frontend packages"
    Push-Location -LiteralPath $FrontendDir
    if (-not (Test-Path "node_modules")) {
        npm install
    } else {
        Write-Host "node_modules exists, skipping npm install"
    }
    Pop-Location
}

function Start-BackendWindow {
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $RunBackend
    ) -WindowStyle Normal
}

function Start-FrontendWindow {
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $RunFrontend
    ) -WindowStyle Normal
}

function Open-Workspace {
    if (-not (Test-Path -LiteralPath $DataDir)) {
        Write-Host "Data folder not found: $DataDir" -ForegroundColor Yellow
        Write-Host "Enter the path manually on the start screen."
        return
    }

    Write-Step "Opening workspace"
    $body = @{ directory = $DataDir } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod `
            -Uri "$BackendUrl/api/workspace/open" `
            -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body $body | Out-Null
        Write-Host "Workspace opened: $DataDir"
    } catch {
        Write-Host "Could not open workspace automatically: $_" -ForegroundColor Yellow
        Write-Host "Enter path manually: $DataDir"
    }
}

Clear-Host
Write-Host "Material Library - local start" -ForegroundColor White
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

try {
    if (-not $SkipSetup) {
        Ensure-Setup
    } elseif (-not (Test-Path -LiteralPath $VenvPython)) {
        throw "Virtual environment not found. Run without -SkipSetup first."
    }

    Write-Step "Starting backend on port 8000"
    Start-BackendWindow

    if (-not (Wait-ForHttp $HealthUrl 90)) {
        throw "Backend did not respond in 90s. Check the BACKEND window."
    }
    Write-Host "Backend is ready."

    if (-not $SkipWorkspace) {
        Open-Workspace
    }

    Write-Step "Starting frontend on port 5173"
    Start-FrontendWindow

    if (-not (Wait-ForHttp $FrontendUrl 90)) {
        throw "Frontend did not respond in 90s. Check the FRONTEND window."
    }
    Write-Host "Frontend is ready."

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Site: $FrontendUrl" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Keep BACKEND and FRONTEND windows open during the demo."
    Write-Host "To stop: run scripts\Stop Demo.bat or close both windows."

    if (-not $SkipBrowser) {
        Start-Sleep -Seconds 1
        Start-Process $FrontendUrl
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

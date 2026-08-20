param(
    [switch]$SkipSmoke,
    [switch]$SkipNpmCi
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$DataDir = Join-Path $ProjectRoot "data"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Requirements = Join-Path $ProjectRoot "requirements.txt"
$SmokeScript = Join-Path $ScriptDir "smoke_api.py"
$HealthUrl = "http://127.0.0.1:8000/api/health"

$BackendProc = $null
$StartedBackend = $false
$Steps = @()

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PythonExecutable {
    if (Test-Path -LiteralPath $VenvPython) {
        return $VenvPython
    }
    if (-not (Test-CommandExists "python")) {
        throw "Python not found. Install Python 3.11+ or create .venv. See README.md."
    }
    return (Get-Command "python").Source
}

function Assert-PythonVersion([string]$PythonExe) {
    $versionText = (& $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
    $parts = $versionText.Split(".")
    if ($parts.Count -lt 2) {
        throw "Could not detect Python version. Need Python 3.11+. See README.md."
    }

    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 11)) {
        throw "Python 3.11+ required (found $versionText). See README.md."
    }
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
            Start-Sleep -Milliseconds 400
        }
    }
    return $false
}

function Stop-BackendIfStarted {
    if ($StartedBackend -and $BackendProc -and -not $BackendProc.HasExited) {
        Write-Host "Stopping temporary backend (PID $($BackendProc.Id))..." -ForegroundColor DarkGray
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Step $Name
    try {
        & $Action
        if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "Step failed with exit code $LASTEXITCODE"
        }
        $script:Steps += [pscustomobject]@{ Step = $Name; Status = "PASS" }
    } catch {
        $script:Steps += [pscustomobject]@{ Step = $Name; Status = "FAIL"; Detail = $_.Exception.Message }
        throw
    }
}

try {
    Write-Host "Material Library - release check" -ForegroundColor White
    Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

    $PythonExe = Get-PythonExecutable
    Assert-PythonVersion $PythonExe
    Write-Host "Python: $PythonExe" -ForegroundColor DarkGray

    if (-not (Test-CommandExists "npm")) {
        throw "Node.js/npm not found. Install Node.js 20 LTS. See README.md."
    }

    if (-not (Test-Path -LiteralPath $DataDir)) {
        throw "Data folder not found: $DataDir"
    }

    Invoke-Step "1/4 pytest baseline + coverage" {
        Push-Location -LiteralPath $ProjectRoot
        & $PythonExe scripts/check_pytest_baseline.py
        if ($LASTEXITCODE -ne 0) { throw "pytest baseline check failed" }
        & $PythonExe -m pytest tests/ -v --tb=short `
            --cov=src --cov=backend `
            --cov-config=.coveragerc `
            --cov-report=term-missing `
            --cov-report=json:coverage.json
        if ($LASTEXITCODE -ne 0) { throw "pytest failed" }
        & $PythonExe scripts/check_pytest_coverage.py coverage.json
        if ($LASTEXITCODE -ne 0) { throw "pytest coverage thresholds failed" }
        Pop-Location
    }

    Invoke-Step "2/4 frontend build + vitest coverage" {
        Push-Location -LiteralPath $FrontendDir
        if ($SkipNpmCi) {
            npm run build
        } else {
            npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
            npm run build
        }
        if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
        npm run test:coverage
        if ($LASTEXITCODE -ne 0) { throw "vitest coverage failed" }
        Pop-Location
    }

    if (-not $SkipSmoke) {
        Invoke-Step "3/4 smoke_api (live API)" {
            if (-not (Wait-ForHttp $HealthUrl 3)) {
                Write-Host "Starting temporary backend on :8000 (MATERIALS_DIR=$DataDir)..." -ForegroundColor DarkGray
                $env:MATERIALS_DIR = $DataDir
                $BackendProc = Start-Process `
                    -FilePath $PythonExe `
                    -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000") `
                    -WorkingDirectory $ProjectRoot `
                    -PassThru `
                    -WindowStyle Hidden
                $script:StartedBackend = $true
                $script:BackendProc = $BackendProc

                if (-not (Wait-ForHttp $HealthUrl 90)) {
                    throw "Backend did not respond on $HealthUrl within 90s"
                }
            } else {
                Write-Host "Using existing backend at $HealthUrl" -ForegroundColor DarkGray
            }

            Push-Location -LiteralPath $ProjectRoot
            if ($StartedBackend) {
                $env:MATERIALS_DIR = $DataDir
            }
            & $PythonExe $SmokeScript
            Pop-Location
        }
    } else {
        Write-Host ""
        Write-Host "Skipped: smoke_api (-SkipSmoke)" -ForegroundColor Yellow
        $Steps += [pscustomobject]@{ Step = "3/4 smoke_api"; Status = "SKIP" }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  RELEASE CHECK: PASS" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    foreach ($item in $Steps) {
        $color = switch ($item.Status) {
            "PASS" { "Green" }
            "SKIP" { "Yellow" }
            default { "Red" }
        }
        Write-Host ("  {0,-24} {1}" -f $item.Step, $item.Status) -ForegroundColor $color
    }
    exit 0
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  RELEASE CHECK: FAIL" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    foreach ($item in $Steps) {
        $color = if ($item.Status -eq "PASS") { "Green" } else { "Red" }
        $detail = if ($item.Detail) { ": $($item.Detail)" } else { "" }
        Write-Host ("  {0,-24} {1}{2}" -f $item.Step, $item.Status, $detail) -ForegroundColor $color
    }
    exit 1
} finally {
    Stop-BackendIfStarted
}

# Launch helpers for Material Library (PowerShell 5.1+, ASCII source)

try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$Script:LaunchMessages = $null

function Get-LaunchMessages {
    if ($Script:LaunchMessages) { return $Script:LaunchMessages }
    $path = Join-Path $PSScriptRoot "launch-messages.json"
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Ne nayden fayl soobshcheniy: $path"
    }
    $Script:LaunchMessages = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    return $Script:LaunchMessages
}

function Write-LaunchStep([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-LaunchOk([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}

function Write-LaunchWarn([string]$Message) {
    Write-Host $Message -ForegroundColor Yellow
}

function Show-LaunchFailure([string]$Title, [string[]]$Steps) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  $Title" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    foreach ($step in $Steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-PortListening([int]$Port) {
    $pattern = ":$Port\s"
    $lines = netstat -ano 2>$null | Select-String $pattern | Select-String "LISTENING"
    return [bool]$lines
}

function Get-PidsOnPort([int]$Port) {
    $pids = @()
    $pattern = ":$Port\s"
    netstat -ano 2>$null | Select-String $pattern | Select-String "LISTENING" | ForEach-Object {
        $parts = ($_.Line -split "\s+") | Where-Object { $_ -ne "" }
        if ($parts.Count -ge 1) {
            $pidText = $parts[-1]
            if ($pidText -match '^\d+$') { $pids += [int]$pidText }
        }
    }
    return $pids | Select-Object -Unique
}

function Stop-PortListeners([int[]]$Ports) {
    $msg = Get-LaunchMessages
    foreach ($port in $Ports) {
        foreach ($procId in Get-PidsOnPort $port) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-LaunchOk ($msg.stop_ok -f $procId, $port)
            } catch {
                Write-LaunchWarn ($msg.stop_fail -f $procId, $port, $_.Exception.Message)
            }
        }
    }
}

function Wait-ForHttp([string]$Url, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    return $false
}

function Invoke-PythonExe {
    param([string]$PythonExe, [Parameter(ValueFromRemainingArguments = $true)][string[]]$PythonArgs)
    if ($PythonExe -match '^py\s+-') {
        $launcher = ($PythonExe -split '\s+', 2)[0]
        $launcherArgs = ($PythonExe -split '\s+', 2)[1]
        & $launcher $launcherArgs @PythonArgs
    } else {
        & $PythonExe @PythonArgs
    }
}

function Parse-PythonVersionLine([string]$Line) {
    if ($Line -match 'Python\s+(\d+)\.(\d+)') {
        return @{
            Text = "$($Matches[1]).$($Matches[2])"
            Major = [int]$Matches[1]
            Minor = [int]$Matches[2]
        }
    }
    return $null
}

function Get-PythonVersion([string]$PythonExe) {
    try {
        if ($PythonExe -match '^py\s+-') {
            $launcher = ($PythonExe -split '\s+', 2)[0]
            $launcherArgs = ($PythonExe -split '\s+', 2)[1]
            $line = (& $launcher $launcherArgs --version 2>&1 | Select-Object -First 1).ToString().Trim()
        } else {
            $line = (& $PythonExe --version 2>&1 | Select-Object -First 1).ToString().Trim()
        }
        return Parse-PythonVersionLine $line
    } catch {
        return $null
    }
}

function Test-Python311Plus($VersionInfo) {
    return $VersionInfo -and ($VersionInfo.Major -gt 3 -or ($VersionInfo.Major -eq 3 -and $VersionInfo.Minor -ge 11))
}

function Resolve-PythonExe {
    param([string]$ProjectRoot, [switch]$PreferVenv)
    $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if ($PreferVenv -and (Test-Path -LiteralPath $VenvPython)) {
        $venvVersion = Get-PythonVersion $VenvPython
        if (Test-Python311Plus $venvVersion) { return $VenvPython }
    }
    if (Test-CommandExists "python") {
        $pythonVersion = Get-PythonVersion "python"
        if (Test-Python311Plus $pythonVersion) { return "python" }
    }
    if (Test-CommandExists "py") {
        foreach ($tag in @("3.13", "3.12", "3.11")) {
            $candidate = "py -$tag"
            try {
                $pyVersion = Get-PythonVersion $candidate
                if (Test-Python311Plus $pyVersion) { return $candidate }
            } catch { continue }
        }
    }
    return $null
}

function Fail-PythonMissing {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.python_missing_title @($msg.python_missing_steps)
    exit 1
}

function Fail-NodeMissing {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.node_missing_title @($msg.node_missing_steps)
    exit 1
}

function Fail-PortBusy([int]$Port, [string]$Label) {
    $msg = Get-LaunchMessages
    Show-LaunchFailure ($msg.port_busy_title -f $Port, $Label) @($msg.port_busy_steps)
    exit 1
}

function Fail-BackendTimeout {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.backend_timeout_title @($msg.backend_timeout_steps)
    exit 1
}

function Fail-FrontendTimeout {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.frontend_timeout_title @($msg.frontend_timeout_steps)
    exit 1
}

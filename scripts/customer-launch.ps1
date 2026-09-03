# Launch helpers for Material Library

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

function Get-NativeFilesystemPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) { return $Path }

    if ($Path -match '::(.+)$') {
        $Path = $Matches[1]
    }

    try {
        $item = Get-Item -LiteralPath $Path -ErrorAction Stop
        if ($item.PSPath -and $item.PSPath -match '::(.+)$') {
            return $Matches[1]
        }
        if ($item.FullName) { return $item.FullName }
    } catch {}

    try {
        $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
        if ($resolved.ProviderPath) { return $resolved.ProviderPath }
        if ($resolved.Path -match '::(.+)$') { return $Matches[1] }
        return $resolved.Path
    } catch {
        return $Path
    }
}

function Get-LaunchProjectRoot {
    param([string]$ScriptsDir = $PSScriptRoot)
    $parent = Join-Path $ScriptsDir ".."
    try {
        return Get-NativeFilesystemPath ((Resolve-Path -LiteralPath $parent).ProviderPath)
    } catch {
        return Get-NativeFilesystemPath ([System.IO.Path]::GetFullPath($parent))
    }
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

function Initialize-CustomerBrowserWindowApi {
    if ($Script:CustomerBrowserWindowApiReady) { return }

    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NativeWindowHelper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

    Add-Type -AssemblyName System.Windows.Forms
    $Script:CustomerBrowserWindowApiReady = $true
}

function Get-CustomerBrowserCandidates {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Yandex\YandexBrowser\Application\browser.exe"),
        "${env:ProgramFiles}\Yandex\YandexBrowser\Application\browser.exe",
        "${env:ProgramFiles(x86)}\Yandex\YandexBrowser\Application\browser.exe",
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    )

    $found = @()
    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            $found += $path
        }
    }
    return $found
}

function Maximize-CustomerBrowserWindow {
    param(
        [int]$WaitSec = 15,
        [string]$ProcessNameHint = ""
    )

    Initialize-CustomerBrowserWindowApi

    $titlePattern = 'Material Library|Material_Lib|127\.0\.0\.1:8000|localhost:8000|frontend'
    $deadline = (Get-Date).AddSeconds($WaitSec)
    while ((Get-Date) -lt $deadline) {
        $processes = Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }
        if ($ProcessNameHint) {
            $preferred = $processes | Where-Object { $_.ProcessName -ieq $ProcessNameHint }
            if ($preferred) { $processes = $preferred }
        }

        $window = $processes |
            Where-Object { $_.MainWindowTitle -match $titlePattern } |
            Sort-Object StartTime -Descending |
            Select-Object -First 1

        if (-not $window -and $ProcessNameHint) {
            $window = Get-Process -Name $ProcessNameHint -ErrorAction SilentlyContinue |
                Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
                Sort-Object StartTime -Descending |
                Select-Object -First 1
        }

        if ($window) {
            # SW_MAXIMIZE = 3
            [NativeWindowHelper]::ShowWindow($window.MainWindowHandle, 3) | Out-Null
            [NativeWindowHelper]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
            return $true
        }

        Start-Sleep -Milliseconds 400
    }

    return $false
}

function Open-CustomerBrowser {
    param([Parameter(Mandatory = $true)][string]$Url)


    $browserExe = Get-CustomerBrowserCandidates | Select-Object -First 1
    $processHint = ""

    if ($browserExe) {
        Start-Process -FilePath $browserExe -ArgumentList @($Url) | Out-Null
        $leaf = [System.IO.Path]::GetFileNameWithoutExtension($browserExe)
        if ($leaf -ieq "browser") {
            $processHint = "browser"
        } elseif ($leaf -ieq "msedge") {
            $processHint = "msedge"
        } elseif ($leaf -ieq "chrome") {
            $processHint = "chrome"
        }
    } else {
        Start-Process $Url | Out-Null
    }

    return (Maximize-CustomerBrowserWindow -ProcessNameHint $processHint)
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

function Get-PortablePythonExe {
    param([string]$ProjectRoot)
    Join-Path $ProjectRoot "runtime\python\python.exe"
}

function Test-PortableRuntimeReady {
    param([string]$ProjectRoot)
    $python = Get-PortablePythonExe -ProjectRoot $ProjectRoot
    if (-not (Test-Path -LiteralPath $python)) { return $false }
    $marker = Join-Path $ProjectRoot "runtime\python\.runtime-ready"
    if (Test-Path -LiteralPath $marker) { return $true }
    try {
        & $python -c "import uvicorn" 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Resolve-PythonExe {
    param([string]$ProjectRoot, [switch]$PreferVenv)
    $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if ($PreferVenv -and (Test-Path -LiteralPath $VenvPython)) {
        $venvVersion = Get-PythonVersion $VenvPython
        if (Test-Python311Plus $venvVersion) { return $VenvPython }
    }

    $PortablePython = Get-PortablePythonExe -ProjectRoot $ProjectRoot
    if (Test-PortableRuntimeReady -ProjectRoot $ProjectRoot) {
        return $PortablePython
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

function Fail-PortBusy([int]$Port, [string]$Label) {
    $msg = Get-LaunchMessages
    Show-LaunchFailure ($msg.port_busy_title -f $Port, $Label) @($msg.port_busy_steps)
    exit 1
}

function Fail-BackendTimeout {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.server_timeout_title @($msg.server_timeout_steps)
    exit 1
}

function Fail-ServerTimeout {
    Fail-BackendTimeout
}

function Fail-UiTimeout {
    $msg = Get-LaunchMessages
    Show-LaunchFailure $msg.ui_timeout_title @($msg.ui_timeout_steps)
    exit 1
}

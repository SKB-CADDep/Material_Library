param(
    [string]$PythonVersion = "3.12.8",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RuntimeDir = Join-Path $ProjectRoot "runtime\python"
$RuntimePython = Join-Path $RuntimeDir "python.exe"
$Requirements = Join-Path $ProjectRoot "requirements-runtime.txt"
$Marker = Join-Path $RuntimeDir ".runtime-ready"
$Arch = "amd64"
$ZipName = "python-$PythonVersion-embed-$Arch.zip"
$DownloadUrl = "https://www.python.org/ftp/python/$PythonVersion/$ZipName"
$CacheDir = Join-Path $ProjectRoot ".cache\python-embed"
$ZipPath = Join-Path $CacheDir $ZipName

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Enable-EmbeddableSitePackages {
    param([string]$TargetDir)
    $pth = Get-ChildItem -LiteralPath $TargetDir -Filter "python*._pth" | Select-Object -First 1
    if (-not $pth) {
        throw "python*._pth not found in $TargetDir"
    }

    $sitePackages = Join-Path $TargetDir "Lib\site-packages"
    New-Item -ItemType Directory -Force -Path $sitePackages | Out-Null

    $lines = Get-Content -LiteralPath $pth.FullName
    $normalized = @()
    $hasSitePackages = $false
    $hasImportSite = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*#\s*import site\s*$') {
            $normalized += "import site"
            $hasImportSite = $true
            continue
        }
        if ($line -eq "import site") { $hasImportSite = $true }
        if ($line -ieq "Lib\site-packages") { $hasSitePackages = $true }
        $normalized += $line
    }
    if (-not $hasSitePackages) { $normalized += "Lib\site-packages" }
    if (-not $hasImportSite) { $normalized += "import site" }
    Set-Content -LiteralPath $pth.FullName -Value $normalized -Encoding ASCII
}

Write-Host "Material Library - portable Python runtime" -ForegroundColor White
Write-Host "Target: $RuntimeDir" -ForegroundColor DarkGray

if ((Test-Path -LiteralPath $Marker) -and (Test-Path -LiteralPath $RuntimePython) -and -not $Force) {
    Write-Host "Already prepared ($Marker). Use -Force to rebuild." -ForegroundColor Green
    exit 0
}

if (-not (Test-Path -LiteralPath $Requirements)) {
    throw "Missing requirements file: $Requirements"
}

Write-Step "Download embeddable Python $PythonVersion ($Arch)"
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
if (-not (Test-Path -LiteralPath $ZipPath)) {
    Write-Host "URL: $DownloadUrl" -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
} else {
    Write-Host "Using cached zip: $ZipPath" -ForegroundColor DarkGray
}

Write-Step "Extract to runtime/python"
if (Test-Path -LiteralPath $RuntimeDir) {
    Remove-Item -LiteralPath $RuntimeDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Expand-Archive -LiteralPath $ZipPath -DestinationPath $RuntimeDir -Force
Enable-EmbeddableSitePackages -TargetDir $RuntimeDir

Write-Step "Bootstrap pip"
$GetPip = Join-Path $CacheDir "get-pip.py"
if (-not (Test-Path -LiteralPath $GetPip)) {
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPip
}
& $RuntimePython $GetPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip.py failed with exit code $LASTEXITCODE" }

Write-Step "Install runtime dependencies"
& $RuntimePython -m pip install --no-warn-script-location -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "pip install failed with exit code $LASTEXITCODE" }

Write-Step "Verify imports"
& $RuntimePython -c "import fastapi, uvicorn, pydantic, httpx, jsonschema; print('ok')"
if ($LASTEXITCODE -ne 0) { throw "Runtime verification failed" }

@{
    python_version = $PythonVersion
    prepared_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -LiteralPath $Marker -Encoding UTF8

Write-Host ""
Write-Host "Portable runtime ready: $RuntimePython" -ForegroundColor Green
Write-Host "Include runtime/ in the customer archive." -ForegroundColor DarkGray

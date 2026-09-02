param(
    [string]$OutputZip = "",
    [string]$PythonVersion = "3.12.8",
    [switch]$SkipFrontendBuild,
    [switch]$SkipPortablePython
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Staging = Join-Path $ProjectRoot "dist-customer\Material_Library"
$RuntimeMarker = Join-Path $ProjectRoot "runtime\python\.runtime-ready"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Copy-Tree([string]$RelativePath) {
    $source = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing path for packaging: $RelativePath"
    }
    $target = Join-Path $Staging $RelativePath
    $parent = Split-Path -Parent $target
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

Write-Host "Material Library - customer package" -ForegroundColor White
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

if (-not $SkipFrontendBuild) {
    & (Join-Path $PSScriptRoot "build-frontend-web.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipPortablePython) {
    & (Join-Path $PSScriptRoot "prepare-portable-python.ps1") -PythonVersion $PythonVersion
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} elseif (-not (Test-Path -LiteralPath $RuntimeMarker)) {
    throw "Portable runtime is not prepared. Run scripts\prepare-portable-python.ps1 first."
}

Write-Step "Stage customer folder"
if (Test-Path -LiteralPath $Staging) {
    Remove-Item -LiteralPath $Staging -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

$paths = @(
    "backend",
    "src",
    "config",
    "data",
    "frontend\dist",
    "runtime",
    "scripts\customer-launch.ps1",
    "scripts\launch-messages.json",
    "scripts\launch-window-messages.json",
    "scripts\start-web.ps1",
    "scripts\run-web.ps1",
    "scripts\stop-web.ps1",
    "requirements-runtime.txt"
)
foreach ($relative in $paths) { Copy-Tree $relative }

Get-ChildItem -LiteralPath $ProjectRoot -File -Filter "*.bat" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Staging $_.Name) -Force
}
$excludeRootTxt = @("app_list.txt", "instruction_list.txt", "change_list.txt")
Get-ChildItem -LiteralPath $ProjectRoot -File -Filter "*.txt" | Where-Object {
    $excludeRootTxt -notcontains $_.Name
} | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Staging $_.Name) -Force
}

Write-Step "Package summary"
$sizeMb = [math]::Round(((Get-ChildItem -LiteralPath $Staging -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "Folder: $Staging" -ForegroundColor Green
Write-Host "Approx size: $sizeMb MB" -ForegroundColor DarkGray

if ($OutputZip) {
    Write-Step "Create zip"
    if (Test-Path -LiteralPath $OutputZip) {
        Remove-Item -LiteralPath $OutputZip -Force
    }
    Compress-Archive -LiteralPath $Staging -DestinationPath $OutputZip -Force
    Write-Host "Zip: $OutputZip" -ForegroundColor Green
}

Write-Host ""
Write-Host 'Customer package ready: Windows 10+, run the bat file. Python is bundled.' -ForegroundColor Green

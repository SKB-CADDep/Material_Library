
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js (npm) not found. Install Node.js 20 LTS to build the UI." -ForegroundColor Red
    exit 1
}

Write-Host "==> Building frontend for web distribution (VITE_API_URL=/api)..." -ForegroundColor Cyan
Push-Location -LiteralPath $FrontendDir
try {
    if (-not (Test-Path -LiteralPath "node_modules")) {
        Write-Host "Installing npm dependencies..." -ForegroundColor DarkGray
        npm ci
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    $env:VITE_API_URL = "/api"
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

$dist = Join-Path $FrontendDir "dist"
if (-not (Test-Path -LiteralPath (Join-Path $dist "index.html"))) {
    Write-Host "Build finished but index.html is missing in frontend/dist" -ForegroundColor Red
    exit 1
}

Write-Host "OK: $dist" -ForegroundColor Green

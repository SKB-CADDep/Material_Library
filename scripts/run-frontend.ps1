$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FrontendDir = Join-Path $ProjectRoot "frontend"
Set-Location -LiteralPath $FrontendDir

try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$msgPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "launch-window-messages.json"
$ui = Get-Content -LiteralPath $msgPath -Raw -Encoding UTF8 | ConvertFrom-Json

$Host.UI.RawUI.WindowTitle = $ui.frontend_title

Write-Host $ui.frontend_header -ForegroundColor Green
Write-Host $ui.frontend_hint -ForegroundColor DarkGray
Write-Host $ui.frontend_url -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host $ui.frontend_no_node_title -ForegroundColor Red
    Write-Host ""
    Write-Host $ui.what_to_do -ForegroundColor Yellow
    foreach ($step in $ui.frontend_no_node_steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
    Read-Host $ui.press_enter
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "node_modules"))) {
    Write-Host $ui.frontend_no_modules_title -ForegroundColor Red
    Write-Host ""
    Write-Host $ui.what_to_do -ForegroundColor Yellow
    foreach ($step in $ui.frontend_no_modules_steps) {
        Write-Host "  - $step"
    }
    Write-Host ""
    Read-Host $ui.press_enter
    exit 1
}

npm run dev
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
    Write-Host ""
    Write-Host ($ui.frontend_exit -f $LASTEXITCODE) -ForegroundColor Red
    Write-Host $ui.frontend_port_busy -ForegroundColor Yellow
    Read-Host $ui.press_enter
    exit $LASTEXITCODE
}

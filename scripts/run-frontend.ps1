$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FrontendDir = Join-Path $ProjectRoot "frontend"
Set-Location -LiteralPath $FrontendDir
Write-Host "Material Library - FRONTEND (do not close)" -ForegroundColor Green
Write-Host "Site: http://localhost:5173" -ForegroundColor DarkGray
npm run dev

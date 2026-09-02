$ErrorActionPreference = "SilentlyContinue"
. "$PSScriptRoot\customer-launch.ps1"
$ui = Get-LaunchMessages

Clear-Host
Write-Host $ui.stop_header -ForegroundColor White
Write-Host ""

Stop-PortListeners @(8000)

Write-Host ""
Write-LaunchOk $ui.stop_done
Write-Host ""

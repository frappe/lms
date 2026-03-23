# start.ps1 - Start Frappe LMS services
$NSSM = if (Test-Path "$PSScriptRoot\nssm.exe") { "$PSScriptRoot\nssm.exe" } else { "nssm" }
& $NSSM start BreezeLMS
Write-Host "Frappe LMS starting (service handles containers + port proxy)."

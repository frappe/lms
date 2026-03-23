# start.ps1 - Start Frappe LMS services
$NSSM = if (Test-Path "$PSScriptRoot\nssm.exe") { "$PSScriptRoot\nssm.exe" } else { "nssm" }
& $NSSM start FrappeLMS
Write-Host "Frappe LMS starting (service handles containers + port proxy)."

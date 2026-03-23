# uninstall.ps1 - Remove Frappe LMS
$WSL = "wsl.exe"
$LMS_DIR = "/opt/frappe-lms"
$NSSM = if (Test-Path "$PSScriptRoot\nssm.exe") { "$PSScriptRoot\nssm.exe" } else { "nssm" }

Write-Host "Stopping service..."
& $NSSM stop BreezeLMS 2>$null
& $NSSM remove BreezeLMS confirm 2>$null

Write-Host "Stopping containers..."
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose down -v 2>/dev/null"

Write-Host "Removing port proxy and firewall rule..."
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0 2>$null
netsh advfirewall firewall delete rule name="Breeze-LMS" 2>$null

Write-Host "Cleaning up WSL files..."
& $WSL -u root -- rm -rf $LMS_DIR

Write-Host "Frappe LMS uninstalled." -ForegroundColor Yellow

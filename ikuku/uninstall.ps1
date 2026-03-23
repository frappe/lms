# uninstall.ps1 - Remove Frappe LMS
$WSL = "wsl.exe"
$LMS_DIR = "/opt/frappe-lms"
$NSSM = if (Test-Path "$PSScriptRoot\nssm.exe") { "$PSScriptRoot\nssm.exe" } else { "nssm" }

# Read port from config
$Port = "8000"
$confFile = "$PSScriptRoot\lms.conf"
if (Test-Path $confFile) {
    $line = Get-Content $confFile | Where-Object { $_ -match "^LMS_PORT=" }
    if ($line) { $Port = ($line -split '=', 2)[1].Trim() }
}

Write-Host "Stopping service..."
& $NSSM stop FrappeLMS 2>$null
& $NSSM remove FrappeLMS confirm 2>$null

Write-Host "Stopping containers..."
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose down -v 2>/dev/null"

Write-Host "Removing port proxy and firewall rule..."
netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null
netsh advfirewall firewall delete rule name="Frappe-LMS" 2>$null

Write-Host "Cleaning up WSL files..."
& $WSL -u root -- rm -rf $LMS_DIR

Write-Host "Frappe LMS uninstalled." -ForegroundColor Yellow

# uninstall.ps1 - Remove Frappe LMS
$WSL = "C:\Program Files\WSL\wsl.exe"
$LMS_DIR = "/opt/frappe-lms"

Write-Host "Stopping services..."
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose down -v 2>/dev/null"

Write-Host "Removing port proxy and firewall rule..."
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0 2>$null
netsh advfirewall firewall delete rule name="Breeze-LMS" 2>$null

Write-Host "Removing scheduled task..."
Unregister-ScheduledTask -TaskName 'BreezeLMS' -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "Cleaning up WSL files..."
& $WSL -u root -- rm -rf $LMS_DIR

Write-Host "Frappe LMS uninstalled." -ForegroundColor Yellow

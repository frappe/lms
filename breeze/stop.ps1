# stop.ps1 - Stop Frappe LMS services
$WSL = "C:\Program Files\WSL\wsl.exe"
$LMS_DIR = "/opt/frappe-lms"

& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose down"
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0 2>$null
Write-Host "Frappe LMS stopped."

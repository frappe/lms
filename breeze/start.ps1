# start.ps1 - Start Frappe LMS services
$WSL = "C:\Program Files\WSL\wsl.exe"
$LMS_DIR = "/opt/frappe-lms"

& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose up -d"
Start-Sleep 5
& $PSScriptRoot\update-portproxy.ps1
Write-Host "Frappe LMS started at http://$($env:COMPUTERNAME):8000"

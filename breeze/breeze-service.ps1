# breeze-service.ps1 - NSSM service entry point
# Sequence: start containers → wait for ready → refresh port proxy → keep WSL alive
$WSL = "wsl.exe"
$LMS_DIR = "/opt/frappe-lms"

# Start containers
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose up -d"

# Wait for containers to be listening before setting up port proxy
$retries = 30
for ($i = 0; $i -lt $retries; $i++) {
    $ok = & $WSL -u root -- bash -c "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000 2>/dev/null"
    if ($ok -eq "200") { break }
    Start-Sleep 2
}

# Refresh port proxy (WSL IP changes on reboot)
& "$PSScriptRoot\update-portproxy.ps1"

# Keep WSL alive (NSSM monitors this process)
& $WSL -u root -- sleep infinity

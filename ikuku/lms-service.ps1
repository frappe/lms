# lms-service.ps1 - Scheduled task entry point
# Sequence: wait for systemd → start containers → wait for ready → port proxy → keepalive
$WSL = "wsl.exe"
$LMS_DIR = "/opt/frappe-lms"

# Wait for WSL systemd to be ready (takes a few seconds after WSL starts)
for ($i = 0; $i -lt 30; $i++) {
    $state = & $WSL -u root -- bash -c "systemctl is-system-running 2>/dev/null || echo waiting"
    if ($state -match "running|degraded") { break }
    Start-Sleep 2
}

# Clean stale containers (WSL restart leaves them in bad state) then start fresh
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose down 2>/dev/null; podman-compose up -d"

# Wait for HTTP 200 before setting up port proxy
for ($i = 0; $i -lt 30; $i++) {
    $ok = & $WSL -u root -- bash -c "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000 2>/dev/null"
    if ($ok -eq "200") { break }
    Start-Sleep 2
}

# Refresh port proxy (WSL IP changes on reboot)
& "$PSScriptRoot\update-portproxy.ps1"

# Keep WSL alive (task stays running, WSL won't shut down)
& $WSL -u root -- sleep infinity

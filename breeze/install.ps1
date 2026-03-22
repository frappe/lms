# install.ps1 - Install Frappe LMS on Windows via WSL2 + Podman
$ErrorActionPreference = "Stop"
$WSL = "C:\Program Files\WSL\wsl.exe"
$LMS_DIR = "/opt/frappe-lms"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Read config from wizard (or use defaults)
$conf = @{ SITE_NAME="lms.local"; ADMIN_EMAIL="admin@example.com"; ADMIN_PASSWORD="admin"; LMS_PORT="8000" }
$confFile = Join-Path $scriptDir "breeze.conf"
if (Test-Path $confFile) {
    Get-Content $confFile | ForEach-Object {
        $k, $v = $_ -split '=', 2
        if ($k -and $v) { $conf[$k.Trim()] = $v.Trim() }
    }
}

Write-Host "=== Breeze: Installing Frappe LMS ===" -ForegroundColor Cyan
Write-Host "Site: $($conf.SITE_NAME) | Port: $($conf.LMS_PORT)"

# Ensure podman is installed in WSL
Write-Host "Checking podman..."
$podmanCheck = & $WSL -u root -- which podman 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing podman and podman-compose..."
    & $WSL -u root -- bash -c "apt-get update && apt-get install -y podman podman-compose > /dev/null 2>&1 && echo 'unqualified-search-registries = [""docker.io""]' >> /etc/containers/registries.conf"
}

# Copy docker config into WSL
Write-Host "Setting up LMS in WSL..."
& $WSL -u root -- bash -c "mkdir -p $LMS_DIR && cp -r /mnt/c/frappe-lms/docker/* $LMS_DIR/"

# Start services
Write-Host "Starting LMS services..."
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose up -d"

# Wait for services to be ready
Write-Host "Waiting for services to start..."
Start-Sleep 10

# Port forwarding
& $PSScriptRoot\update-portproxy.ps1 -Port $conf.LMS_PORT

# Firewall rule
netsh advfirewall firewall add rule name="Breeze-LMS" dir=in action=allow protocol=TCP localport=$($conf.LMS_PORT)

# Register as startup task
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -File $PSScriptRoot\start.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName 'BreezeLMS' -Action $action -Trigger $trigger -User 'SYSTEM' -RunLevel Highest -Force

Write-Host ""
Write-Host "=== Frappe LMS installed! ===" -ForegroundColor Green
Write-Host "Access at: http://$($env:COMPUTERNAME):8000"
Write-Host "Or: http://localhost:8000"

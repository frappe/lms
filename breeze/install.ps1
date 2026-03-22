# install.ps1 - Install Frappe LMS on Windows via WSL2 + Podman
$ErrorActionPreference = "Stop"
$WSL = "wsl.exe"
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

# Step 0: Check WSL2 support
$wslVersion = & $WSL -l -v 2>&1 | Out-String
if ($wslVersion -match "VERSION\s+1" -and $wslVersion -notmatch "VERSION\s+2") {
    Write-Host "WARNING: WSL is running in version 1 mode." -ForegroundColor Yellow
    Write-Host "Frappe LMS requires WSL2 (needs hardware virtualization / Hyper-V)."
    Write-Host "On physical machines: enable virtualization in BIOS and run 'wsl --set-default-version 2'"
    Write-Host "On VMs: ensure nested virtualization is enabled."
}

# Step 1: Ensure Ubuntu is installed in WSL
Write-Host "Checking WSL Ubuntu..."
$distros = & $WSL -l -q 2>&1 | Out-String
if ($distros -notmatch "Ubuntu") {
    Write-Host "Installing Ubuntu (this may take a few minutes)..."
    & $WSL --install Ubuntu --no-launch
    # Initialize Ubuntu with root user
    $ubuntuExe = (Get-AppxPackage *Ubuntu*).InstallLocation + "\ubuntu.exe"
    if (Test-Path $ubuntuExe) {
        & $ubuntuExe install --root
    }
}

# Step 2: Ensure podman is installed
Write-Host "Checking podman..."
$podmanCheck = & $WSL -u root -- which podman 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing podman and podman-compose..."
    & $WSL -u root -- bash -c "apt-get update && apt-get install -y podman podman-compose > /dev/null 2>&1 && sed -i '/^unqualified-search-registries/d' /etc/containers/registries.conf && echo 'unqualified-search-registries = [\"docker.io\"]' >> /etc/containers/registries.conf"
}

# Step 3: Copy docker config into WSL
Write-Host "Setting up LMS in WSL..."
& $WSL -u root -- bash -c "mkdir -p $LMS_DIR"
$dockerDir = Join-Path $scriptDir "..\docker"
if (Test-Path $dockerDir) {
    $wslPath = & $WSL -u root -- wslpath -a ($dockerDir -replace '\\','/')
    & $WSL -u root -- bash -c "cp -r $($wslPath.Trim())/* $LMS_DIR/"
} else {
    # Fallback: use bundled docker dir
    $bundledDocker = Join-Path $scriptDir "docker"
    if (Test-Path $bundledDocker) {
        $wslPath = & $WSL -u root -- wslpath -a ($bundledDocker -replace '\\','/')
        & $WSL -u root -- bash -c "cp -r $($wslPath.Trim())/* $LMS_DIR/"
    }
}

# Step 4: Start services
Write-Host "Starting LMS services (first run pulls images, may take several minutes)..."
& $WSL -u root -- bash -c "cd $LMS_DIR && podman-compose up -d"

# Step 5: Port forwarding
Write-Host "Configuring LAN access..."
& $PSScriptRoot\update-portproxy.ps1 -Port $conf.LMS_PORT

# Step 6: Firewall rule
netsh advfirewall firewall add rule name="Breeze-LMS" dir=in action=allow protocol=TCP localport=$($conf.LMS_PORT)

# Step 7: Register as startup task
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -File $PSScriptRoot\start.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName 'BreezeLMS' -Action $action -Trigger $trigger -User 'SYSTEM' -RunLevel Highest -Force

Write-Host ""
Write-Host "=== Frappe LMS installed! ===" -ForegroundColor Green
Write-Host "Access at: http://$($env:COMPUTERNAME):$($conf.LMS_PORT)"
Write-Host "Or: http://localhost:$($conf.LMS_PORT)"

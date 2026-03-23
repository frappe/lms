# install.ps1 - Install Frappe LMS on Windows via WSL2 + Podman
$ErrorActionPreference = "Stop"
$WSL = "wsl.exe"
$LMS_DIR = "/opt/frappe-lms"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NSSM = Join-Path $scriptDir "nssm.exe"

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

# Step 1: WSL memory config
Write-Host "Configuring WSL memory..."
@("[wsl2]","memory=12GB","swap=4GB") | Set-Content "$env:USERPROFILE\.wslconfig"

# Step 2: Ensure Ubuntu is installed in WSL
Write-Host "Checking WSL Ubuntu..."
$distros = & $WSL -l -q 2>&1 | Out-String
if ($distros -notmatch "Ubuntu") {
    Write-Host "Installing Ubuntu (this may take a few minutes)..."
    & $WSL --install Ubuntu --no-launch
    $ubuntuExe = (Get-AppxPackage *Ubuntu*).InstallLocation + "\ubuntu.exe"
    if (Test-Path $ubuntuExe) { & $ubuntuExe install --root }
}

# Step 3: Ensure podman is installed
Write-Host "Checking podman..."
$podmanCheck = & $WSL -u root -- which podman 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing podman and podman-compose..."
    & $WSL -u root -- bash -c "apt-get update && apt-get install -y podman podman-compose > /dev/null 2>&1 && sed -i '/^unqualified-search-registries/d' /etc/containers/registries.conf && echo 'unqualified-search-registries = [\"docker.io\"]' >> /etc/containers/registries.conf"
}

# Step 4: Copy docker config into WSL
Write-Host "Setting up LMS in WSL..."
& $WSL -u root -- bash -c "mkdir -p $LMS_DIR"
$dockerDir = Join-Path $scriptDir "..\docker"
if (!(Test-Path $dockerDir)) { $dockerDir = Join-Path $scriptDir "docker" }
if (Test-Path $dockerDir) {
    $wslPath = (& $WSL -u root -- wslpath -a ($dockerDir -replace '\\','/')).Trim()
    & $WSL -u root -- bash -c "cp -r $wslPath/* $LMS_DIR/"
}

# Step 5: Install NSSM service (starts containers → waits for ready → port proxy → keepalive)
# WSL can't run as SYSTEM — service must run as the current Windows user
Write-Host "Installing NSSM service..."
if (!(Test-Path $NSSM)) { choco install nssm -y | Out-Null; $NSSM = "nssm" }
& $NSSM install BreezeLMS powershell "-ExecutionPolicy Bypass -File `"$scriptDir\breeze-service.ps1`""
& $NSSM set BreezeLMS AppDirectory $scriptDir
& $NSSM set BreezeLMS AppStdout "$scriptDir\service.log"
& $NSSM set BreezeLMS AppStderr "$scriptDir\service.log"
& $NSSM set BreezeLMS Description "Frappe LMS: containers + port proxy + WSL keepalive"
& $NSSM set BreezeLMS Start SERVICE_AUTO_START
if ($conf.WIN_PASSWORD) {
    & $NSSM set BreezeLMS ObjectName ".\$env:USERNAME" $conf.WIN_PASSWORD
} else {
    Write-Host "NOTE: Enter your Windows password to allow the service to run as your user." -ForegroundColor Yellow
    & $NSSM set BreezeLMS ObjectName ".\$env:USERNAME"
}
& $NSSM start BreezeLMS

# Step 6: Disable sleep mode
Write-Host "Disabling sleep mode..."
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0

# Step 7: Firewall rule (port proxy is handled by breeze-service.ps1 on every boot)
netsh advfirewall firewall add rule name="Breeze-LMS" dir=in action=allow protocol=TCP localport=$($conf.LMS_PORT)

Write-Host ""
Write-Host "=== Frappe LMS installed! ===" -ForegroundColor Green
Write-Host "Access at: http://lms.localhost:$($conf.LMS_PORT)/lms"
Write-Host "Or from LAN: http://$($env:COMPUTERNAME):$($conf.LMS_PORT)/lms"
Write-Host ""
Write-Host "Service: BreezeLMS (auto-starts on boot, keeps WSL alive)"
Write-Host "Sleep mode: disabled"
Write-Host ""
Write-Host "To uninstall: powershell -File `"$scriptDir\uninstall.ps1`"" -ForegroundColor DarkGray

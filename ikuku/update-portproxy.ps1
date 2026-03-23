# update-portproxy.ps1 - Refresh port forwarding (WSL IP changes on reboot)
param([string]$Port = "8000")

$WSL = "wsl.exe"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Read port from config if not passed
if ($Port -eq "8000" -and (Test-Path "$scriptDir\lms.conf")) {
    $line = Get-Content "$scriptDir\lms.conf" | Where-Object { $_ -match "^LMS_PORT=" }
    if ($line) { $Port = ($line -split '=', 2)[1].Trim() }
}

$wslIp = ((& $WSL -u root -- hostname -I).Trim() -split '\s+')[0]
netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null
netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=8000 connectaddress=$wslIp
Write-Host "Port proxy: 0.0.0.0:$Port -> WSL($wslIp):8000"

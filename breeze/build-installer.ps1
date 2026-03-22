# build-installer.ps1 - Build frappe-lms-breeze installer
# Usage: .\build-installer.ps1 -Variant lite|full
param(
    [ValidateSet("lite","full")]
    [string]$Variant = "lite"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundleDir = "$scriptDir\bundle"

# Check NSIS
$makensis = "C:\Program Files (x86)\NSIS\makensis.exe"
if (!(Test-Path $makensis)) {
    Write-Host "Installing NSIS..."
    choco install nsis -y
}

if ($Variant -eq "full") {
    Write-Host "=== Building FULL (offline) installer ===" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null

    # Download WSL MSI
    Write-Host "Downloading WSL 2.6.3 MSI..."
    curl.exe -L -o "$bundleDir\wsl.msi" https://github.com/microsoft/WSL/releases/download/2.6.3/wsl.2.6.3.0.x64.msi

    # Download Ubuntu appx
    Write-Host "Downloading Ubuntu 24.04 appx..."
    curl.exe -L -o "$bundleDir\ubuntu.appx" https://aka.ms/wslubuntu2204

    # Download VCLibs
    Write-Host "Downloading VCLibs..."
    curl.exe -L -o "$bundleDir\vclibs.appx" https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx

    # Export container images
    Write-Host "Pulling and exporting container images..."
    & "C:\Program Files\WSL\wsl.exe" -u root -- bash -c "
        podman pull docker.io/library/mariadb:10.8
        podman pull docker.io/library/redis:alpine
        podman pull docker.io/frappe/bench:latest
        podman save -m -o /tmp/breeze-images.tar docker.io/library/mariadb:10.8 docker.io/library/redis:alpine docker.io/frappe/bench:latest
    "
    Copy-Item "\\wsl$\Ubuntu\tmp\breeze-images.tar" "$bundleDir\breeze-images.tar"
    Write-Host "Container images exported."
}

Push-Location $scriptDir
& $makensis /DVARIANT=$Variant breeze-installer.nsi
Pop-Location

$outFile = "frappe-lms-breeze-$Variant.exe"
if (Test-Path "$scriptDir\$outFile") {
    $size = [math]::Round((Get-Item "$scriptDir\$outFile").Length / 1MB, 1)
    Write-Host "Built: $outFile ($size MB)" -ForegroundColor Green
}

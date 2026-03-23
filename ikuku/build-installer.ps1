# build-installer.ps1 - Build Frappe LMS Windows installer
param(
    [ValidateSet("lite","full")]
    [string]$Variant = "lite"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if ($Variant -eq "full") {
    Write-Host "Building full (offline) installer..."
    $bundleDir = Join-Path $scriptDir "bundle"
    New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null

    # Download WSL MSI
    if (!(Test-Path "$bundleDir\wsl.msi")) {
        curl.exe -L -o "$bundleDir\wsl.msi" "https://github.com/microsoft/WSL/releases/download/2.6.3/wsl.2.6.3.0.x64.msi"
    }

    # Download Ubuntu appx
    if (!(Test-Path "$bundleDir\ubuntu.appx")) {
        curl.exe -L -o "$bundleDir\ubuntu.appx" "https://aka.ms/wslubuntu"
    }

    # Download VCLibs
    if (!(Test-Path "$bundleDir\vclibs.appx")) {
        curl.exe -L -o "$bundleDir\vclibs.appx" "https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx"
    }

    # Save container images
    if (!(Test-Path "$bundleDir\lms-images.tar")) {
        Write-Host "Saving container images (this takes a while)..."
        wsl -u root -- bash -c @"
        podman save -m -o /tmp/lms-images.tar docker.io/library/mariadb:10.8 docker.io/library/redis:alpine docker.io/frappe/bench:latest
"@
        Copy-Item "\\wsl$\Ubuntu\tmp\lms-images.tar" "$bundleDir\lms-images.tar"
    }
}

$makensis = "makensis"
if (Test-Path "C:\Program Files (x86)\NSIS\makensis.exe") { $makensis = "C:\Program Files (x86)\NSIS\makensis.exe" }

& $makensis /DVARIANT=$Variant lms-installer.nsi

$outFile = "frappe-lms-$Variant.exe"
if (Test-Path $outFile) {
    Write-Host "Built: $outFile ($('{0:N1} MB' -f ((Get-Item $outFile).Length / 1MB)))" -ForegroundColor Green
}

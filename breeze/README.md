# frappe-lms-breeze 🌬️

Windows installer for [Frappe LMS](https://github.com/frappe/lms) — runs on any Windows machine, accessible to the entire LAN.

> *Open Windows and let the breeze in!*

Part of the **breeze** family: `frappe-lms-breeze` · `frappe-erpnext-breeze` · `frappe-crm-breeze` · ...

## Download

Go to [Releases](../../releases/latest) and pick your installer:

| Installer | Size | Use when |
|-----------|------|----------|
| `frappe-lms-breeze-lite.exe` | ~5 MB | PC has internet — downloads WSL, Ubuntu, containers during install |
| `frappe-lms-breeze-full.exe` | ~1.5 GB | Offline LAN — bundles WSL MSI, Ubuntu appx, container images, everything |

## Install

1. Download the `.exe` to the target Windows machine (or copy to USB drive for offline)
2. Run as Administrator
3. Follow the wizard — takes 5-15 minutes depending on internet speed
4. Done! Open `http://localhost:8000` or `http://<machine-name>:8000` from any LAN machine

## What gets installed

- WSL2 with Ubuntu 24.04 (if not already present)
- Podman container runtime (inside WSL2)
- Frappe LMS (MariaDB + Redis + Frappe, as containers)
- Windows service for auto-start on boot
- Port forwarding + firewall rule for LAN access
- Start Menu shortcuts

## Architecture

```
┌─────────────────────────────────────────┐
│  Windows Machine (LAN IP: 192.168.1.x) │
│                                         │
│  BreezeLMS service (Windows Service)    │
│    ├─ netsh portproxy :8000 → WSL:8000  │
│    └─ WSL2 Ubuntu                       │
│         └─ podman-compose               │
│              ├─ frappe (port 8000)       │
│              ├─ mariadb                  │
│              └─ redis                    │
└─────────────────────────────────────────┘
         ↑
  Other LAN machines browse to
  http://<machine-name>:8000
```

## Lite vs Full installer

### Lite (`frappe-lms-breeze-lite.exe`)
- Small download, requires internet during install
- Downloads WSL2, Ubuntu, and container images on the fly
- Best for: office PCs with internet access

### Full (`frappe-lms-breeze-full.exe`)
- Large download, works completely offline
- Bundles: WSL 2.6.3 MSI, Ubuntu 24.04 appx, VCLibs appx, pre-pulled container images (MariaDB, Redis, Frappe)
- Best for: air-gapped LANs, USB drive deployment, slow internet

## Uninstall

Control Panel → Add/Remove Programs → "Frappe LMS (Breeze)" → Uninstall

Or run: `"C:\Program Files\BreezeLMS\uninstall.exe"`

## For developers

### Build the installers

On a Windows machine with NSIS and Chocolatey:

```powershell
# Build lite installer
powershell -File breeze\build-installer.ps1 -Variant lite

# Build full installer (downloads all dependencies first)
powershell -File breeze\build-installer.ps1 -Variant full
```

### Base platform

For the dev environment (AWS metal spot instances with QEMU/KVM), see [ec2-win22-qemu-spot-metal](https://github.com/labsji/ec2-win22-qemu-spot-metal).

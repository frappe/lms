# PR: Add ikuku — Windows installer for Frappe LMS

## Title
Add ikuku: Windows installer for Frappe LMS (WSL2 + podman, zero Docker Desktop)

## Description

### What

A Windows installer (`ikuku/`) that lets users run Frappe LMS on Windows without Docker Desktop, Linux VMs, or manual setup. Double-click an .exe, get a running LMS.

### Why

Evaluating Frappe LMS today requires a Linux server or Docker Desktop — both are friction points for Windows-based organizations. Docker Desktop has licensing concerns, WSL containers die on logout, and IT departments rarely provision Linux boxes for "just an evaluation."

ikuku (Igbo for *breeze*) removes this friction: install → open browser → evaluate.

### How it works

- Uses WSL2 + podman (no Docker Desktop license needed)
- MariaDB, Redis, Frappe LMS run as podman containers inside WSL2 Ubuntu
- A Windows scheduled task (S4U logon, no stored passwords) keeps WSL alive across reboots
- Port proxy forwards LAN traffic to WSL containers
- NSIS installer wraps everything into a ~93KB .exe (lite variant)

### Changes

- `ikuku/` — installer scripts, NSIS config, documentation, webcomic
- `docker/init.sh` — add `--resolve-deps` to `bench get-app lms` (fixes missing `payments` dependency)
- `.github/workflows/windows-installer.yml` — builds lite .exe on GitHub Actions

### Tested on

- Windows Server 2022 (build 20348) on AWS c5n.metal via QEMU/KVM
- WSL2 Ubuntu 24.04, kernel 6.6.87, podman 4.9.3
- Frappe LMS v2.48.0 (develop branch)
- Verified: install → reboot → HTTP 200 at /lms ✅
- Verified: non-admin user can access LMS after admin installs ✅
- Verified: GitHub Actions builds .exe artifact ✅

### Not included (future work)

- Full offline installer variant (needs pre-built container image)
- Sample LMS course content for evaluators

; lms-installer.nsi - NSIS installer for Frappe LMS on Windows
; Build: makensis /DVARIANT=lite|full lms-installer.nsi

!include "MUI2.nsh"

!ifndef VARIANT
    !define VARIANT "lite"
!endif

Name "Frappe LMS"
OutFile "frappe-lms-${VARIANT}.exe"
InstallDir "$PROGRAMFILES\FrappeLMS"
RequestExecutionLevel admin

!insertmacro MUI_PAGE_WELCOME

; Custom configuration page
Page custom ConfigPage ConfigPageLeave

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

; Variables for user input
Var SiteName
Var AdminEmail
Var AdminPassword
Var LmsPort

Function ConfigPage
    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateLabel} 0 0 100% 12u "Configure your Frappe LMS installation:"

    ${NSD_CreateLabel} 0 20u 80u 12u "Site Name:"
    ${NSD_CreateText} 90u 18u 200u 12u "lms.local"
    Pop $SiteName

    ${NSD_CreateLabel} 0 40u 80u 12u "Admin Email:"
    ${NSD_CreateText} 90u 38u 200u 12u "admin@example.com"
    Pop $AdminEmail

    ${NSD_CreateLabel} 0 60u 80u 12u "Admin Password:"
    ${NSD_CreatePassword} 90u 58u 200u 12u ""
    Pop $AdminPassword

    ${NSD_CreateLabel} 0 80u 80u 12u "LAN Port:"
    ${NSD_CreateText} 90u 78u 60u 12u "8000"
    Pop $LmsPort

    ${NSD_CreateLabel} 0 100u 100% 12u "Other LAN machines will access: http://<machine-name>:<port>/lms"

    nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
    ${NSD_GetText} $SiteName $SiteName
    ${NSD_GetText} $AdminEmail $AdminEmail
    ${NSD_GetText} $AdminPassword $AdminPassword
    ${NSD_GetText} $LmsPort $LmsPort
FunctionEnd

Section "Install"
    SetOutPath $INSTDIR

    ; Copy scripts
    File "install.ps1"
    File "lms-service.ps1"
    File "start.ps1"
    File "stop.ps1"
    File "uninstall.ps1"
    File "update-portproxy.ps1"

    ; Copy docker-compose config
    SetOutPath "$INSTDIR\docker"
    File "..\docker\docker-compose.yml"
    File "..\docker\init.sh"
    SetOutPath $INSTDIR

    ; Bundle files for full variant
    !if "${VARIANT}" == "full"
        SetOutPath "$INSTDIR\bundle"
        File "bundle\wsl.msi"
        File "bundle\ubuntu.appx"
        File "bundle\vclibs.appx"
        File "bundle\lms-images.tar"
        SetOutPath $INSTDIR
    !endif

    ; --- Step 1: WSL2 ---
    DetailPrint "Checking WSL2..."
    !if "${VARIANT}" == "full"
        nsExec::ExecToLog 'powershell -Command "if (!(Test-Path \"C:\Program Files\WSL\wsl.exe\")) { msiexec /i \"$INSTDIR\bundle\wsl.msi\" /quiet /norestart; Start-Sleep 10 }"'
    !else
        nsExec::ExecToLog 'powershell -Command "if (!(Test-Path $\'C:\Program Files\WSL\wsl.exe$\')) { curl.exe -L -o %TEMP%\wsl.msi https://github.com/microsoft/WSL/releases/download/2.6.3/wsl.2.6.3.0.x64.msi; msiexec /i %TEMP%\wsl.msi /quiet /norestart; Start-Sleep 10 }"'
    !endif

    ; --- Step 2: Ubuntu ---
    DetailPrint "Checking Ubuntu..."
    !if "${VARIANT}" == "full"
        nsExec::ExecToLog 'powershell -Command "Add-AppxPackage \"$INSTDIR\bundle\vclibs.appx\" -ErrorAction SilentlyContinue; Add-AppxPackage \"$INSTDIR\bundle\ubuntu.appx\" -ErrorAction SilentlyContinue"'
        nsExec::ExecToLog 'powershell -Command "& \"C:\Program Files\WSL\wsl.exe\" --set-default-version 2; $ubuntu = (Get-AppxPackage *Ubuntu*).InstallLocation + \"\ubuntu.exe\"; & $ubuntu install --root"'
    !else
        nsExec::ExecToLog 'powershell -Command "& \"C:\Program Files\WSL\wsl.exe\" --set-default-version 2; & \"C:\Program Files\WSL\wsl.exe\" --install Ubuntu --no-launch"'
    !endif

    ; --- Step 3: Podman ---
    DetailPrint "Installing podman..."
    nsExec::ExecToLog '\"C:\Program Files\WSL\wsl.exe\" -u root -- bash -c "apt-get update && apt-get install -y podman podman-compose > /dev/null 2>&1 && echo unqualified-search-registries = [\\\"docker.io\\\"] >> /etc/containers/registries.conf"'

    ; --- Step 4: Load images (full) or pull (lite) ---
    !if "${VARIANT}" == "full"
        DetailPrint "Loading container images (offline)..."
        nsExec::ExecToLog '\"C:\Program Files\WSL\wsl.exe\" -u root -- bash -c "podman load -i /mnt/c/Program\ Files/FrappeLMS/bundle/lms-images.tar"'
    !endif

    ; --- Step 5: Deploy and start ---
    DetailPrint "Starting Frappe LMS..."
    ; Write config from wizard inputs
    FileOpen $0 "$INSTDIR\lms.conf" w
    FileWrite $0 "SITE_NAME=$SiteName$\r$\n"
    FileWrite $0 "ADMIN_EMAIL=$AdminEmail$\r$\n"
    FileWrite $0 "ADMIN_PASSWORD=$AdminPassword$\r$\n"
    FileWrite $0 "LMS_PORT=$LmsPort$\r$\n"
    FileClose $0
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\install.ps1"'

    ; Start Menu
    CreateDirectory "$SMPROGRAMS\Frappe LMS"
    CreateShortcut "$SMPROGRAMS\Frappe LMS\Open LMS.lnk" "http://lms.localhost:8000/lms"
    CreateShortcut "$SMPROGRAMS\Frappe LMS\Start LMS.lnk" "powershell.exe" '-ExecutionPolicy Bypass -File "$INSTDIR\start.ps1"'
    CreateShortcut "$SMPROGRAMS\Frappe LMS\Stop LMS.lnk" "powershell.exe" '-ExecutionPolicy Bypass -File "$INSTDIR\stop.ps1"'

    ; Uninstaller + Add/Remove Programs
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FrappeLMS" "DisplayName" "Frappe LMS"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FrappeLMS" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FrappeLMS" "Publisher" "Frappe"

    !if "${VARIANT}" == "full"
        RMDir /r "$INSTDIR\bundle"
    !endif
SectionEnd

Section "Uninstall"
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\uninstall.ps1"'
    RMDir /r "$SMPROGRAMS\Frappe LMS"
    RMDir /r "$INSTDIR"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FrappeLMS"
SectionEnd

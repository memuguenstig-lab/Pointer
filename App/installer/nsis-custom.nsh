; ── Pointer NSIS Custom Script ──────────────────────────────────────────────
; Runs AFTER electron-builder default NSIS install.
; Checks for Node.js, installs it if missing, then runs npm install.

!include "LogicLib.nsh"

!macro customInstall
  ; ── Check if Node.js is already installed ──────────────────────────────
  DetailPrint "Checking for Node.js installation..."
  nsExec::ExecToStack 'node --version'
  Pop $0  ; exit code
  Pop $1  ; output

  ${If} $0 != 0
    ; Node.js not found — try to use local copy first
    DetailPrint "Node.js not found. Checking for local installer..."
    
    ; Check if we have a local Node.js installer
    IfFileExists "$EXEDIR\node-win-x64.zip" 0 download_node
      DetailPrint "Found local Node.js installer. Extracting..."
      nsExec::ExecToLog 'powershell -Command "Expand-Archive -Path $\"$EXEDIR\node-win-x64.zip$\" -DestinationPath $\"$TEMP\node$\" -Force"'
      Pop $2
      ${If} $2 == 0
        DetailPrint "Adding Node.js to PATH..."
        ReadRegStr $R0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
        StrCpy $R0 "$R0;$TEMP\node\bin"
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" $R0
        System::Call 'Kernel32::SetEnvironmentVariable(t "PATH", t "$R0") i.r0'
        DetailPrint "Node.js installed from local copy."
        Goto node_installed
      ${EndIf}
    
    download_node:
    ; Download Node.js if local copy not available or failed
    DetailPrint "Downloading Node.js LTS..."
    
    ; Try multiple download attempts
    StrCpy $R1 0 ; attempt counter
    ${For} $R1 1 3
      DetailPrint "Download attempt $R1/3..."
      inetc::get \
        /CAPTION "Downloading Node.js..." \
        /BANNER "Please wait while Node.js is being downloaded..." \
        "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" \
        "$TEMP\node_installer.msi" /END
      Pop $2
      ${If} $2 == "OK"
        ${Break}
      ${EndIf}
      DetailPrint "Download attempt $R1 failed, retrying..."
      Sleep 2000
    ${Next}
    
    ${If} $2 != "OK"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to download Node.js after 3 attempts.$\n$\nPlease check your internet connection and try again, or install Node.js manually from https://nodejs.org$\n$\nError: $2" /SD IDOK
      DetailPrint "Node.js download failed: $2"
      Goto install_deps
    ${EndIf}
    
    DetailPrint "Installing Node.js silently..."
    ExecWait 'msiexec /i "$TEMP\node_installer.msi" /quiet /norestart ADDLOCAL=ALL' $2
    ${If} $2 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Node.js installation failed (error code: $2).$\n$\nPlease install Node.js manually from https://nodejs.org and restart the Pointer installer." /SD IDOK
      DetailPrint "Node.js installation failed with code: $2"
    ${Else}
      DetailPrint "Node.js installed successfully."
      Delete "$TEMP\node_installer.msi"
    ${EndIf}
  ${Else}
    DetailPrint "Node.js already installed: $1"
  ${EndIf}
  
  node_installed:
  
  ; ── Refresh PATH so newly installed node is found ──────────────────────
  ReadRegStr $R0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
  System::Call 'Kernel32::SetEnvironmentVariable(t "PATH", t "$R0") i.r0'
  
  ; Wait a moment for PATH changes to take effect
  Sleep 1000

  install_deps:
  ; ── Install backend dependencies ───────────────────────────────────────
  DetailPrint "Installing backend dependencies (this may take a few minutes)..."
  nsExec::ExecToLog 'cmd /C "cd /D "$INSTDIR\resources\backend-node" && npm install --production --prefer-offline --no-audit --no-fund 2>&1"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Warning: npm install (backend) returned code $0"
    ; Try with longer timeout
    DetailPrint "Retrying with longer timeout..."
    nsExec::ExecToLog 'cmd /C "cd /D "$INSTDIR\resources\backend-node" && npm install --production --prefer-offline --no-audit --no-fund --verbose 2>&1"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONINFORMATION "Backend dependencies installation had issues (code: $0).$\nPointer will try to start anyway." /SD IDOK
    ${EndIf}
  ${Else}
    DetailPrint "Backend dependencies installed successfully."
  ${EndIf}

  ; ── Install app dependencies ────────────────────────────────────────────
  DetailPrint "Installing app dependencies..."
  nsExec::ExecToLog 'cmd /C "cd /D "$INSTDIR\resources\app" && npm install --production --prefer-offline --no-audit --no-fund 2>&1"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Warning: npm install (app) returned code $0"
    ; Try with longer timeout
    DetailPrint "Retrying with longer timeout..."
    nsExec::ExecToLog 'cmd /C "cd /D "$INSTDIR\resources\app" && npm install --production --prefer-offline --no-audit --no-fund --verbose 2>&1"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONINFORMATION "App dependencies installation had issues (code: $0).$\nPointer will try to start anyway." /SD IDOK
    ${EndIf}
  ${Else}
    DetailPrint "App dependencies installed successfully."
  ${EndIf}
  
  DetailPrint "Pointer installation completed successfully!"

!macroend

!macro customUnInstall
  ; Clean up temporary files
  Delete "$TEMP\node_installer.msi"
  RMDir /r "$TEMP\node"
!macroend

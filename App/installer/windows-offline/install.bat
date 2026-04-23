@echo off
setlocal enabledelayedexpansion
echo ============================
echo  Pointer Offline Installation
echo ============================
echo.

:: Install Node.js
echo [1/4] Installing Node.js...
if exist "%~dp0node-installer.msi" (
    msiexec /i "%~dp0node-installer.msi" /quiet /norestart ADDLOCAL=ALL
    echo Node.js installed.
) else (
    echo WARNING: node-installer.msi not found. Skipping Node.js install.
    echo Please install Node.js manually from https://nodejs.org
)

:: Refresh PATH
echo.
echo [2/4] Refreshing PATH...
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
set "PATH=%SYS_PATH%;%PATH%"

:: Check node is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found in PATH after installation.
    echo Please restart your computer and run this script again.
    pause
    exit /b 1
)

:: Install app dependencies
echo.
echo [3/4] Installing app dependencies...
if exist "%~dp0..\app\package.json" (
    pushd "%~dp0..\app"
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo WARNING: Some app dependencies failed. Retrying...
        call npm install tcp-port-used chalk --no-audit --no-fund
    )
    popd
    echo App dependencies installed.
) else (
    echo WARNING: App package.json not found, skipping.
)

:: Install backend-node dependencies
echo.
echo [4/4] Installing backend dependencies...
if exist "%~dp0..\backend-node\package.json" (
    pushd "%~dp0..\backend-node"
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo WARNING: Some backend dependencies failed. Retrying...
        call npm install express cors ws simple-git sql.js --no-audit --no-fund
    )
    popd
    echo Backend dependencies installed.
) else (
    echo WARNING: Backend package.json not found, skipping.
)

echo.
echo ============================
echo  Installation complete!
echo  You can now launch Pointer.
echo ============================
pause

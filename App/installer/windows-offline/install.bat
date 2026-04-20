@echo off
echo Pointer Offline Installation
echo ============================
echo.
echo This will install Node.js and Pointer for offline use.
echo.
echo Installing Node.js...
msiexec /i "%~dp0node-installer.msi" /quiet /norestart ADDLOCAL=ALL
echo Node.js installation complete.
echo.
echo Please run Pointer Setup.exe to complete the installation.
pause
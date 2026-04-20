#!/usr/bin/env node
/**
 * Pointer Offline Installer Preparation Script
 * Downloads Node.js installers for offline installation
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSIONS = {
  windows: '20.11.1',
  mac_x64: '20.11.1',
  mac_arm64: '20.11.1'
};

const DOWNLOADS = {
  windows: `https://nodejs.org/dist/v${NODE_VERSIONS.windows}/node-v${NODE_VERSIONS.windows}-x64.msi`,
  mac_x64: `https://nodejs.org/dist/v${NODE_VERSIONS.mac_x64}/node-v${NODE_VERSIONS.mac_x64}.pkg`,
  mac_arm64: `https://nodejs.org/dist/v${NODE_VERSIONS.mac_arm64}/node-v${NODE_VERSIONS.mac_arm64}-arm64.pkg`
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    console.log(`Downloading ${url}...`);
    
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      
      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;
      
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total) {
          const percent = Math.round((received / total) * 100);
          process.stdout.write(`\rProgress: ${percent}% (${Math.round(received / 1024 / 1024)}MB/${Math.round(total / 1024 / 1024)}MB)`);
        }
      });
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`\nDownload complete: ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function prepareWindowsOffline() {
  console.log('Preparing Windows offline installer...');
  
  const destDir = path.join(__dirname, 'windows-offline');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Download Node.js MSI
  const msiDest = path.join(destDir, 'node-installer.msi');
  await downloadFile(DOWNLOADS.windows, msiDest);
  
  // Create a batch file for offline installation
  const batchContent = `@echo off
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
pause`;
  
  fs.writeFileSync(path.join(destDir, 'install.bat'), batchContent);
  
  console.log(`Windows offline files ready in: ${destDir}`);
}

async function prepareMacOffline() {
  console.log('Preparing macOS offline installer...');
  
  const destDir = path.join(__dirname, 'macos-offline');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Download both architectures
  const pkgX64Dest = path.join(destDir, 'node-x64.pkg');
  const pkgArm64Dest = path.join(destDir, 'node-arm64.pkg');
  
  console.log('Downloading x64 version...');
  await downloadFile(DOWNLOADS.mac_x64, pkgX64Dest);
  
  console.log('Downloading ARM64 version...');
  await downloadFile(DOWNLOADS.mac_arm64, pkgArm64Dest);
  
  // Create installation script
  const scriptContent = `#!/bin/bash
echo "Pointer Offline Installation"
echo "============================="
echo ""
echo "This will install Node.js for Pointer."
echo ""
echo "Detecting architecture..."
ARCH=$(uname -m)
echo "Architecture: $ARCH"
echo ""
if [ "$ARCH" = "arm64" ]; then
  echo "Installing Node.js for Apple Silicon..."
  sudo installer -pkg "$(dirname "$0")/node-arm64.pkg" -target /
else
  echo "Installing Node.js for Intel..."
  sudo installer -pkg "$(dirname "$0")/node-x64.pkg" -target /
fi
echo ""
echo "Node.js installation complete."
echo "You can now launch Pointer from your Applications folder."`;
  
  fs.writeFileSync(path.join(destDir, 'install.sh'), scriptContent);
  fs.chmodSync(path.join(destDir, 'install.sh'), '755');
  
  console.log(`macOS offline files ready in: ${destDir}`);
}

async function main() {
  console.log('Pointer Offline Installer Preparation');
  console.log('=====================================\n');
  
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      await prepareWindowsOffline();
    } else if (platform === 'darwin') {
      await prepareMacOffline();
    } else {
      console.log('Unsupported platform for offline preparation.');
      console.log('Supported platforms: Windows (win32), macOS (darwin)');
    }
    
    console.log('\nDone! Offline installers are ready.');
    console.log('\nTo use offline installation:');
    console.log('1. Copy the offline folder to the target machine');
    console.log('2. Run the install script (install.bat on Windows, install.sh on macOS)');
    console.log('3. Then install Pointer normally');
    
  } catch (error) {
    console.error('Error preparing offline installer:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { prepareWindowsOffline, prepareMacOffline };
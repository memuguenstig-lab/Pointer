'use strict';
/**
 * Pointer Setup Manager
 * Runs on first launch (or when deps are missing) to:
 *  1. Check Node.js is installed
 *  2. Run npm install for backend-node and app dependencies
 * Works in the packaged Electron app (production).
 */

const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

// Get latest LTS version from Node.js releases API
const NODE_LTS_WIN = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi';
const NODE_LTS_MAC_ARM64 = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-arm64.pkg';
const NODE_LTS_MAC_X64 = 'https://nodejs.org/dist/v20.11.1/node-v20.11.1.pkg';
const NODE_VERSION_REQUIRED = 18;

async function getNodeVersion() {
  try {
    const { stdout } = await execAsync('node --version');
    const match = stdout.trim().match(/v(\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch(e) { 
    console.log('Node.js not found:', e.message);
    return 0; 
  }
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { 
      headers: { 
        'User-Agent': 'Pointer-Installer/1.0',
        'Accept': '*/*'
      },
      timeout: 30000
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      
      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;
      let lastReported = 0;
      
      res.on('data', chunk => {
        received += chunk.length;
        if (total && onProgress) {
          const pct = Math.round(received / total * 100);
          // Only report every 5% to avoid too many updates
          if (pct >= lastReported + 5 || pct === 100) {
            onProgress(pct);
            lastReported = pct;
          }
        }
      });
      
      res.pipe(file);
      file.on('finish', () => { 
        file.close(); 
        resolve(); 
      });
    }).on('error', err => { 
      file.close();
      fs.unlink(dest, () => {}); 
      reject(err); 
    }).on('timeout', () => {
      file.close();
      fs.unlink(dest, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

async function installNodeWindows(onStatus) {
  const dest = path.join(os.tmpdir(), 'node-installer.msi');
  
  // Try multiple download attempts
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      onStatus(`Downloading Node.js LTS (attempt ${attempt}/3)...`, 5);
      await downloadFile(NODE_LTS_WIN, dest, pct => {
        onStatus(`Downloading Node.js... ${pct}%`, 5 + Math.round(pct * 0.4));
      });
      break; // Success
    } catch (err) {
      lastError = err;
      onStatus(`Download failed: ${err.message}`, 10);
      if (attempt < 3) {
        onStatus(`Retrying in 3 seconds...`, 10);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  if (!fs.existsSync(dest)) {
    throw new Error(`Failed to download Node.js after 3 attempts: ${lastError?.message || 'Unknown error'}`);
  }
  
  onStatus('Installing Node.js (this may take a few minutes)...', 50);
  
  return new Promise((resolve, reject) => {
    execFile('msiexec', ['/i', dest, '/quiet', '/norestart', 'ADDLOCAL=ALL'], (err) => {
      fs.unlink(dest, () => {});
      if (err) {
        reject(new Error(`Node.js installation failed: ${err.message}`));
      } else {
        onStatus('Node.js installed successfully!', 60);
        resolve();
      }
    });
  });
}

async function installNodeMac(onStatus) {
  const arch = os.arch();
  const nodeUrl = arch === 'arm64' ? NODE_LTS_MAC_ARM64 : NODE_LTS_MAC_X64;
  const dest = path.join(os.tmpdir(), 'node-installer.pkg');
  
  // Try multiple download attempts
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      onStatus(`Downloading Node.js LTS for ${arch} (attempt ${attempt}/3)...`, 5);
      await downloadFile(nodeUrl, dest, pct => {
        onStatus(`Downloading Node.js... ${pct}%`, 5 + Math.round(pct * 0.4));
      });
      break; // Success
    } catch (err) {
      lastError = err;
      onStatus(`Download failed: ${err.message}`, 10);
      if (attempt < 3) {
        onStatus(`Retrying in 3 seconds...`, 10);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  if (!fs.existsSync(dest)) {
    throw new Error(`Failed to download Node.js after 3 attempts: ${lastError?.message || 'Unknown error'}`);
  }
  
  onStatus('Installing Node.js (admin rights required)...', 50);
  
  try {
    // Try without sudo first (user installation)
    onStatus('Attempting user installation...', 55);
    await execAsync(`installer -pkg "${dest}" -target CurrentUserHomeDirectory`);
    onStatus('Node.js installed to user directory!', 60);
  } catch (userErr) {
    // Fall back to system installation
    onStatus('User installation failed, trying system installation...', 55);
    await execAsync(`sudo installer -pkg "${dest}" -target /`);
    onStatus('Node.js installed system-wide!', 60);
  } finally {
    fs.unlink(dest, () => {});
  }
}

async function runNpmInstall(dir, label, onStatus, startPct) {
  if (!fs.existsSync(dir)) {
    onStatus(`${label} directory not found`, startPct);
    return;
  }
  
  onStatus(`Installing ${label} dependencies...`, startPct);
  
  // Try multiple attempts
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        onStatus(`Retrying ${label} dependencies (attempt ${attempt}/3)...`, startPct);
      }
      
      await execAsync('npm install --production --prefer-offline --no-audit --no-fund', { 
        cwd: dir, 
        timeout: 180000, // 3 minutes
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      onStatus(`${label} dependencies installed successfully!`, startPct + 15);
      return; // Success
      
    } catch(e) {
      console.warn(`npm install attempt ${attempt} for ${label}:`, e.message);
      
      if (attempt < 3) {
        onStatus(`${label}: ${e.message.slice(0, 80)}... retrying`, startPct);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      } else {
        // Last attempt failed
        onStatus(`${label} dependencies: some issues occurred`, startPct + 15);
        console.warn(`Final npm install warning for ${label}:`, e.message);
      }
    }
  }
}

/**
 * Main setup function.
 * @param {object} opts
 * @param {string} opts.appRoot - path to the app resources root
 * @param {function} opts.onStatus - (message, percent) => void
 * @returns {Promise<void>}
 */
async function runSetup({ appRoot, onStatus }) {
  try {
    onStatus('Starting Pointer setup...', 0);
    onStatus('Checking Node.js installation...', 2);

    const nodeVer = await getNodeVersion();

    if (nodeVer < NODE_VERSION_REQUIRED) {
      onStatus(`Node.js ${NODE_VERSION_REQUIRED}+ required (found: ${nodeVer || 'none'})`, 3);
      
      // Check for local Node.js installer first
      const localNodePath = path.join(appRoot, 'node-local');
      if (fs.existsSync(localNodePath)) {
        onStatus('Found local Node.js installer...', 5);
        // TODO: Implement local installation
      }
      
      if (process.platform === 'win32') {
        await installNodeWindows(onStatus);
      } else if (process.platform === 'darwin') {
        await installNodeMac(onStatus);
      } else {
        throw new Error('Node.js is not installed. Please install Node.js 18+ from https://nodejs.org');
      }
      
      // Verify installation
      const newVer = await getNodeVersion();
      if (newVer < NODE_VERSION_REQUIRED) {
        throw new Error(`Node.js installation failed. Found version: ${newVer || 'none'}`);
      }
      onStatus(`Node.js v${newVer} installed successfully!`, 65);
    } else {
      onStatus(`Node.js v${nodeVer} found.`, 10);
    }

    const backendDir = path.join(appRoot, 'backend-node');
    const appDir = appRoot;

    await runNpmInstall(backendDir, 'backend', onStatus, 70);
    await runNpmInstall(appDir, 'app', onStatus, 85);

    onStatus('Setup complete! Pointer is ready to use.', 100);
    
  } catch (error) {
    onStatus(`Setup failed: ${error.message}`, 100);
    throw error;
  }
}

/**
 * Check if setup is needed (node_modules missing).
 */
function isSetupNeeded(appRoot) {
  const backendMods = path.join(appRoot, 'backend-node', 'node_modules');
  const appMods = path.join(appRoot, 'node_modules');
  
  // Also check if package.json files exist
  const backendPackage = path.join(appRoot, 'backend-node', 'package.json');
  const appPackage = path.join(appRoot, 'package.json');
  
  if (!fs.existsSync(backendPackage) || !fs.existsSync(appPackage)) {
    return false; // No package.json, can't install
  }
  
  return !fs.existsSync(backendMods) || !fs.existsSync(appMods);
}

module.exports = { runSetup, isSetupNeeded };

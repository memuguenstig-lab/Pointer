'use strict';
const express = require('express');
const https = require('https');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();

const REGISTRY_URL = 'https://raw.githubusercontent.com/memuguenstig-lab/shadow-extensions/main/extensions.json';

function getAppDataPath() {
  const p = process.platform;
  if (p === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'ShadowIDE', 'data');
  if (p === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'ShadowIDE', 'data');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'shadowide', 'data');
}

function getExtensionsDir() {
  const dir = path.join(getAppDataPath(), 'extensions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Helper: Download a file to path
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      // Handle redirects (GitHub uses redirects for zip downloads)
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Helper: Unzip platform-independently
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`;
    } else {
      cmd = `unzip -o "${zipPath}" -d "${destDir}"`;
    }
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });
}

// Fetch the central extension registry
router.get('/extensions/registry', async (req, res) => {
  https.get(REGISTRY_URL, { headers: { 'User-Agent': 'ShadowIDE-IDE' } }, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        if (response.statusCode === 200) {
          res.json(JSON.parse(data));
        } else {
          res.status(response.statusCode).json({ error: 'Failed to fetch registry from GitHub' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Malformed registry file' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// List all installed extensions
router.get('/extensions/installed', async (req, res) => {
  try {
    const extensionsDir = getExtensionsDir();
    const dirs = await fsp.readdir(extensionsDir, { withFileTypes: true });
    const installed = [];

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const extPath = path.join(extensionsDir, dir.name);
        const metaPath = path.join(extPath, 'extension.json');
        if (fs.existsSync(metaPath)) {
          try {
            const metaContent = await fsp.readFile(metaPath, 'utf8');
            const meta = JSON.parse(metaContent);
            installed.push({
              ...meta,
              localPath: extPath
            });
          } catch (e) {
            // Skip invalid extension folders
          }
        }
      }
    }
    res.json(installed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Install an extension from its repository
router.post('/extensions/install', async (req, res) => {
  const { id, repository } = req.body;
  if (!id || !repository) {
    return res.status(400).json({ error: 'Missing extension id or repository URL' });
  }

  const tempZip = path.join(os.tmpdir(), `shadow-ext-${id}.zip`);
  const extensionsDir = getExtensionsDir();
  const targetDir = path.join(extensionsDir, id);

  try {
    // Standard GitHub repo structure to main branch zip
    // e.g., https://github.com/user/repo -> https://github.com/user/repo/archive/refs/heads/main.zip
    const cleanRepoUrl = repository.replace(/\.git$/, '');
    const zipUrl = `${cleanRepoUrl}/archive/refs/heads/main.zip`;

    console.log(`Downloading extension from ${zipUrl}...`);
    await downloadFile(zipUrl, tempZip);

    // Create temporary extraction directory
    const tempExtractDir = path.join(os.tmpdir(), `shadow-ext-extract-${id}`);
    await fsp.mkdir(tempExtractDir, { recursive: true });

    console.log(`Extracting extension to ${tempExtractDir}...`);
    await extractZip(tempZip, tempExtractDir);

    // Clean up zip file
    await fsp.unlink(tempZip).catch(() => {});

    // GitHub zipball extracts to a nested directory like <repo-name>-main/
    // We need to locate extension.json within that extracted content
    const extractedItems = await fsp.readdir(tempExtractDir, { withFileTypes: true });
    let sourceDir = tempExtractDir;
    if (extractedItems.length === 1 && extractedItems[0].isDirectory()) {
      sourceDir = path.join(tempExtractDir, extractedItems[0].name);
    }

    const extJsonPath = path.join(sourceDir, 'extension.json');
    if (!fs.existsSync(extJsonPath)) {
      throw new Error('Downloaded repository does not contain an extension.json file');
    }

    // Move to final location
    if (fs.existsSync(targetDir)) {
      await fsp.rm(targetDir, { recursive: true, force: true });
    }
    await fsp.mkdir(path.dirname(targetDir), { recursive: true });
    await fsp.rename(sourceDir, targetDir);

    // Clean up temp extraction folder
    await fsp.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});

    // Load and return the installed meta
    const finalMeta = JSON.parse(await fsp.readFile(path.join(targetDir, 'extension.json'), 'utf8'));
    res.json({ success: true, extension: finalMeta });
  } catch (e) {
    console.error(e);
    // Cleanup on failure
    await fsp.unlink(tempZip).catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// Uninstall an extension
router.post('/extensions/uninstall', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing extension id' });
  }

  const targetDir = path.join(getExtensionsDir(), id);
  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Extension not found' });
  }

  try {
    await fsp.rm(targetDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

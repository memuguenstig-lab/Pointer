'use strict';
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const router = express.Router();

function getAppDataPath() {
  const p = process.platform;
  if (p === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Pointer', 'data');
  if (p === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Pointer', 'data');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer', 'data');
}

function getToken() {
  try {
    const f = path.join(getAppDataPath(), 'settings', 'github_token.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).token || null;
  } catch(e) {}
  return null;
}

function saveToken(token) {
  const dir = path.join(getAppDataPath(), 'settings');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'github_token.json'), JSON.stringify({ token }), 'utf8');
}

async function githubFetch(urlPath, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      headers: {
        'User-Agent': 'Pointer-IDE',
        'Accept': 'application/vnd.github.v3+json',
        ...(token ? { 'Authorization': `token ${token}` } : {})
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', reject);
  });
}

router.get('/github/user-repos', async (req, res) => {
  const token = getToken();
  if (!token) return res.json({ demo: true });
  try {
    const r = await githubFetch('/user/repos?sort=updated&per_page=25', token);
    if (r.status === 200) return res.json({ repositories: r.data });
  } catch(e) {}
  res.json({ demo: true });
});

router.get('/github/popular-repos', async (req, res) => {
  try {
    const r = await githubFetch('/search/repositories?q=stars:>10000&sort=stars&order=desc&per_page=25', null);
    if (r.status === 200) return res.json({ repositories: r.data.items });
  } catch(e) {}
  res.json({ demo: true });
});

router.get('/github/client-id', async (req, res) => {
  try {
    const r = await new Promise((resolve, reject) => {
      https.get('https://pointerapi.f1shy312.com/github/client_id', { headers: { 'User-Agent': 'Pointer-IDE' } }, resp => {
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    res.json(r);
  } catch(e) { res.json({ client_id: null }); }
});

router.get('/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code');
  try {
    const tokenData = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ code });
      const opts = {
        hostname: 'pointerapi.f1shy312.com',
        path: '/exchange-token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'Pointer-IDE' }
      };
      const req2 = https.request(opts, resp => {
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve(JSON.parse(d)));
      });
      req2.on('error', reject);
      req2.write(body); req2.end();
    });
    if (tokenData.access_token) {
      saveToken(tokenData.access_token);
      res.send('<html><body><script>window.close();</script><p>Authenticated! You can close this window.</p></body></html>');
    } else {
      res.status(400).send('Failed to get token');
    }
  } catch(e) { res.status(500).send(e.message); }
});

router.post('/github/save-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token' });
  saveToken(token);
  res.json({ success: true });
});

router.get('/github/validate-token', async (req, res) => {
  const token = getToken();
  if (!token) return res.json({ valid: false });
  try {
    const r = await githubFetch('/user', token);
    res.json({ valid: r.status === 200, user: r.status === 200 ? r.data : null });
  } catch(e) { res.json({ valid: false }); }
});

module.exports = router;

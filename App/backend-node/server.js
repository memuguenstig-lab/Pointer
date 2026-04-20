'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 23816;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// ── State ──────────────────────────────────────────────────────────────────
let baseDirectory = null;
let userWorkspaceDirectory = null;
const fileCache = {};

// ── Helpers ────────────────────────────────────────────────────────────────
function getAppDataPath() {
  const p = process.platform;
  if (p === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Pointer', 'data');
  if (p === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Pointer', 'data');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer', 'data');
}

function getChatsDirectory() {
  return path.join(getAppDataPath(), 'chats');
}

function getWorkingDirectory() {
  if (userWorkspaceDirectory && fs.existsSync(userWorkspaceDirectory)) return userWorkspaceDirectory;
  return baseDirectory || process.cwd();
}

function setUserWorkspaceDirectory(p) {
  const abs = path.resolve(p);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    userWorkspaceDirectory = abs;
    process.chdir(abs);
    return true;
  }
  return false;
}

const TEXT_EXTS = new Set([
  'txt','js','jsx','ts','tsx','md','json','html','css','scss','less','xml','svg',
  'yaml','yml','ini','conf','sh','bash','py','java','cpp','c','h','hpp','rs','go',
  'rb','php','sql','vue','gitignore','env','editorconfig','cs','dart','swift','kt',
  'scala','lua','r','pl','toml','dockerfile','makefile','mak','cmake'
]);
const BIN_EXTS = new Set([
  'pdf','doc','docx','xls','xlsx','ppt','pptx','zip','rar','tar','gz','7z','bin',
  'exe','dll','so','dylib','o','obj','class','jar','war','jpg','jpeg','png','gif',
  'bmp','tiff','webp','ico','mp3','mp4','avi','mov','webm','wav','ogg','ttf','otf',
  'eot','woff','woff2','iso','db','sqlite'
]);

function isTextFile(filename) {
  const ext = path.extname(filename).replace('.','').toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  if (BIN_EXTS.has(ext)) return false;
  return true;
}

function generateId(prefix, p) {
  return `${prefix}_${p.replace(/\\/g,'/')}`;
}

function scanDirectory(dirPath) {
  const items = {};
  const rootId = generateId('root', dirPath);
  const relToBase = baseDirectory ? path.relative(baseDirectory, dirPath) : path.basename(dirPath);
  const folderName = path.basename(dirPath) || path.basename(path.dirname(dirPath));

  items[rootId] = { id: rootId, name: folderName, type: 'directory', path: relToBase, parentId: null };

  let entries = [];
  try { entries = fs.readdirSync(dirPath).sort(); } catch(e) {}

  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const full = path.join(dirPath, name);
    const rel = baseDirectory ? path.relative(baseDirectory, full) : name;
    let stat;
    try { stat = fs.statSync(full); } catch(e) { continue; }

    if (stat.isDirectory()) {
      const id = generateId('dir', rel);
      items[id] = { id, name, path: rel, type: 'directory', parentId: rootId };
    } else {
      const id = generateId('file', rel);
      let content = null;
      if (isTextFile(name)) {
        try {
          if (stat.size <= 1024*1024) {
            content = fs.readFileSync(full, 'utf8');
            fileCache[full] = content;
          } else { content = '[File too large to display]'; }
        } catch(e) { content = `[Error reading file: ${e.message}]`; }
      } else { content = '[Binary file]'; }
      items[id] = { id, name, path: rel, type: 'file', content, parentId: rootId };
    }
  }
  return { items, rootId, path: dirPath };
}

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/test-backend', (req, res) => res.json({ status: 'ok', message: 'Backend is running' }));
app.get('/health', (req, res) => res.json({
  status: 'healthy',
  timestamp: Date.now() / 1000,
  workspace_directory: userWorkspaceDirectory,
  base_directory: baseDirectory
}));

// ── Directory / File ops ───────────────────────────────────────────────────
app.post('/open-specific-directory', (req, res) => {
  const { path: p } = req.body;
  if (!p) return res.status(400).json({ detail: 'No path provided' });
  if (!fs.existsSync(p)) return res.status(404).json({ detail: 'Directory not found' });
  if (!fs.statSync(p).isDirectory()) return res.status(400).json({ detail: 'Not a directory' });
  baseDirectory = path.resolve(p);
  setUserWorkspaceDirectory(p);
  res.json(scanDirectory(p));
});

app.get('/read-directory', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const full = path.join(baseDirectory, req.query.path || '');
  if (!fs.existsSync(full)) return res.status(404).json({ detail: 'Not found' });
  res.json(scanDirectory(full));
});

app.post('/fetch-folder-contents', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const target = req.body.path ? path.join(baseDirectory, req.body.path) : baseDirectory;
  if (!fs.existsSync(target)) return res.status(404).json({ detail: 'Not found' });
  res.json(scanDirectory(target));
});

app.get('/read-file', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const p = req.query.path;
  const full = path.isAbsolute(p) ? p : path.join(baseDirectory, p);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile())
    return res.status(404).json({ detail: 'File not found' });
  try {
    const content = fs.readFileSync(full, 'utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    res.set('Content-Type','text/plain; charset=utf-8').send(content);
  } catch(e) { res.status(500).json({ detail: e.message }); }
});

app.post('/read-text', (req, res) => {
  const p = req.body.path;
  if (!fs.existsSync(p)) return res.send(`[Error: File not found: ${p}]`);
  try {
    const buf = fs.readFileSync(p);
    res.set('Content-Type','text/plain').send(buf.toString('utf8'));
  } catch(e) { res.send(`[Error: ${e.message}]`); }
});

app.post('/save-file', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  let { path: p, content } = req.body;
  if (p.startsWith('file_')) p = p.slice(5);
  const full = path.isAbsolute(p) ? p : path.resolve(path.join(baseDirectory, p));
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    fileCache[full] = content;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ detail: e.message }); }
});

app.post('/create-file', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const { parentId, name } = req.body;
  let parentPath = '';
  if (!parentId.startsWith('root_')) {
    // find parent dir
    function findDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDirectory, full);
        if (generateId('dir', rel) === parentId) return rel;
        const found = findDir(full);
        if (found) return found;
      }
      return null;
    }
    parentPath = findDir(baseDirectory) || '';
  }
  const full = path.join(baseDirectory, parentPath, name);
  if (fs.existsSync(full)) return res.status(400).json({ detail: 'Already exists' });
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '', 'utf8');
  const rel = path.relative(baseDirectory, full);
  const id = generateId('file', rel);
  res.json({ id, file: { id, name, path: rel, type: 'file', content: '', parentId } });
});

app.post('/create-directory', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const { parentId, name } = req.body;
  let parentPath = '';
  if (!parentId.startsWith('root_')) {
    function findDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDirectory, full);
        if (generateId('dir', rel) === parentId) return rel;
        const found = findDir(full);
        if (found) return found;
      }
      return null;
    }
    parentPath = findDir(baseDirectory) || '';
  }
  const full = path.join(baseDirectory, parentPath, name);
  if (fs.existsSync(full)) return res.status(400).json({ detail: 'Already exists' });
  fs.mkdirSync(full, { recursive: true });
  const rel = path.relative(baseDirectory, full);
  const id = generateId('dir', rel);
  res.json({ id, directory: { id, name, path: rel, type: 'directory', parentId } });
});

app.delete('/delete', handleDelete);
app.post('/delete', handleDelete);
function handleDelete(req, res) {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const full = path.resolve(path.join(baseDirectory, req.body.path));
  if (!fs.existsSync(full)) return res.status(404).json({ detail: 'Not found' });
  try {
    if (fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true, force: true });
    else fs.unlinkSync(full);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ detail: e.message }); }
}

app.post('/rename', (req, res) => {
  const abs = path.join(baseDirectory, req.body.path);
  if (!fs.existsSync(abs)) return res.status(404).json({ success: false, error: 'Not found' });
  const newAbs = path.join(path.dirname(abs), req.body.new_name);
  if (fs.existsSync(newAbs)) return res.status(400).json({ success: false, error: 'Already exists' });
  try {
    fs.renameSync(abs, newAbs);
    res.json({ success: true, new_path: path.relative(baseDirectory, newAbs) });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/files', (req, res) => {
  const dir = req.query.currentDir || baseDirectory;
  if (!dir) return res.status(400).json({ detail: 'No directory opened' });
  const files = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: path.relative(dir, full).replace(/\\/g,'/'), type: 'file' });
    }
  }
  try { walk(dir); res.json(files.sort((a,b)=>a.path.localeCompare(b.path))); }
  catch(e) { res.status(500).json({ detail: e.message }); }
});

// ── Workspace ──────────────────────────────────────────────────────────────
app.post('/set-workspace-directory', (req, res) => {
  const { path: p } = req.body;
  if (!p || !fs.existsSync(p)) return res.status(404).json({ detail: 'Not found' });
  setUserWorkspaceDirectory(p);
  res.json({ success: true, workspace: userWorkspaceDirectory });
});

app.get('/get-workspace-directory', (req, res) => {
  res.json({ workspace: userWorkspaceDirectory, base: baseDirectory, effective: getWorkingDirectory() });
});

// ── Execute command ────────────────────────────────────────────────────────
app.post('/execute-command', async (req, res) => {
  const { command, timeout = 30, executionId } = req.body;
  const execId = executionId || `auto_${Date.now()}`;
  const cwd = getWorkingDirectory();
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const shellFlag = process.platform === 'win32' ? '-Command' : '-c';
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeout * 1000, shell: true });
    res.json({ executionId: execId, output: stdout + (stderr ? '\n' + stderr : ''), command, timestamp: Math.floor(Date.now()/1000) });
  } catch(e) {
    if (e.stdout || e.stderr) {
      res.json({ executionId: execId, output: (e.stdout||'') + (e.stderr ? '\n'+e.stderr : ''), command, timestamp: Math.floor(Date.now()/1000) });
    } else {
      res.json({ executionId: execId, error: e.message, command, timestamp: Math.floor(Date.now()/1000) });
    }
  }
});

// ── Chats ──────────────────────────────────────────────────────────────────
app.get('/chats', (req, res) => {
  const dir = getChatsDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const chats = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const chat = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (chat.messages && chat.messages.length > 1) chats.push(chat);
    } catch(e) {}
  }
  res.json(chats.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')));
});

app.get('/chats/:id', (req, res) => {
  const f = path.join(getChatsDirectory(), `${req.params.id}.json`);
  if (!fs.existsSync(f)) return res.status(404).json({ detail: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(f, 'utf8')));
});

app.get('/chats/:id/latest', (req, res) => {
  const f = path.join(getChatsDirectory(), `${req.params.id}.json`);
  if (!fs.existsSync(f)) return res.status(404).json({ detail: 'Not found' });
  const chat = JSON.parse(fs.readFileSync(f, 'utf8'));
  const after = parseInt(req.query.after_index || '0');
  if (after >= 0 && after < (chat.messages||[]).length) chat.messages = chat.messages.slice(after);
  res.json(chat);
});

app.post('/chats/:id', (req, res) => {
  const dir = getChatsDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const { messages = [], overwrite = false } = req.body;
  const valid = messages.filter(m => m && typeof m === 'object' && ['system','user','assistant','tool'].includes(m.role));
  const chatData = {
    id: req.params.id,
    name: (valid.find(m => m.role === 'user' && m.content) || {}).content?.slice(0,50) || 'New Chat',
    createdAt: new Date().toISOString(),
    messages: valid
  };
  fs.writeFileSync(path.join(dir, `${req.params.id}.json`), JSON.stringify(chatData, null, 2), 'utf8');
  res.json({ success: true, message_count: valid.length });
});

// ── Tools ──────────────────────────────────────────────────────────────────
const toolHandlers = require('./tools');
app.get('/api/tools/list', (req, res) => res.json({ tools: toolHandlers.TOOL_DEFINITIONS }));
app.post('/api/tools/call', async (req, res) => {
  const { tool_name, params } = req.body;
  const result = await toolHandlers.handleToolCall(tool_name, params, getWorkingDirectory());
  res.json(result);
});

// ── Codebase indexer ───────────────────────────────────────────────────────
const indexer = require('./indexer');
app.post('/api/codebase/set-workspace', (req, res) => {
  const { path: p } = req.body;
  if (!p || !fs.existsSync(p)) return res.status(400).json({ error: 'Invalid path' });
  setUserWorkspaceDirectory(p);
  indexer.setWorkspace(p);
  indexer.startIndexing(p);
  res.json({ success: true, workspace_path: p });
});
app.get('/api/codebase/overview', async (req, res) => res.json(await indexer.getOverview()));
app.get('/api/codebase/overview-fresh', async (req, res) => res.json(await indexer.getOverview(true)));
app.get('/api/codebase/search', async (req, res) => res.json(await indexer.search(req.query.query, req.query.element_types, parseInt(req.query.limit||'50'))));
app.get('/api/codebase/file-overview', async (req, res) => res.json(await indexer.fileOverview(req.query.file_path)));
app.post('/api/codebase/reindex', async (req, res) => { indexer.startIndexing(userWorkspaceDirectory); res.json({ message: 'Reindexing started' }); });
app.get('/api/codebase/info', (req, res) => res.json(indexer.getInfo()));
app.post('/api/codebase/clear-cache', async (req, res) => res.json(await indexer.clearCache()));
app.post('/api/codebase/cleanup-database', async (req, res) => res.json(await indexer.cleanupDatabase()));
app.get('/api/codebase/ai-context', async (req, res) => res.json(await indexer.getAiContext()));
app.get('/api/codebase/chat-context', async (req, res) => res.json(await indexer.getChatContext()));
app.get('/api/codebase/workspace-status', (req, res) => res.json(indexer.getWorkspaceStatus()));
app.post('/api/codebase/query', async (req, res) => res.json(await indexer.queryNaturalLanguage(req.body.query)));
app.post('/api/codebase/context', async (req, res) => res.json(await indexer.getRelevantContext(req.body.query, req.body.max_files)));
app.post('/api/codebase/cleanup-old-cache', async (req, res) => res.json({ success: true, message: 'No old cache to clean' }));

// ── Git ────────────────────────────────────────────────────────────────────
const gitRoutes = require('./git-routes');
app.use('/git', gitRoutes);

// ── GitHub ─────────────────────────────────────────────────────────────────
const githubRoutes = require('./github-routes');
app.use('/', githubRoutes);

// ── Relevant files (keyword search) ───────────────────────────────────────
app.post('/get-relevant-files', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const { query, max_files = 10 } = req.body;
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!isTextFile(e.name)) continue;
      try {
        const stat = fs.statSync(full);
        if (stat.size > 1024*1024) continue;
        const content = (fileCache[full] || fs.readFileSync(full,'utf8')).toLowerCase();
        const rel = path.relative(baseDirectory, full);
        let score = 0;
        for (const kw of keywords) {
          const count = (content.match(new RegExp(kw,'g'))||[]).length;
          if (count > 0) score += (1 + Math.log(count)) * 2;
          if (rel.toLowerCase().includes(kw)) score += 5;
        }
        if (score > 0) results.push({ path: rel, score: Math.round(score*100)/100 });
      } catch(e) {}
    }
  }
  walk(baseDirectory);
  results.sort((a,b) => b.score - a.score);
  res.json({ files: results.slice(0, max_files), keywords });
});

app.post('/get-file-contents', (req, res) => {
  if (!baseDirectory) return res.status(400).json({ detail: 'No directory opened' });
  const out = {};
  for (const p of (req.body || [])) {
    const full = path.join(baseDirectory, p);
    try { if (isTextFile(p)) out[p] = fs.readFileSync(full,'utf8'); } catch(e) {}
  }
  res.json(out);
});

app.post('/fetch_webpage', async (req, res) => {
  const result = await toolHandlers.fetchWebpage(req.body.url);
  res.json(result);
});

// ── WebSocket terminal ─────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/terminal' });

wss.on('connection', (ws) => {
  const cwd = getWorkingDirectory();
  const shell = process.platform === 'win32'
    ? { cmd: 'powershell.exe', args: ['-NoLogo','-NoExit','-NoProfile'] }
    : { cmd: 'bash', args: [] };

  const proc = spawn(shell.cmd, shell.args, { cwd, stdio: 'pipe', shell: false });

  proc.stdout.on('data', d => ws.readyState === WebSocket.OPEN && ws.send(d.toString()));
  proc.stderr.on('data', d => ws.readyState === WebSocket.OPEN && ws.send(d.toString()));
  proc.on('close', () => ws.readyState === WebSocket.OPEN && ws.close());

  ws.on('message', data => { try { proc.stdin.write(data.toString()); } catch(e) {} });
  ws.on('close', () => { try { proc.kill(); } catch(e) {} });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Backend running on http://127.0.0.1:${PORT}`));

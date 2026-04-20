'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// sql.js uses WebAssembly - we use a simple JSON-file based index instead
// for maximum compatibility without native modules

let workspacePath = null;
let isIndexing = false;

// In-memory index
let fileIndex = {};    // path -> { size, lang, lineCount, hash }
let elementIndex = []; // { file_path, element_type, name, line_start, signature }

function getAppDataPath() {
  const p = process.platform;
  if (p === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Pointer', 'data');
  if (p === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Pointer', 'data');
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer', 'data');
}

function getCacheDir(wsPath) {
  const hash = crypto.createHash('md5').update(wsPath).digest('hex').slice(0,8);
  const dir = path.join(getAppDataPath(), 'codebase_indexes', hash);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCachePath(wsPath) {
  return path.join(getCacheDir(wsPath), 'index.json');
}

function loadCache(wsPath) {
  try {
    const f = getCachePath(wsPath);
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      fileIndex = data.files || {};
      elementIndex = data.elements || [];
      console.log(`Loaded index: ${Object.keys(fileIndex).length} files, ${elementIndex.length} elements`);
    }
  } catch(e) { fileIndex = {}; elementIndex = []; }
}

function saveCache(wsPath) {
  try {
    fs.writeFileSync(getCachePath(wsPath), JSON.stringify({ files: fileIndex, elements: elementIndex }), 'utf8');
  } catch(e) { console.error('Failed to save index cache:', e.message); }
}

const LANG_MAP = {
  '.py':'python','.js':'javascript','.ts':'typescript','.tsx':'typescriptreact',
  '.jsx':'javascriptreact','.java':'java','.cpp':'cpp','.c':'c','.cs':'csharp',
  '.go':'go','.rs':'rust','.php':'php','.rb':'ruby','.html':'html','.css':'css',
  '.scss':'scss','.json':'json','.xml':'xml','.yaml':'yaml','.yml':'yaml',
  '.md':'markdown','.txt':'text','.sh':'shell','.sql':'sql'
};

const IGNORE_DIRS = new Set([
  'node_modules','.git','dist','build','.next','__pycache__','.venv','venv',
  'env','.env','coverage','.cache','tmp','temp','out','.output','vendor'
]);

function shouldIgnore(name) {
  return IGNORE_DIRS.has(name) || name.startsWith('.');
}

function extractElements(content, filePath, lang) {
  const elements = [];
  if (['javascript','typescript','typescriptreact','javascriptreact'].includes(lang)) {
    const patterns = [
      [/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g, 'function'],
      [/(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g, 'function'],
      [/(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g, 'class'],
      [/(?:^|\n)\s*(?:export\s+)?interface\s+(\w+)/g, 'interface'],
      [/(?:^|\n)\s*(?:export\s+)?type\s+(\w+)\s*=/g, 'type'],
    ];
    for (const [re, type] of patterns) {
      let m;
      while ((m = re.exec(content)) !== null) {
        const line = content.slice(0, m.index).split('\n').length;
        elements.push({ file_path: filePath, element_type: type, name: m[1], line_start: line, line_end: line + 5, signature: m[0].trim().slice(0,100) });
      }
    }
  } else if (lang === 'python') {
    const re = /(?:^|\n)(def|class)\s+(\w+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const line = content.slice(0, m.index).split('\n').length;
      elements.push({ file_path: filePath, element_type: m[1] === 'class' ? 'class' : 'function', name: m[2], line_start: line, line_end: line + 5, signature: m[0].trim().slice(0,100) });
    }
  }
  return elements;
}

function indexFile(filePath) {
  if (!workspacePath) return;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024) return;
    const ext = path.extname(filePath).toLowerCase();
    const lang = LANG_MAP[ext];
    if (!lang) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const rel = path.relative(workspacePath, filePath).replace(/\\/g,'/');

    if (fileIndex[rel] && fileIndex[rel].hash === hash) return; // unchanged

    fileIndex[rel] = { size: stat.size, lang, lineCount: content.split('\n').length, hash };
    // remove old elements for this file
    elementIndex = elementIndex.filter(e => e.file_path !== rel);
    // add new elements
    elementIndex.push(...extractElements(content, rel, lang));
  } catch(e) { /* skip */ }
}

function walkAndIndex(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
  for (const e of entries) {
    if (shouldIgnore(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkAndIndex(full);
    else if (e.isFile()) indexFile(full);
  }
}

function setWorkspace(p) {
  workspacePath = path.resolve(p);
  loadCache(workspacePath);
}

function startIndexing(p) {
  if (p) setWorkspace(p);
  if (!workspacePath || isIndexing) return;
  isIndexing = true;
  setImmediate(() => {
    try {
      walkAndIndex(workspacePath);
      saveCache(workspacePath);
      console.log(`Indexing done: ${Object.keys(fileIndex).length} files, ${elementIndex.length} elements`);
    } catch(e) { console.error('Indexing error:', e.message); }
    isIndexing = false;
  });
}

function getInfo() {
  return {
    total_indexed_files: Object.keys(fileIndex).length,
    total_code_elements: elementIndex.length,
    workspace_path: workspacePath,
    is_indexing: isIndexing
  };
}

async function getOverview(fresh = false) {
  if (!workspacePath) return { error: 'No workspace set' };
  if (fresh) { walkAndIndex(workspacePath); saveCache(workspacePath); }
  const langs = {};
  for (const f of Object.values(fileIndex)) langs[f.lang] = (langs[f.lang] || 0) + 1;
  const totalLines = Object.values(fileIndex).reduce((s, f) => s + (f.lineCount || 0), 0);
  return {
    overview: {
      total_files: Object.keys(fileIndex).length,
      total_lines: totalLines,
      languages: langs,
      main_directories: [],
      key_files: []
    },
    workspace_path: workspacePath
  };
}

async function search(query, elementTypes, limit = 50) {
  if (!query) return { error: 'No query' };
  const q = query.toLowerCase();
  let results = elementIndex.filter(e => e.name.toLowerCase().includes(q) || (e.signature||'').toLowerCase().includes(q));
  if (elementTypes) {
    const types = elementTypes.split(',').map(t => t.trim());
    results = results.filter(e => types.includes(e.element_type));
  }
  return { query, results: results.slice(0, limit), total: results.length };
}

async function fileOverview(filePath) {
  const meta = fileIndex[filePath];
  if (!meta) return { error: 'File not found in index' };
  const elements = elementIndex.filter(e => e.file_path === filePath);
  return { path: filePath, ...meta, elements };
}

async function clearCache() {
  fileIndex = {}; elementIndex = [];
  if (workspacePath) { walkAndIndex(workspacePath); saveCache(workspacePath); }
  return { success: true, message: 'Cache cleared and reindexed' };
}

async function cleanupDatabase() {
  if (!workspacePath) return { error: 'No workspace' };
  let removed = 0;
  for (const rel of Object.keys(fileIndex)) {
    if (!fs.existsSync(path.join(workspacePath, rel))) {
      delete fileIndex[rel];
      elementIndex = elementIndex.filter(e => e.file_path !== rel);
      removed++;
    }
  }
  saveCache(workspacePath);
  return { success: true, cleanup_result: { removed_files: removed } };
}

async function getAiContext() {
  const info = getInfo();
  const topFiles = Object.entries(fileIndex).sort((a,b) => (b[1].lineCount||0) - (a[1].lineCount||0)).slice(0,10).map(([p,m]) => ({ path: p, line_count: m.lineCount }));
  return { ...info, top_files: topFiles };
}

async function getChatContext() {
  const info = getInfo();
  const langs = {};
  for (const f of Object.values(fileIndex)) langs[f.lang] = (langs[f.lang] || 0) + 1;
  const langStr = Object.entries(langs).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([l,c])=>`${l}(${c})`).join(', ');
  return { context: `## Codebase: ${info.total_indexed_files} files — ${langStr}`, workspace_path: workspacePath };
}

function getWorkspaceStatus() {
  return { workspace_path: workspacePath, is_indexing: isIndexing, indexed_files: Object.keys(fileIndex).length };
}

async function queryNaturalLanguage(query) {
  return search(query, null, 20);
}

async function getRelevantContext(query, maxFiles = 5) {
  const results = await search(query, null, maxFiles * 3);
  const files = [...new Set(results.results.map(r => r.file_path))].slice(0, maxFiles);
  return { query, relevant_files: files, elements: results.results };
}

module.exports = { setWorkspace, startIndexing, getInfo, getOverview, search, fileOverview, clearCache, cleanupDatabase, getAiContext, getChatContext, getWorkspaceStatus, queryNaturalLanguage, getRelevantContext };

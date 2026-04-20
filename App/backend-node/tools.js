'use strict';
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const https = require('https');
const http = require('http');

// ── Path helpers ───────────────────────────────────────────────────────────
function resolvePath(relPath) {
  if (!relPath) return relPath;
  if (path.isAbsolute(relPath)) return relPath;
  const resolved = path.resolve(process.cwd(), relPath);
  const workspace = path.resolve(process.cwd());
  if (!resolved.startsWith(workspace)) throw new Error(`Path ${relPath} resolves outside workspace`);
  return resolved;
}

// ── read_file ──────────────────────────────────────────────────────────────
async function readFile({ file_path, target_file } = {}) {
  const actual = target_file ?? file_path;
  if (!actual) return { success: false, error: 'No file path provided' };
  try {
    const resolved = resolvePath(actual);
    if (!fs.existsSync(resolved)) return { success: false, error: `File not found: ${actual}` };
    const ext = path.extname(resolved).toLowerCase();
    const size = fs.statSync(resolved).size;
    if (ext === '.json') {
      const content = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      return { success: true, content, metadata: { path: actual, resolved_path: resolved, size, type: 'json', extension: ext } };
    }
    const content = fs.readFileSync(resolved, 'utf8');
    return { success: true, content, metadata: { path: actual, resolved_path: resolved, size, type: 'text', extension: ext } };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── list_directory ─────────────────────────────────────────────────────────
async function listDirectory({ directory_path } = {}) {
  if (!directory_path) return { success: false, error: 'No directory path provided' };
  try {
    const resolved = resolvePath(directory_path);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory())
      return { success: false, error: `Directory not found: ${directory_path}` };
    const contents = fs.readdirSync(resolved).map(name => {
      const full = path.join(resolved, name);
      const isDir = fs.statSync(full).isDirectory();
      return { name, path: path.join(directory_path, name), resolved_path: full, type: isDir ? 'directory' : 'file', size: isDir ? null : fs.statSync(full).size };
    });
    return { success: true, directory: directory_path, resolved_directory: resolved, contents };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── write_file ─────────────────────────────────────────────────────────────
async function writeFile({ file_path, target_file, content } = {}) {
  const actual = target_file ?? file_path;
  if (!actual) return { success: false, error: 'No file path provided' };
  try {
    const resolved = resolvePath(actual);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content ?? '', 'utf8');
    return { success: true, message: `File written: ${actual}`, file_path: actual };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── delete_file ────────────────────────────────────────────────────────────
async function deleteFile({ file_path, target_file } = {}) {
  const actual = target_file ?? file_path;
  if (!actual) return { success: false, error: 'No file path provided' };
  try {
    const resolved = resolvePath(actual);
    if (!fs.existsSync(resolved)) return { success: false, error: `File not found: ${actual}` };
    fs.unlinkSync(resolved);
    return { success: true, message: `File deleted: ${actual}` };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── move_file ──────────────────────────────────────────────────────────────
async function moveFile({ source_path, destination_path, create_directories = true } = {}) {
  try {
    const src = resolvePath(source_path);
    const dst = resolvePath(destination_path);
    if (!fs.existsSync(src)) return { success: false, error: `Source not found: ${source_path}` };
    if (create_directories) fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return { success: true, message: `Moved: ${source_path} -> ${destination_path}` };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── copy_file ──────────────────────────────────────────────────────────────
async function copyFile({ source_path, destination_path, create_directories = true } = {}) {
  try {
    const src = resolvePath(source_path);
    const dst = resolvePath(destination_path);
    if (!fs.existsSync(src)) return { success: false, error: `Source not found: ${source_path}` };
    if (create_directories) fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return { success: true, message: `Copied: ${source_path} -> ${destination_path}` };
  } catch(e) { return { success: false, error: e.message }; }
}

// ── run_terminal_cmd ───────────────────────────────────────────────────────
async function runTerminalCmd({ command, working_directory, timeout = 30 } = {}) {
  const cwd = working_directory && fs.existsSync(working_directory) ? working_directory : process.cwd();
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeout * 1000, shell: true });
    return { success: true, return_code: 0, stdout: stdout.trim(), stderr: stderr.trim(), command, working_directory: cwd, execution_time: (Date.now()-start)/1000 };
  } catch(e) {
    return { success: false, return_code: e.code || 1, stdout: e.stdout?.trim()||'', stderr: e.stderr?.trim()||'', error: e.message, command, working_directory: cwd, execution_time: (Date.now()-start)/1000 };
  }
}

// ── grep_search ────────────────────────────────────────────────────────────
async function grepSearch({ query, include_pattern, exclude_pattern, case_sensitive = false } = {}) {
  try {
    let cmd = `rg --json --line-number --column${case_sensitive ? '' : ' --ignore-case'}`;
    if (include_pattern) cmd += ` -g "${include_pattern}"`;
    if (exclude_pattern) cmd += ` -g "!${exclude_pattern}"`;
    cmd += ` --max-count 50 "${query.replace(/"/g,'\\"')}" .`;
    const { stdout } = await execAsync(cmd, { cwd: process.cwd(), timeout: 15000 });
    const matches = [];
    for (const line of stdout.split('\n')) {
      try {
        const r = JSON.parse(line);
        if (r.type === 'match') {
          matches.push({ file: r.data.path.text, line_number: r.data.line_number, line: r.data.lines.text.trim() });
        }
      } catch(e) {}
    }
    return { success: true, query, matches };
  } catch(e) {
    if (e.code === 1) return { success: true, query, matches: [] }; // rg returns 1 for no matches
    return { success: false, error: e.message };
  }
}

// ── web_search ─────────────────────────────────────────────────────────────
async function webSearch({ search_term, query, num_results = 5 } = {}) {
  const q = search_term ?? query;
  if (!q) return { success: false, error: 'No query provided' };
  try {
    const html = await fetchUrl(`https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}&cat=web&language=english`);
    const results = parseStartpageResults(html, num_results);
    return { success: true, query: q, results, source: 'Startpage' };
  } catch(e) { return { success: false, error: e.message }; }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5' } };
    mod.get(url, opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function parseStartpageResults(html, limit) {
  const results = [];
  const linkRe = /<a[^>]+href="(https?:\/\/(?!(?:www\.)?startpage\.com)[^"]+)"[^>]*>([^<]{10,150})<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null && results.length < limit) {
    const url = m[1], title = m[2].trim();
    if (title.length < 10) continue;
    results.push({ title: title.slice(0,100), url, snippet: 'Result from web search', position: results.length + 1 });
  }
  return results;
}

// ── fetch_webpage ──────────────────────────────────────────────────────────
async function fetchWebpage(url) {
  if (!url) return { success: false, error: 'No URL provided' };
  try {
    const content = await fetchUrl(url);
    return { success: true, url, content: content.slice(0, 15000), truncated: content.length > 15000 };
  } catch(e) { return { success: false, url, error: e.message }; }
}

// ── codebase tools (proxy to indexer endpoints) ────────────────────────────
async function localGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:23816${urlPath}`, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    }).on('error', reject);
  });
}

async function localPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: '127.0.0.1', port: 23816, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function getCodebaseOverview() { return localGet('/api/codebase/overview-fresh'); }
async function searchCodebase({ query, element_types, limit = 20 } = {}) {
  let url = `/api/codebase/search?query=${encodeURIComponent(query)}&limit=${limit}`;
  if (element_types) url += `&element_types=${encodeURIComponent(element_types)}`;
  return localGet(url);
}
async function getFileOverview({ file_path } = {}) { return localGet(`/api/codebase/file-overview?file_path=${encodeURIComponent(file_path)}`); }
async function getAiCodebaseContext() { return localGet('/api/codebase/ai-context'); }
async function queryCodebaseNaturalLanguage({ query } = {}) { return localPost('/api/codebase/query', { query }); }
async function getRelevantCodebaseContext({ query, max_files = 5 } = {}) { return localPost('/api/codebase/context', { query, max_files }); }
async function forceCodebaseReindex() { return localPost('/api/codebase/clear-cache', {}); }
async function cleanupCodebaseDatabase() { return localPost('/api/codebase/cleanup-database', {}); }

// ── Dispatcher ─────────────────────────────────────────────────────────────
const TOOL_HANDLERS = {
  read_file: readFile,
  list_directory: listDirectory,
  write_file: writeFile,
  delete_file: deleteFile,
  move_file: moveFile,
  copy_file: copyFile,
  run_terminal_cmd: runTerminalCmd,
  grep_search: grepSearch,
  web_search: webSearch,
  fetch_webpage: ({ url } = {}) => fetchWebpage(url),
  get_codebase_overview: getCodebaseOverview,
  search_codebase: searchCodebase,
  get_file_overview: getFileOverview,
  get_ai_codebase_context: getAiCodebaseContext,
  query_codebase_natural_language: queryCodebaseNaturalLanguage,
  get_relevant_codebase_context: getRelevantCodebaseContext,
  force_codebase_reindex: forceCodebaseReindex,
  cleanup_codebase_database: cleanupCodebaseDatabase,
};

async function handleToolCall(toolName, params, workspaceDir) {
  if (workspaceDir) process.chdir(workspaceDir);
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) return { success: false, error: `Unknown tool: ${toolName}` };
  try { return await handler(params || {}); }
  catch(e) { return { success: false, error: e.message }; }
}

const TOOL_DEFINITIONS = [
  { name: 'read_file', description: 'Read file contents', parameters: { type: 'object', properties: { file_path: { type: 'string' }, target_file: { type: 'string' } }, required: ['file_path'] } },
  { name: 'write_file', description: 'Write content to a file', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'delete_file', description: 'Delete a file', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
  { name: 'move_file', description: 'Move or rename a file', parameters: { type: 'object', properties: { source_path: { type: 'string' }, destination_path: { type: 'string' } }, required: ['source_path', 'destination_path'] } },
  { name: 'copy_file', description: 'Copy a file', parameters: { type: 'object', properties: { source_path: { type: 'string' }, destination_path: { type: 'string' } }, required: ['source_path', 'destination_path'] } },
  { name: 'list_directory', description: 'List directory contents', parameters: { type: 'object', properties: { directory_path: { type: 'string' } }, required: ['directory_path'] } },
  { name: 'run_terminal_cmd', description: 'Execute a terminal command', parameters: { type: 'object', properties: { command: { type: 'string' }, working_directory: { type: 'string' }, timeout: { type: 'integer' } }, required: ['command'] } },
  { name: 'grep_search', description: 'Search for a pattern in files', parameters: { type: 'object', properties: { query: { type: 'string' }, include_pattern: { type: 'string' }, exclude_pattern: { type: 'string' }, case_sensitive: { type: 'boolean' } }, required: ['query'] } },
  { name: 'web_search', description: 'Search the web', parameters: { type: 'object', properties: { search_term: { type: 'string' }, num_results: { type: 'integer' } }, required: ['search_term'] } },
  { name: 'fetch_webpage', description: 'Fetch webpage content', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'get_codebase_overview', description: 'Get codebase overview', parameters: { type: 'object', properties: {} } },
  { name: 'search_codebase', description: 'Search code elements', parameters: { type: 'object', properties: { query: { type: 'string' }, element_types: { type: 'string' }, limit: { type: 'integer' } }, required: ['query'] } },
  { name: 'get_file_overview', description: 'Get file overview', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
  { name: 'get_ai_codebase_context', description: 'Get AI-friendly codebase context', parameters: { type: 'object', properties: {} } },
  { name: 'query_codebase_natural_language', description: 'Query codebase in natural language', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'get_relevant_codebase_context', description: 'Get relevant context for a task', parameters: { type: 'object', properties: { query: { type: 'string' }, max_files: { type: 'integer' } }, required: ['query'] } },
  { name: 'force_codebase_reindex', description: 'Force reindex of codebase', parameters: { type: 'object', properties: {} } },
  { name: 'cleanup_codebase_database', description: 'Clean up stale database entries', parameters: { type: 'object', properties: {} } },
];

module.exports = { handleToolCall, fetchWebpage, TOOL_DEFINITIONS };

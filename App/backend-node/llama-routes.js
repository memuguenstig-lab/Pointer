'use strict';
/**
 * llama-routes.js — stub for embedded LLM (node-llama-cpp).
 * All endpoints return proper JSON so the frontend can handle them gracefully.
 * The actual download/load logic lives in the frontend via direct HuggingFace URLs.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// ── Models directory ───────────────────────────────────────────────────────
function getModelsDir() {
  const p = process.platform;
  let base;
  if (p === 'win32') base = path.join(process.env.APPDATA || os.homedir(), 'Pointer');
  else if (p === 'darwin') base = path.join(os.homedir(), 'Library', 'Application Support', 'Pointer');
  else base = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer');
  const dir = path.join(base, 'models');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

// ── Download state ─────────────────────────────────────────────────────────
let downloadState = {
  active: false,
  modelId: null,
  fileName: null,
  bytesReceived: 0,
  bytesTotal: 0,
  percent: 0,
  error: null,
  done: false,
};

// ── Recommended models list ────────────────────────────────────────────────
const MODELS = [
  { id: 'qwen2.5-coder-1.5b', file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF' },
  { id: 'qwen2.5-coder-3b',   file: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',   repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF' },
  { id: 'qwen2.5-coder-7b',   file: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',   repo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF' },
  { id: 'deepseek-coder-v2-lite', file: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf', repo: 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF' },
  { id: 'codellama-7b',       file: 'codellama-7b-instruct.Q4_K_M.gguf',        repo: 'TheBloke/CodeLlama-7B-Instruct-GGUF' },
  { id: 'starcoder2-3b',      file: 'starcoder2-3b-Q4_K_M.gguf',                repo: 'bartowski/starcoder2-3b-GGUF' },
  { id: 'phi-3.5-mini',       file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',        repo: 'bartowski/Phi-3.5-mini-instruct-GGUF' },
  { id: 'phi-4-mini',         file: 'phi-4-mini-instruct-Q4_K_M.gguf',          repo: 'bartowski/phi-4-mini-instruct-GGUF' },
  { id: 'llama-3.2-3b',       file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',       repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF' },
  { id: 'llama-3.1-8b',       file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',  repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF' },
  { id: 'mistral-7b-v0.3',    file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',    repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF' },
  { id: 'gemma-2-2b',         file: 'gemma-2-2b-it-Q4_K_M.gguf',               repo: 'bartowski/gemma-2-2b-it-GGUF' },
  { id: 'gemma-2-9b',         file: 'gemma-2-9b-it-Q4_K_M.gguf',               repo: 'bartowski/gemma-2-9b-it-GGUF' },
  { id: 'qwen2.5-7b',         file: 'qwen2.5-7b-instruct-q4_k_m.gguf',         repo: 'Qwen/Qwen2.5-7B-Instruct-GGUF' },
  { id: 'deepseek-r1-1.5b',   file: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf', repo: 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF' },
  { id: 'deepseek-r1-7b',     file: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',   repo: 'bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF' },
  { id: 'qwq-32b',            file: 'QwQ-32B-Q4_K_M.gguf',                     repo: 'bartowski/QwQ-32B-GGUF' },
];

function modelStatus() {
  const dir = getModelsDir();
  return MODELS.map(m => ({
    ...m,
    downloaded: fs.existsSync(path.join(dir, m.file)),
    loaded: false, // node-llama-cpp not available in this build
  }));
}

// ── Download helper ────────────────────────────────────────────────────────
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Pointer/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;
      res.on('data', chunk => {
        received += chunk.length;
        if (onProgress) onProgress(received, total);
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      file.close();
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(err);
    });
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({
    available: false, // node-llama-cpp not compiled in this build
    modelLoaded: false,
    loadedModelPath: null,
    modelsDir: getModelsDir(),
    localModels: modelStatus(),
    downloadState,
  });
});

router.get('/models', (req, res) => {
  res.json({ models: modelStatus() });
});

router.post('/download', (req, res) => {
  const { modelId } = req.body || {};
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return res.status(404).json({ error: `Unknown model: ${modelId}` });
  if (downloadState.active) return res.status(409).json({ error: 'Download already in progress' });

  const dest = path.join(getModelsDir(), model.file);
  if (fs.existsSync(dest)) return res.json({ success: true, message: 'Already downloaded', path: dest });

  const url = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;
  downloadState = { active: true, modelId, fileName: model.file, bytesReceived: 0, bytesTotal: 0, percent: 0, error: null, done: false };

  res.json({ success: true, message: 'Download started', modelId, url });

  downloadFile(url, dest, (received, total) => {
    downloadState.bytesReceived = received;
    downloadState.bytesTotal = total;
    downloadState.percent = total > 0 ? Math.round((received / total) * 100) : 0;
  }).then(() => {
    downloadState = { ...downloadState, active: false, done: true, percent: 100 };
    console.log(`[llama] Downloaded: ${dest}`);
  }).catch(err => {
    downloadState = { ...downloadState, active: false, error: err.message };
    try { fs.unlinkSync(dest); } catch (_) {}
    console.error('[llama] Download failed:', err.message);
  });
});

router.get('/download/status', (req, res) => {
  res.json(downloadState);
});

router.post('/load', (req, res) => {
  // node-llama-cpp not available — return informative error
  res.status(503).json({ error: 'Embedded inference not available in this build. The model is downloaded and ready for use with an external runtime like Ollama or LM Studio.' });
});

router.post('/unload', (req, res) => {
  res.json({ success: true });
});

router.post('/chat', (req, res) => {
  res.status(503).json({ error: 'Embedded inference not available in this build.' });
});

module.exports = router;

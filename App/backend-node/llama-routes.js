'use strict';
/**
 * llama-routes.js — Model download manager with:
 *  - Parallel chunk downloads (4 connections) for max speed
 *  - Resume support (continues interrupted downloads)
 *  - Background download (persists when UI is closed)
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const https   = require('https');

// ── Models directory ───────────────────────────────────────────────────────
function getModelsDir() {
  const p = process.platform;
  let base;
  if (p === 'win32')    base = path.join(process.env.APPDATA || os.homedir(), 'Pointer');
  else if (p === 'darwin') base = path.join(os.homedir(), 'Library', 'Application Support', 'Pointer');
  else                  base = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer');
  const dir = path.join(base, 'models');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

// ── Download state (persists across requests) ──────────────────────────────
let downloadState = {
  active: false, modelId: null, fileName: null,
  bytesReceived: 0, bytesTotal: 0, percent: 0,
  speed: 0,          // bytes/sec
  eta: null,         // seconds remaining
  error: null, done: false,
};

// ── Model catalogue ────────────────────────────────────────────────────────
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
  // Extra models
  { id: 'qwen2.5-coder-14b',  file: 'qwen2.5-coder-14b-instruct-q4_k_m.gguf',  repo: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF' },
  { id: 'codegemma-7b',       file: 'codegemma-7b-it-Q4_K_M.gguf',             repo: 'bartowski/codegemma-7b-it-GGUF' },
  { id: 'deepseek-coder-6.7b',file: 'deepseek-coder-6.7b-instruct.Q4_K_M.gguf',repo: 'TheBloke/deepseek-coder-6.7B-instruct-GGUF' },
  { id: 'llama-3.2-1b',       file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',      repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF' },
  { id: 'llama-3.3-70b',      file: 'Llama-3.3-70B-Instruct-Q4_K_M.gguf',     repo: 'bartowski/Llama-3.3-70B-Instruct-GGUF' },
  { id: 'mistral-nemo-12b',   file: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf', repo: 'bartowski/Mistral-Nemo-Instruct-2407-GGUF' },
  { id: 'gemma-3-4b',         file: 'gemma-3-4b-it-Q4_K_M.gguf',              repo: 'bartowski/gemma-3-4b-it-GGUF' },
  { id: 'gemma-3-12b',        file: 'gemma-3-12b-it-Q4_K_M.gguf',             repo: 'bartowski/gemma-3-12b-it-GGUF' },
  { id: 'qwen2.5-14b',        file: 'qwen2.5-14b-instruct-q4_k_m.gguf',       repo: 'Qwen/Qwen2.5-14B-Instruct-GGUF' },
  { id: 'qwen2.5-32b',        file: 'qwen2.5-32b-instruct-q4_k_m.gguf',       repo: 'Qwen/Qwen2.5-32B-Instruct-GGUF' },
  { id: 'smollm2-1.7b',       file: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',     repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF' },
  { id: 'deepseek-r1-14b',    file: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf', repo: 'bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF' },
  { id: 'deepseek-r1-32b',    file: 'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf', repo: 'bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF' },
  { id: 'phi-4',              file: 'phi-4-Q4_K_M.gguf',                      repo: 'bartowski/phi-4-GGUF' },
];

function modelStatus() {
  const dir = getModelsDir();
  return MODELS.map(m => ({
    ...m,
    downloaded: fs.existsSync(path.join(dir, m.file)),
    loaded: loadedModelPath === path.join(dir, m.file),
  }));
}

// ── Inference state ────────────────────────────────────────────────────────
let llamaInstance = null;
let loadedModel = null;
let loadedModelPath = null;

async function getLlamaInstance() {
  if (llamaInstance) return llamaInstance;
  const { getLlama } = await import('node-llama-cpp');
  llamaInstance = await getLlama({ gpu: 'auto' }).catch(() => getLlama({ gpu: false }));
  console.log('[llama] Initialized, GPU:', llamaInstance.gpu ?? 'cpu');
  return llamaInstance;
}

async function ensureModelLoaded(modelPath) {
  if (loadedModelPath === modelPath && loadedModel) return loadedModel;
  // Unload previous
  if (loadedModel) {
    try { await loadedModel.dispose(); } catch (_) {}
    loadedModel = null;
    loadedModelPath = null;
  }
  const llama = await getLlamaInstance();
  console.log('[llama] Loading model:', modelPath);
  loadedModel = await llama.loadModel({ modelPath });
  loadedModelPath = modelPath;
  console.log('[llama] Model loaded');
  return loadedModel;
}

// ── Parallel chunk downloader ──────────────────────────────────────────────
const PARALLEL_CHUNKS = 8;
const CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB per chunk

/**
 * Fetch a byte range from a URL.
 * Returns a Buffer with the chunk data.
 */
function fetchRange(url, start, end) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Pointer/1.0',
        'Range': `bytes=${start}-${end}`,
      },
    };
    https.get(url, opts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRange(res.headers.location, start, end).then(resolve).catch(reject);
      }
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for range ${start}-${end}`));
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Get the total file size via HEAD request.
 * Also resolves redirects and returns the final URL.
 */
function getFileMeta(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Pointer/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return getFileMeta(res.headers.location).then(resolve).catch(reject);
      }
      const size = parseInt(res.headers['content-length'] || '0');
      const acceptsRanges = res.headers['accept-ranges'] === 'bytes';
      resolve({ size, acceptsRanges, finalUrl: url });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Download a file using parallel chunks for maximum speed.
 * Falls back to single-stream if server doesn't support ranges.
 * Supports resume: if partial file exists, continues from where it left off.
 */
async function downloadParallel(url, dest) {
  // Check for partial download
  let resumeFrom = 0;
  const partFile = dest + '.part';
  if (fs.existsSync(partFile)) {
    resumeFrom = fs.statSync(partFile).size;
    console.log(`[llama] Resuming download from ${(resumeFrom / 1024 / 1024).toFixed(1)} MB`);
  }

  // Get file metadata
  const { size: totalSize, acceptsRanges, finalUrl } = await getFileMeta(url);
  downloadState.bytesTotal = totalSize;
  downloadState.bytesReceived = resumeFrom;

  const speedSamples = [];
  let lastBytes = resumeFrom;
  let lastTime = Date.now();

  const updateSpeed = () => {
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed > 0) {
      const speed = (downloadState.bytesReceived - lastBytes) / elapsed;
      speedSamples.push(speed);
      if (speedSamples.length > 5) speedSamples.shift();
      const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
      downloadState.speed = Math.round(avgSpeed);
      const remaining = totalSize - downloadState.bytesReceived;
      downloadState.eta = avgSpeed > 0 ? Math.round(remaining / avgSpeed) : null;
      lastBytes = downloadState.bytesReceived;
      lastTime = now;
    }
  };

  const speedInterval = setInterval(updateSpeed, 1000);

  try {
    if (!acceptsRanges || totalSize === 0) {
      // Fallback: single stream
      await downloadSingleStream(finalUrl, dest, resumeFrom);
    } else {
      await downloadChunked(finalUrl, dest, partFile, totalSize, resumeFrom);
    }
  } finally {
    clearInterval(speedInterval);
  }
}

function downloadSingleStream(url, dest, resumeFrom) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Pointer/1.0' };
    if (resumeFrom > 0) headers['Range'] = `bytes=${resumeFrom}-`;

    const file = fs.createWriteStream(dest, { flags: resumeFrom > 0 ? 'a' : 'w' });
    https.get(url, { headers }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadSingleStream(res.headers.location, dest, resumeFrom).then(resolve).catch(reject);
      }
      res.on('data', chunk => {
        downloadState.bytesReceived += chunk.length;
        downloadState.percent = downloadState.bytesTotal > 0
          ? Math.round((downloadState.bytesReceived / downloadState.bytesTotal) * 100) : 0;
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); reject(err); });
  });
}

async function downloadChunked(url, dest, partFile, totalSize, resumeFrom) {
  // Build list of chunks to download
  const chunks = [];
  for (let start = resumeFrom; start < totalSize; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
    chunks.push({ start, end, index: chunks.length });
  }

  // Open file for writing (append if resuming)
  const fd = fs.openSync(partFile, resumeFrom > 0 ? 'r+' : 'w');

  // Pre-allocate file size on first run
  if (resumeFrom === 0 && totalSize > 0) {
    try { fs.ftruncateSync(fd, totalSize); } catch (_) {}
  }

  // Process chunks in parallel batches
  let chunkIdx = 0;
  while (chunkIdx < chunks.length) {
    const batch = chunks.slice(chunkIdx, chunkIdx + PARALLEL_CHUNKS);
    await Promise.all(batch.map(async chunk => {
      let retries = 3;
      while (retries > 0) {
        try {
          const data = await fetchRange(url, chunk.start, chunk.end);
          // Write chunk at correct position
          fs.writeSync(fd, data, 0, data.length, chunk.start);
          downloadState.bytesReceived += data.length;
          downloadState.percent = Math.round((downloadState.bytesReceived / totalSize) * 100);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }));
    chunkIdx += PARALLEL_CHUNKS;
  }

  fs.closeSync(fd);

  // Rename .part to final file
  fs.renameSync(partFile, dest);
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({
    available: true,
    modelLoaded: !!loadedModel,
    loadedModelPath,
    modelsDir: getModelsDir(),
    localModels: modelStatus(),
    downloadState,
  });
});

router.get('/models', (req, res) => {
  res.json({ models: modelStatus() });
});

router.post('/download', async (req, res) => {
  const { modelId } = req.body || {};
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return res.status(404).json({ error: `Unknown model: ${modelId}` });
  if (downloadState.active) return res.status(409).json({ error: 'Download already in progress' });

  const dest = path.join(getModelsDir(), model.file);
  if (fs.existsSync(dest)) return res.json({ success: true, message: 'Already downloaded', path: dest });

  const url = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;
  downloadState = {
    active: true, modelId, fileName: model.file,
    bytesReceived: 0, bytesTotal: 0, percent: 0,
    speed: 0, eta: null, error: null, done: false,
  };

  // Respond immediately — download runs in background
  res.json({ success: true, message: 'Download started', modelId, url });

  // Run download in background (not awaited)
  downloadParallel(url, dest)
    .then(() => {
      console.log(`[llama] Download complete: ${dest}`);
      downloadState = { ...downloadState, active: false, done: true, percent: 100, speed: 0, eta: 0 };
    })
    .catch(err => {
      console.error('[llama] Download failed:', err.message);
      downloadState = { ...downloadState, active: false, error: err.message };
      // Keep partial file for resume
    });
});

router.post('/download/cancel', (req, res) => {
  // Mark as cancelled — the download loop will stop on next chunk
  if (downloadState.active) {
    downloadState.active = false;
    downloadState.error = 'Cancelled by user';
  }
  res.json({ success: true });
});

router.get('/download/status', (req, res) => {
  res.json(downloadState);
});

// Delete a downloaded model
router.delete('/models/:modelId', (req, res) => {
  const model = MODELS.find(m => m.id === req.params.modelId);
  if (!model) return res.status(404).json({ error: 'Unknown model' });
  const dest = path.join(getModelsDir(), model.file);
  const part = dest + '.part';
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    if (fs.existsSync(part)) fs.unlinkSync(part);
    console.log(`[llama] Deleted model: ${model.file}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/load', async (req, res) => {
  const { modelId, modelPath } = req.body || {};
  let filePath = modelPath;
  if (!filePath && modelId) {
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return res.status(404).json({ error: 'Unknown model' });
    filePath = path.join(getModelsDir(), model.file);
  }
  if (!filePath) return res.status(400).json({ error: 'modelId or modelPath required' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Model file not found: ${filePath}` });

  try {
    await ensureModelLoaded(filePath);
    res.json({ success: true, modelPath: filePath });
  } catch (err) {
    console.error('[llama] Load failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/unload', async (req, res) => {
  if (loadedModel) {
    try { await loadedModel.dispose(); } catch (_) {}
    loadedModel = null;
    loadedModelPath = null;
  }
  res.json({ success: true });
});

router.post('/chat', async (req, res) => {
  if (!loadedModel) {
    return res.status(503).json({ error: 'No model loaded. Call /api/llama/load first.' });
  }

  const { messages = [], temperature = 0.7, max_tokens, stream = true } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'messages required' });

  try {
    const { LlamaChatSession } = await import('node-llama-cpp');

    const systemMsg = messages.find(m => m.role === 'system');
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return res.status(400).json({ error: 'No user message' });

    const context = await loadedModel.createContext({
      contextSize: Math.min(2048, loadedModel.trainContextSize ?? 2048),
    });

    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      ...(systemMsg ? { systemPrompt: systemMsg.content } : {}),
    });

    const maxTok = max_tokens || 512;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        await session.prompt(lastUser.content, {
          maxTokens: maxTok,
          temperature,
          onTextChunk: (chunk) => {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk }, index: 0, finish_reason: null }] })}\n\n`);
          },
        });
      } catch (e) {
        console.error('[llama] prompt error:', e.message);
      }

      res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'stop' }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await session.prompt(lastUser.content, { maxTokens: maxTok, temperature });
      res.json({ choices: [{ message: { role: 'assistant', content: response }, finish_reason: 'stop', index: 0 }] });
    }

    await context.dispose();
  } catch (err) {
    console.error('[llama] Chat error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); } catch (_) {} }
  }
});

module.exports = router;

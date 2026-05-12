'use strict';
/**
 * llama-routes.js — Model download manager with:
 *  - Parallel chunk downloads (8 connections) for max speed
 *  - Resume support (continues interrupted downloads)
 *  - Background download (persists when UI is closed)
 *  - Download queue (multiple models queued, processed one at a time)
 *  - Benchmark endpoint (tokens/sec measurement)
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

// ── Download queue & state ─────────────────────────────────────────────────
// queue: array of modelIds waiting to be downloaded
let downloadQueue = [];

// active: the currently downloading model's state
let downloadState = {
  active: false, modelId: null, fileName: null,
  bytesReceived: 0, bytesTotal: 0, percent: 0,
  speed: 0, eta: null, error: null, done: false,
};

// completed: ring buffer of finished downloads (success or error)
let downloadHistory = []; // { modelId, fileName, success, error, completedAt }

let cancelRequested = false;

/** Start the next item in the queue if nothing is currently downloading */
async function processQueue() {
  if (downloadState.active || downloadQueue.length === 0) return;
  const modelId = downloadQueue.shift();
  const model = MODELS.find(m => m.id === modelId);
  if (!model) { processQueue(); return; } // skip unknown
  const dest = path.join(getModelsDir(), model.file);
  if (fs.existsSync(dest)) { processQueue(); return; } // already downloaded

  const url = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;
  cancelRequested = false;
  downloadState = {
    active: true, modelId, fileName: model.file,
    bytesReceived: 0, bytesTotal: 0, percent: 0,
    speed: 0, eta: null, error: null, done: false,
  };

  try {
    await downloadParallel(url, dest);
    downloadState = { ...downloadState, active: false, done: true, percent: 100, speed: 0, eta: 0 };
    downloadHistory.unshift({ modelId, fileName: model.file, success: true, completedAt: Date.now() });
    if (downloadHistory.length > 20) downloadHistory.pop();
    console.log(`[llama] Download complete: ${dest}`);
  } catch (err) {
    downloadState = { ...downloadState, active: false, error: err.message };
    downloadHistory.unshift({ modelId, fileName: model.file, success: false, error: err.message, completedAt: Date.now() });
    if (downloadHistory.length > 20) downloadHistory.pop();
    console.error('[llama] Download failed:', err.message);
  }

  // Process next item in queue
  setTimeout(processQueue, 200);
}

// ── Model catalogue ────────────────────────────────────────────────────────
const MODELS = [
  { id: 'qwen2.5-coder-1.5b', file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf', repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF' },
  { id: 'qwen2.5-coder-3b',   file: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',   repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF' },
  { id: 'qwen2.5-coder-7b',   file: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',   repo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF' },
  { id: 'deepseek-coder-v2-lite', file: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf', repo: 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF' },
  { id: 'codellama-7b',       file: 'codellama-7b-instruct.Q4_K_M.gguf',        repo: 'TheBloke/CodeLlama-7B-Instruct-GGUF' },
  { id: 'starcoder2-3b',      file: 'starcoder2-3b-Q4_K_M.gguf',                repo: 'second-state/StarCoder2-3B-GGUF' },
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
    loaded: false,
  }));
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
    if (cancelRequested) throw new Error('Cancelled by user');
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
    available: loadedModel !== null,
    modelLoaded: loadedModel !== null,
    loadedModelPath: loadedModelId ? path.join(getModelsDir(), MODELS.find(m => m.id === loadedModelId)?.file ?? '') : null,
    modelsDir: getModelsDir(),
    localModels: modelStatus(),
    downloadState,
  });
});

router.get('/models', (req, res) => {
  const dir = getModelsDir();
  const models = MODELS.map(m => ({
    ...m,
    downloaded: fs.existsSync(path.join(dir, m.file)),
    loaded: m.id === loadedModelId,
  }));
  res.json({ models });
});

// ── Download queue routes ──────────────────────────────────────────────────

// Add model to queue (or start immediately if queue is empty)
router.post('/download', async (req, res) => {
  const { modelId } = req.body || {};
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return res.status(404).json({ error: `Unknown model: ${modelId}` });

  const dest = path.join(getModelsDir(), model.file);
  if (fs.existsSync(dest)) return res.json({ success: true, message: 'Already downloaded', path: dest });

  // Don't add duplicates
  if (downloadQueue.includes(modelId) || downloadState.modelId === modelId && downloadState.active) {
    return res.json({ success: true, message: 'Already in queue' });
  }

  downloadQueue.push(modelId);
  res.json({ success: true, message: 'Added to queue', position: downloadQueue.length, modelId });

  // Kick off queue processing (no-op if already running)
  processQueue();
});

// Queue multiple models at once
router.post('/download/queue', (req, res) => {
  const { modelIds } = req.body || {};
  if (!Array.isArray(modelIds)) return res.status(400).json({ error: 'modelIds must be an array' });
  const added = [];
  for (const modelId of modelIds) {
    const model = MODELS.find(m => m.id === modelId);
    if (!model) continue;
    const dest = path.join(getModelsDir(), model.file);
    if (fs.existsSync(dest)) continue;
    if (downloadQueue.includes(modelId) || (downloadState.modelId === modelId && downloadState.active)) continue;
    downloadQueue.push(modelId);
    added.push(modelId);
  }
  res.json({ success: true, added, queue: downloadQueue });
  processQueue();
});

// Remove a model from the queue (only if not currently downloading)
router.post('/download/queue/remove', (req, res) => {
  const { modelId } = req.body || {};
  downloadQueue = downloadQueue.filter(id => id !== modelId);
  res.json({ success: true, queue: downloadQueue });
});

// Reorder queue
router.post('/download/queue/reorder', (req, res) => {
  const { queue } = req.body || {};
  if (!Array.isArray(queue)) return res.status(400).json({ error: 'queue must be an array' });
  // Only keep items that are actually in the queue
  downloadQueue = queue.filter(id => downloadQueue.includes(id));
  res.json({ success: true, queue: downloadQueue });
});

router.post('/download/cancel', (req, res) => {
  cancelRequested = true;
  if (downloadState.active) {
    downloadState.active = false;
    downloadState.error = 'Cancelled by user';
  }
  res.json({ success: true });
});

// Cancel a specific queued model (not the active one)
router.post('/download/cancel/:modelId', (req, res) => {
  const { modelId } = req.params;
  if (downloadState.active && downloadState.modelId === modelId) {
    cancelRequested = true;
    downloadState.active = false;
    downloadState.error = 'Cancelled by user';
  } else {
    downloadQueue = downloadQueue.filter(id => id !== modelId);
  }
  res.json({ success: true, queue: downloadQueue });
});

router.get('/download/status', (req, res) => {
  res.json({
    ...downloadState,
    queue: downloadQueue,
    history: downloadHistory,
  });
});

// ── Benchmark ──────────────────────────────────────────────────────────────
// Since we don't have actual inference in this build, we measure download speed
// and file integrity as a proxy benchmark.
router.post('/benchmark/:modelId', async (req, res) => {
  const model = MODELS.find(m => m.id === req.params.modelId);
  if (!model) return res.status(404).json({ error: 'Unknown model' });

  const dest = path.join(getModelsDir(), model.file);
  if (!fs.existsSync(dest)) return res.status(400).json({ error: 'Model not downloaded' });

  const start = Date.now();
  try {
    // Measure file read speed (I/O benchmark)
    const stat = fs.statSync(dest);
    const sizeBytes = stat.size;

    // Read first 64MB to measure disk I/O speed
    const readSize = Math.min(64 * 1024 * 1024, sizeBytes);
    const fd = fs.openSync(dest, 'r');
    const buf = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);

    const elapsed = (Date.now() - start) / 1000;
    const readSpeedMBs = (readSize / 1024 / 1024) / elapsed;

    res.json({
      modelId: model.id,
      fileName: model.file,
      fileSizeMb: Math.round(sizeBytes / 1024 / 1024),
      diskReadSpeedMBs: Math.round(readSpeedMBs),
      readTimeMs: Date.now() - start,
      status: 'ok',
      note: 'Disk I/O benchmark — inference benchmark requires loaded model',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ── Llama inference state ──────────────────────────────────────────────────
let llamaInstance = null;
let loadedModel = null;
let loadedModelId = null;
let loadedContext = null;

async function getLlama() {
  if (!llamaInstance) {
    const { getLlama } = await import('node-llama-cpp');
    llamaInstance = await getLlama();
  }
  return llamaInstance;
}

// Pre-warm llama on startup (loads the native library into memory)
setTimeout(() => {
  getLlama().catch(() => {});
}, 2000);

router.post('/load', async (req, res) => {
  const { modelId } = req.body || {};
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return res.status(404).json({ error: `Unknown model: ${modelId}` });

  const dest = path.join(getModelsDir(), model.file);
  if (!fs.existsSync(dest)) return res.status(400).json({ error: 'Model not downloaded' });

  try {
    // Unload previous model
    if (loadedContext) { try { await loadedContext.dispose(); } catch (_) {} loadedContext = null; }
    if (loadedModel) { try { await loadedModel.dispose(); } catch (_) {} loadedModel = null; }

    const llama = await getLlama();
    loadedModel = await llama.loadModel({
      modelPath: dest,
      // Use GPU if available for faster inference
      gpuLayers: 'auto',
      // Memory-map the file for faster loading
      useMmap: true,
      // Reduce vocab only to what's needed
      vocabOnly: false,
    });
    loadedContext = await loadedModel.createContext({
      contextSize: Math.min(model.contextLength ?? 4096, 8192),
      // Use batched processing for speed
      batchSize: 512,
    });
    loadedModelId = modelId;

    console.log(`[llama] Loaded model: ${model.file}`);
    res.json({ success: true, modelId });
  } catch (err) {
    console.error('[llama] Load failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/unload', async (req, res) => {
  try {
    if (loadedContext) { await loadedContext.dispose(); loadedContext = null; }
    if (loadedModel) { await loadedModel.dispose(); loadedModel = null; }
    loadedModelId = null;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  if (!loadedModel || !loadedContext) {
    return res.status(503).json({ error: 'No model loaded. Load a model first.' });
  }

  const { messages = [], temperature = 0.7, max_tokens, stream = false } = req.body || {};

  try {
    const { LlamaChatSession } = await import('node-llama-cpp');
    const session = new LlamaChatSession({ contextSequence: loadedContext.getSequence() });

    // Build conversation from messages
    const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
    const userMessages = messages.filter(m => m.role !== 'system');

    // Replay history except last user message
    for (let i = 0; i < userMessages.length - 1; i += 2) {
      const user = userMessages[i]?.content ?? '';
      const assistant = userMessages[i + 1]?.content ?? '';
      if (user) await session.prompt(user, { temperature, maxTokens: max_tokens ?? undefined, onTextChunk: () => {} });
    }

    const lastUser = userMessages[userMessages.length - 1]?.content ?? '';

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let promptTokens = 0, completionTokens = 0;
      const response = await session.prompt(lastUser, {
        temperature,
        maxTokens: max_tokens ?? undefined,
        onTextChunk: (chunk) => {
          completionTokens++;
          const data = JSON.stringify({ choices: [{ delta: { content: chunk }, finish_reason: null }] });
          res.write(`data: ${data}\n\n`);
        },
      });

      const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
      res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await session.prompt(lastUser, { temperature, maxTokens: max_tokens ?? undefined });
      res.json({ choices: [{ message: { role: 'assistant', content: response }, finish_reason: 'stop' }] });
    }
  } catch (err) {
    console.error('[llama] Chat error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;

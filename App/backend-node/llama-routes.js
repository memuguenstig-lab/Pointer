'use strict';
/**
 * Pointer — Embedded LLM routes (node-llama-cpp)
 * Provides a local OpenAI-compatible API without needing Ollama or LM Studio.
 *
 * Endpoints:
 *   GET  /api/llama/status          — is a model loaded?
 *   GET  /api/llama/models          — list of recommended downloadable models
 *   POST /api/llama/download        — download a model by huggingface repo+file
 *   GET  /api/llama/download/status — download progress
 *   POST /api/llama/load            — load a downloaded model into memory
 *   POST /api/llama/unload          — unload model from memory
 *   POST /api/llama/chat            — OpenAI-compatible streaming chat completions
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// ── Model storage directory ────────────────────────────────────────────────
function getModelsDir() {
  const p = process.platform;
  let base;
  if (p === 'win32') base = path.join(process.env.APPDATA || os.homedir(), 'Pointer');
  else if (p === 'darwin') base = path.join(os.homedir(), 'Library', 'Application Support', 'Pointer');
  else base = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pointer');
  const dir = path.join(base, 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── State ──────────────────────────────────────────────────────────────────
let llamaInstance = null;      // LlamaCpp instance
let loadedModel = null;        // LlamaModel
let loadedModelPath = null;    // path of currently loaded model
let chatContext = null;        // LlamaChatContext (reused per session)

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

// ── Recommended models (small, fast, good quality) ────────────────────────
const RECOMMENDED_MODELS = [
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen 2.5 Coder 1.5B (Fast, ~1GB)',
    description: 'Great for code completion and chat. Runs on most machines.',
    repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    sizeGb: 1.0,
    contextLength: 32768,
    recommended: true,
  },
  {
    id: 'qwen2.5-coder-3b',
    name: 'Qwen 2.5 Coder 3B (Balanced, ~2GB)',
    description: 'Better quality code generation, still fast.',
    repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF',
    file: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
    sizeGb: 2.0,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B (Best quality, ~4.5GB)',
    description: 'High quality code and chat. Needs 8GB+ RAM.',
    repo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    file: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    sizeGb: 4.5,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi 3.5 Mini (General, ~2.2GB)',
    description: 'Microsoft model, great for general chat and reasoning.',
    repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
    file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeGb: 2.2,
    contextLength: 128000,
    recommended: false,
  },
];

// ── Lazy-load node-llama-cpp ───────────────────────────────────────────────
async function getLlama() {
  if (llamaInstance) return llamaInstance;
  try {
    const { getLlama } = await import('node-llama-cpp');
    llamaInstance = await getLlama();
    console.log('[llama] node-llama-cpp initialized');
    return llamaInstance;
  } catch (err) {
    console.error('[llama] Failed to load node-llama-cpp:', err.message);
    throw new Error('node-llama-cpp is not available: ' + err.message);
  }
}

// ── Download helper ────────────────────────────────────────────────────────
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? https : http;

    mod.get(url, {
      headers: { 'User-Agent': 'Pointer/1.0' },
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
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

// GET /api/llama/status
router.get('/status', (req, res) => {
  const modelsDir = getModelsDir();
  const localModels = RECOMMENDED_MODELS.map(m => ({
    ...m,
    downloaded: fs.existsSync(path.join(modelsDir, m.file)),
    loaded: loadedModelPath === path.join(modelsDir, m.file),
  }));

  res.json({
    available: true,
    modelLoaded: !!loadedModel,
    loadedModelPath,
    modelsDir,
    localModels,
    downloadState,
  });
});

// GET /api/llama/models
router.get('/models', (req, res) => {
  const modelsDir = getModelsDir();
  const models = RECOMMENDED_MODELS.map(m => ({
    ...m,
    downloaded: fs.existsSync(path.join(modelsDir, m.file)),
    loaded: loadedModelPath === path.join(modelsDir, m.file),
  }));
  res.json({ models });
});

// POST /api/llama/download  { modelId }
router.post('/download', async (req, res) => {
  const { modelId } = req.body;
  const model = RECOMMENDED_MODELS.find(m => m.id === modelId);
  if (!model) return res.status(404).json({ error: 'Unknown model ID' });

  if (downloadState.active) {
    return res.status(409).json({ error: 'A download is already in progress' });
  }

  const modelsDir = getModelsDir();
  const dest = path.join(modelsDir, model.file);

  if (fs.existsSync(dest)) {
    return res.json({ success: true, message: 'Already downloaded', path: dest });
  }

  // Start download in background
  downloadState = {
    active: true,
    modelId,
    fileName: model.file,
    bytesReceived: 0,
    bytesTotal: 0,
    percent: 0,
    error: null,
    done: false,
  };

  // HuggingFace direct download URL
  const url = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;
  console.log(`[llama] Downloading ${model.name} from ${url}`);

  res.json({ success: true, message: 'Download started', modelId, url });

  // Download in background
  downloadFile(url, dest, (received, total) => {
    downloadState.bytesReceived = received;
    downloadState.bytesTotal = total;
    downloadState.percent = total > 0 ? Math.round((received / total) * 100) : 0;
  }).then(() => {
    console.log(`[llama] Download complete: ${dest}`);
    downloadState.active = false;
    downloadState.done = true;
    downloadState.percent = 100;
  }).catch(err => {
    console.error('[llama] Download failed:', err.message);
    downloadState.active = false;
    downloadState.error = err.message;
    try { fs.unlinkSync(dest); } catch (_) {}
  });
});

// GET /api/llama/download/status
router.get('/download/status', (req, res) => {
  res.json(downloadState);
});

// POST /api/llama/load  { modelId } or { modelPath }
router.post('/load', async (req, res) => {
  const { modelId, modelPath } = req.body;

  let filePath = modelPath;
  if (!filePath && modelId) {
    const model = RECOMMENDED_MODELS.find(m => m.id === modelId);
    if (!model) return res.status(404).json({ error: 'Unknown model ID' });
    filePath = path.join(getModelsDir(), model.file);
  }

  if (!filePath) return res.status(400).json({ error: 'modelId or modelPath required' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Model file not found: ${filePath}` });

  try {
    // Unload previous model
    if (loadedModel) {
      try { await loadedModel.dispose(); } catch (_) {}
      loadedModel = null;
      chatContext = null;
      loadedModelPath = null;
    }

    const llama = await getLlama();
    console.log(`[llama] Loading model: ${filePath}`);
    loadedModel = await llama.loadModel({ modelPath: filePath });
    loadedModelPath = filePath;
    chatContext = null; // reset context on new model load
    console.log('[llama] Model loaded successfully');

    res.json({ success: true, modelPath: filePath });
  } catch (err) {
    console.error('[llama] Failed to load model:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/llama/unload
router.post('/unload', async (req, res) => {
  if (loadedModel) {
    try { await loadedModel.dispose(); } catch (_) {}
    loadedModel = null;
    chatContext = null;
    loadedModelPath = null;
  }
  res.json({ success: true });
});

// POST /api/llama/chat  — OpenAI-compatible streaming chat
router.post('/chat', async (req, res) => {
  if (!loadedModel) {
    return res.status(503).json({ error: 'No model loaded. Load a model first via /api/llama/load' });
  }

  const { messages = [], temperature = 0.7, max_tokens, stream = true } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const { LlamaChatSession } = await import('node-llama-cpp');

    // Create a new context + session for each request
    const context = await loadedModel.createContext({
      contextSize: Math.min(4096, loadedModel.trainContextSize ?? 4096),
    });
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    // Build prompt from messages
    // System message first, then alternate user/assistant
    let systemPrompt = '';
    const chatMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        chatMessages.push(msg);
      }
    }

    if (systemPrompt) {
      await session.prompt(systemPrompt, { maxTokens: 1 }).catch(() => {}); // prime system
    }

    // Get the last user message
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      await context.dispose();
      return res.status(400).json({ error: 'No user message found' });
    }

    if (stream) {
      // SSE streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let tokenCount = 0;
      const maxTok = max_tokens || 2048;

      await session.prompt(lastUserMsg.content, {
        maxTokens: maxTok,
        temperature,
        onTextChunk: (chunk) => {
          tokenCount++;
          const data = JSON.stringify({
            choices: [{ delta: { content: chunk }, index: 0, finish_reason: null }]
          });
          res.write(`data: ${data}\n\n`);
        },
      });

      // Send done
      const doneData = JSON.stringify({
        choices: [{ delta: {}, index: 0, finish_reason: 'stop' }]
      });
      res.write(`data: ${doneData}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming
      const response = await session.prompt(lastUserMsg.content, {
        maxTokens: max_tokens || 2048,
        temperature,
      });

      res.json({
        choices: [{
          message: { role: 'assistant', content: response },
          finish_reason: 'stop',
          index: 0,
        }]
      });
    }

    await context.dispose();
  } catch (err) {
    console.error('[llama] Chat error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;

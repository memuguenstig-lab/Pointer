import React, { useEffect, useState, useRef } from 'react';
import llamaService, { LlamaModel, DownloadState } from '../services/LlamaService';

// ── Built-in model catalogue ───────────────────────────────────────────────
// Served as fallback when the backend stub returns no models.
// All models are Q4_K_M quantized GGUF from HuggingFace.

export interface ModelEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  repo: string;
  file: string;
  sizeGb: number;
  contextLength: number;
  recommended: boolean;
}

export const BUILTIN_MODELS: ModelEntry[] = [
  // ── Code models ────────────────────────────────────────────────────────
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    description: 'Fast code completion & chat. Runs on any machine.',
    category: 'Code',
    repo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    sizeGb: 1.0,
    contextLength: 32768,
    recommended: true,
  },
  {
    id: 'qwen2.5-coder-3b',
    name: 'Qwen 2.5 Coder 3B',
    description: 'Better code quality, still fast. Good balance.',
    category: 'Code',
    repo: 'Qwen/Qwen2.5-Coder-3B-Instruct-GGUF',
    file: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf',
    sizeGb: 2.0,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    description: 'High quality code generation. Needs 8GB+ RAM.',
    category: 'Code',
    repo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    file: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    sizeGb: 4.5,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'deepseek-coder-v2-lite',
    name: 'DeepSeek Coder V2 Lite',
    description: 'Excellent at code, math and reasoning. 16B MoE.',
    category: 'Code',
    repo: 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF',
    file: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    sizeGb: 9.0,
    contextLength: 163840,
    recommended: false,
  },
  {
    id: 'codellama-7b',
    name: 'CodeLlama 7B',
    description: 'Meta\'s code model. Great for Python, JS, C++.',
    category: 'Code',
    repo: 'TheBloke/CodeLlama-7B-Instruct-GGUF',
    file: 'codellama-7b-instruct.Q4_K_M.gguf',
    sizeGb: 4.1,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'starcoder2-3b',
    name: 'StarCoder2 3B',
    description: 'Trained on 600+ programming languages. Very fast.',
    category: 'Code',
    repo: 'bartowski/starcoder2-3b-GGUF',
    file: 'starcoder2-3b-Q4_K_M.gguf',
    sizeGb: 1.9,
    contextLength: 16384,
    recommended: false,
  },

  // ── General / Chat models ──────────────────────────────────────────────
  {
    id: 'phi-3.5-mini',
    name: 'Phi 3.5 Mini',
    description: 'Microsoft model. Great reasoning in a small package.',
    category: 'General',
    repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
    file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeGb: 2.2,
    contextLength: 128000,
    recommended: false,
  },
  {
    id: 'phi-4-mini',
    name: 'Phi 4 Mini',
    description: 'Latest Microsoft Phi. Strong at math & code.',
    category: 'General',
    repo: 'bartowski/phi-4-mini-instruct-GGUF',
    file: 'phi-4-mini-instruct-Q4_K_M.gguf',
    sizeGb: 2.5,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Meta\'s latest small model. Fast and capable.',
    category: 'General',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeGb: 2.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B',
    description: 'Meta\'s 8B model. Excellent general purpose.',
    category: 'General',
    repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    sizeGb: 4.9,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'mistral-7b-v0.3',
    name: 'Mistral 7B v0.3',
    description: 'Fast, efficient, great for chat and instruction following.',
    category: 'General',
    repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma 2 2B',
    description: 'Google\'s small but powerful model.',
    category: 'General',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    file: 'gemma-2-2b-it-Q4_K_M.gguf',
    sizeGb: 1.6,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'gemma-2-9b',
    name: 'Gemma 2 9B',
    description: 'Google\'s 9B model. Punches above its weight.',
    category: 'General',
    repo: 'bartowski/gemma-2-9b-it-GGUF',
    file: 'gemma-2-9b-it-Q4_K_M.gguf',
    sizeGb: 5.5,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    description: 'Alibaba\'s general model. Strong multilingual support.',
    category: 'General',
    repo: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
    file: 'qwen2.5-7b-instruct-q4_k_m.gguf',
    sizeGb: 4.7,
    contextLength: 131072,
    recommended: false,
  },

  // ── Reasoning models ───────────────────────────────────────────────────
  {
    id: 'deepseek-r1-1.5b',
    name: 'DeepSeek R1 1.5B',
    description: 'Reasoning model with chain-of-thought. Very fast.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    file: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    sizeGb: 1.1,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'deepseek-r1-7b',
    name: 'DeepSeek R1 7B',
    description: 'Strong reasoning, math and code. Think before answering.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF',
    file: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    sizeGb: 4.7,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'qwq-32b',
    name: 'QwQ 32B',
    description: 'Alibaba\'s reasoning model. Needs 20GB+ RAM.',
    category: 'Reasoning',
    repo: 'bartowski/QwQ-32B-GGUF',
    file: 'QwQ-32B-Q4_K_M.gguf',
    sizeGb: 19.8,
    contextLength: 131072,
    recommended: false,
  },
];

const CATEGORIES = ['All', 'Code', 'General', 'Reasoning'];

interface Props {
  onModelReady: (modelId: string) => void;
}

export const EmbeddedModelSetup: React.FC<Props> = ({ onModelReady }) => {
  const [backendModels, setBackendModels] = useState<LlamaModel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadModels();
    // Check if a download is already running in the background
    llamaService.getDownloadStatus().then(state => {
      if (state.active) {
        setDownloadState(state);
        setLoading(true);
        // Resume polling
        pollRef.current = setInterval(async () => {
          const s = await llamaService.getDownloadStatus();
          setDownloadState(s);
          if (!s.active) {
            clearInterval(pollRef.current!);
            setLoading(false);
            if (s.done && !s.error) await loadModels();
            else if (s.error) setError('Download failed: ' + s.error);
          }
        }, 500);
      }
    }).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadModels() {
    try {
      const list = await llamaService.getModels();
      setBackendModels(list);
      const loaded = list.find(m => m.loaded);
      const downloaded = list.find(m => m.downloaded);
      if (loaded) { setSelected(loaded.id); onModelReady(loaded.id); }
      else if (downloaded) setSelected(downloaded.id);
      else setSelected(BUILTIN_MODELS.find(m => m.recommended)?.id ?? BUILTIN_MODELS[0].id);
    } catch {
      // Backend stub — use builtin list, no download state
      setSelected(BUILTIN_MODELS.find(m => m.recommended)?.id ?? BUILTIN_MODELS[0].id);
    }
  }

  // Merge backend state (downloaded/loaded) into builtin list
  const models: (ModelEntry & { downloaded: boolean; loaded: boolean })[] = BUILTIN_MODELS.map(m => {
    const bm = backendModels.find(b => b.id === m.id);
    return { ...m, downloaded: bm?.downloaded ?? false, loaded: bm?.loaded ?? false };
  });

  const filtered = models.filter(m => {
    const matchCat = category === 'All' || m.category === category;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  async function handleDownload() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      await llamaService.downloadModel(selected);
      pollRef.current = setInterval(async () => {
        const state = await llamaService.getDownloadStatus();
        setDownloadState(state);
        if (!state.active) {
          clearInterval(pollRef.current!);
          setLoading(false);
          if (state.done && !state.error) await loadModels();
          else if (state.error) setError('Download failed: ' + state.error);
        }
      }, 500);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function handleLoad() {
    if (!selected) return;
    setError(null);
    setLoadingModel(true);
    try {
      await llamaService.loadModel(selected);
      await loadModels();
      onModelReady(selected);
    } catch (e: any) {
      setError('Failed to load model: ' + e.message);
    } finally {
      setLoadingModel(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatEta(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  async function handleCancel() {
    try {
      await fetch('http://127.0.0.1:23816/api/llama/download/cancel', { method: 'POST' });
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setDownloadState(null);
      await loadModels();
    } catch (e: any) {
      setError('Cancel failed: ' + e.message);
    }
  }

  async function handleDelete(modelId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this model from disk?')) return;
    setError(null);
    try {
      await llamaService.deleteModel(modelId);
      await loadModels();
    } catch (e: any) {
      setError('Delete failed: ' + e.message);
    }
  }

  const selectedModel = models.find(m => m.id === selected);
  const isDownloaded = selectedModel?.downloaded ?? false;
  const isLoaded = selectedModel?.loaded ?? false;

  const categoryColors: Record<string, string> = {
    Code: '#58a6ff',
    General: '#3fb950',
    Reasoning: '#bc8cff',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        Download and run AI models locally — no Ollama or LM Studio needed.
      </div>

      {error && (
        <div style={{
          padding: '8px 12px', background: 'rgba(248,81,73,0.1)',
          border: '1px solid rgba(248,81,73,0.3)', borderRadius: '4px',
          color: '#f85149', fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Search + Category filter */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '5px 10px', fontSize: '12px',
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: '4px', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '4px 10px', fontSize: '11px', borderRadius: '4px',
                border: `1px solid ${category === cat ? 'var(--accent-color)' : 'var(--border-color)'}`,
                background: category === cat ? 'rgba(14,99,156,0.2)' : 'transparent',
                color: category === cat ? 'var(--accent-color)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Model list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '12px', textAlign: 'center', opacity: 0.6 }}>
            No models found
          </div>
        )}
        {filtered.map(model => (
          <div
            key={model.id}
            onClick={() => setSelected(model.id)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: `1px solid ${selected === model.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: selected === model.id ? 'rgba(14,99,156,0.08)' : 'var(--bg-secondary)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              {/* Category badge */}
              <span style={{
                fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                background: `${categoryColors[model.category]}22`,
                color: categoryColors[model.category],
                border: `1px solid ${categoryColors[model.category]}44`,
                fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {model.category}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {model.name}
              </span>
              {model.recommended && (
                <span style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  background: 'rgba(14,99,156,0.2)', color: 'var(--accent-color)',
                  border: '1px solid rgba(14,99,156,0.3)', flexShrink: 0,
                }}>★ Recommended</span>
              )}
              {model.loaded && (
                <span style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  background: 'rgba(63,185,80,0.2)', color: '#3fb950',
                  border: '1px solid rgba(63,185,80,0.3)', flexShrink: 0,
                }}>● Active</span>
              )}
              {model.downloaded && !model.loaded && (
                <span style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                  background: 'rgba(63,185,80,0.1)', color: '#3fb950',
                  border: '1px solid rgba(63,185,80,0.2)', flexShrink: 0,
                }}>✓ Downloaded</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                ~{model.sizeGb} GB
              </span>
              {model.downloaded && (
                <button
                  onClick={(e) => handleDelete(model.id, e)}
                  title="Delete model from disk"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(248,81,73,0.5)', padding: '0 2px', flexShrink: 0,
                    fontSize: '13px', lineHeight: 1,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f85149'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,81,73,0.5)'; }}
                >
                  🗑
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1 }}>
                {model.description}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, flexShrink: 0 }}>
                {(model.contextLength / 1000).toFixed(0)}K ctx
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Download progress */}
      {downloadState?.active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
              {downloadState.fileName}
            </span>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              {downloadState.speed > 0 && (
                <span style={{ color: '#3fb950' }}>{formatBytes(downloadState.speed)}/s</span>
              )}
              {downloadState.eta != null && downloadState.eta > 0 && (
                <span>{formatEta(downloadState.eta)}</span>
              )}
              <span>
                {downloadState.bytesTotal > 0
                  ? `${formatBytes(downloadState.bytesReceived)} / ${formatBytes(downloadState.bytesTotal)}`
                  : formatBytes(downloadState.bytesReceived)}
              </span>
            </div>
          </div>
          <div style={{ height: '4px', background: 'var(--bg-accent)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${downloadState.percent}%`,
              background: 'linear-gradient(90deg, var(--accent-color), #3fb950)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {downloadState.percent}% — downloading in background
            </span>
            <button
              onClick={handleCancel}
              style={{
                padding: '2px 8px', fontSize: '11px',
                background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                borderRadius: '4px', color: '#f85149', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!isDownloaded && (
          <button
            onClick={handleDownload}
            disabled={loading || !selected}
            style={{
              flex: 1, padding: '7px 14px',
              background: 'var(--accent-color)', color: '#fff',
              border: 'none', borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontSize: '12px', fontWeight: 500,
            }}
          >
            {loading
              ? `Downloading… ${downloadState?.percent ?? 0}%`
              : `Download ${selectedModel?.name ?? 'Model'}`}
          </button>
        )}
        {isDownloaded && !isLoaded && (
          <button
            onClick={handleLoad}
            disabled={loadingModel}
            style={{
              flex: 1, padding: '7px 14px',
              background: 'var(--accent-color)', color: '#fff',
              border: 'none', borderRadius: '4px',
              cursor: loadingModel ? 'not-allowed' : 'pointer',
              opacity: loadingModel ? 0.7 : 1, fontSize: '12px', fontWeight: 500,
            }}
          >
            {loadingModel ? 'Loading into memory…' : `Load ${selectedModel?.name ?? 'Model'}`}
          </button>
        )}
        {isLoaded && (
          <div style={{
            flex: 1, padding: '7px 14px',
            background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
            borderRadius: '4px', color: '#3fb950', fontSize: '12px', textAlign: 'center',
          }}>
            ✓ Model active — ready to use
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedModelSetup;

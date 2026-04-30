/**
 * LlamaService — communicates with the embedded node-llama-cpp backend.
 * Provides an OpenAI-compatible interface so LMStudioService can delegate to it.
 */

const BACKEND = 'http://127.0.0.1:23816';

export interface LlamaModel {
  id: string;
  name: string;
  description: string;
  repo: string;
  file: string;
  sizeGb: number;
  contextLength: number;
  recommended: boolean;
  downloaded: boolean;
  loaded: boolean;
}

export interface LlamaStatus {
  available: boolean;
  modelLoaded: boolean;
  loadedModelPath: string | null;
  modelsDir: string;
  localModels: LlamaModel[];
  downloadState: DownloadState;
}

export interface DownloadState {
  active: boolean;
  modelId: string | null;
  fileName: string | null;
  bytesReceived: number;
  bytesTotal: number;
  percent: number;
  speed: number;       // bytes/sec
  eta: number | null;  // seconds remaining
  error: string | null;
  done: boolean;
}

class LlamaService {
  async getStatus(): Promise<LlamaStatus> {
    const res = await fetch(`${BACKEND}/api/llama/status`);
    if (!res.ok) throw new Error('Llama backend unavailable');
    return res.json();
  }

  async getModels(): Promise<LlamaModel[]> {
    try {
      const res = await fetch(`${BACKEND}/api/llama/models`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.models ?? [];
    } catch {
      return [];
    }
  }

  async downloadModel(modelId: string): Promise<void> {
    const res = await fetch(`${BACKEND}/api/llama/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Download failed';
      try { msg = JSON.parse(text).error || msg; } catch (_) { msg = text.slice(0, 200) || msg; }
      throw new Error(msg);
    }
  }

  async getDownloadStatus(): Promise<DownloadState> {
    const res = await fetch(`${BACKEND}/api/llama/download/status`);
    if (!res.ok) throw new Error('Failed to get download status');
    return res.json();
  }

  async loadModel(modelId: string): Promise<void> {
    const res = await fetch(`${BACKEND}/api/llama/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Failed to load model';
      try { msg = JSON.parse(text).error || msg; } catch (_) { msg = text.slice(0, 200) || msg; }
      throw new Error(msg);
    }
  }

  async unloadModel(): Promise<void> {
    await fetch(`${BACKEND}/api/llama/unload`, { method: 'POST' });
  }

  async deleteModel(modelId: string): Promise<void> {
    const res = await fetch(`${BACKEND}/api/llama/models/${modelId}`, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      let msg = 'Delete failed';
      try { msg = JSON.parse(text).error || msg; } catch (_) {}
      throw new Error(msg);
    }
  }

  /** Streaming chat — calls onChunk for each token, returns full response */
  async chat(
    messages: { role: string; content: string }[],
    options: { temperature?: number; max_tokens?: number; onChunk?: (token: string) => void; signal?: AbortSignal } = {}
  ): Promise<string> {
    const { temperature = 0.7, max_tokens = 512, onChunk, signal } = options;

    // Use a longer timeout for embedded inference (model needs time to generate)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout
    const combinedSignal = signal ?? controller.signal;

    try {
      const res = await fetch(`${BACKEND}/api/llama/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, temperature, max_tokens, stream: true }),
        signal: combinedSignal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
          try {
            const data = JSON.parse(line.slice(6));
            const token = data.choices?.[0]?.delta?.content || '';
            if (token) {
              full += token;
              onChunk?.(token);
            }
          } catch (_) {}
        }
      }

      return full;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Check if a model is currently loaded */
  async isModelLoaded(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.modelLoaded;
    } catch {
      return false;
    }
  }
}

export const llamaService = new LlamaService();
export default llamaService;

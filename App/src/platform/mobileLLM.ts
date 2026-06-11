/**
 * Mobile LLM adapter — runs inference directly in the browser/WebView
 * using WebLLM (WebGPU + WASM, no server needed).
 *
 * On desktop this is never used — the node-llama-cpp backend handles it.
 * On mobile/web this is the only way to run local AI.
 *
 * Usage:
 *   import { mobileLLM } from './mobileLLM';
 *   await mobileLLM.load('Llama-3.2-1B-Instruct-q4f16_1-MLC');
 *   const reply = await mobileLLM.chat(messages, { onChunk: (t) => console.log(t) });
 */

export interface MobileLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MobileLLMOptions {
  temperature?: number;
  maxTokens?: number;
  onChunk?: (token: string) => void;
  onProgress?: (progress: number, text: string) => void;
}

// WebLLM model IDs — these are quantized models that run in-browser
// See https://mlc.ai/mlc-llm/docs/prebuilt_models.html
export const MOBILE_MODELS = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B (Fast)',
    description: 'Tiny, runs on any device. ~0.8 GB VRAM.',
    sizeGb: 0.8,
    recommended: true,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    description: 'Good balance. ~2 GB VRAM.',
    sizeGb: 2.0,
    recommended: false,
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 1.5B',
    description: 'Fast code model. ~1 GB VRAM.',
    sizeGb: 1.0,
    recommended: false,
  },
  {
    id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 3B',
    description: 'Better code quality. ~2 GB VRAM.',
    sizeGb: 2.0,
    recommended: false,
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    name: 'Gemma 2 2B',
    description: 'Google model. ~1.5 GB VRAM.',
    sizeGb: 1.5,
    recommended: false,
  },
  {
    id: 'phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini',
    description: 'Microsoft model. Strong reasoning. ~2 GB VRAM.',
    sizeGb: 2.2,
    recommended: false,
  },
] as const;

export type MobileModelId = typeof MOBILE_MODELS[number]['id'];

class MobileLLMService {
  private engine: any = null;
  private loadedModelId: string | null = null;
  private loading = false;

  /** Check if WebLLM / WebGPU is supported */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /** Check if a model is currently loaded */
  isLoaded(): boolean {
    return this.engine !== null && this.loadedModelId !== null;
  }

  getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  /**
   * Load a model. Downloads and caches in IndexedDB on first run.
   * Subsequent loads are fast (from cache).
   */
  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void
  ): Promise<void> {
    if (this.loading) throw new Error('Already loading a model');
    if (this.loadedModelId === modelId) return; // already loaded

    this.loading = true;
    try {
      // Lazy-load WebLLM so it doesn't bloat the desktop bundle
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      // Unload previous model
      if (this.engine) {
        try { await this.engine.unload(); } catch (_) {}
        this.engine = null;
        this.loadedModelId = null;
      }

      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          onProgress?.(Math.round(report.progress * 100), report.text);
        },
      });

      this.loadedModelId = modelId;
    } finally {
      this.loading = false;
    }
  }

  /** Run a chat completion. Streams tokens via onChunk. */
  async chat(
    messages: MobileLLMMessage[],
    options: MobileLLMOptions = {}
  ): Promise<string> {
    if (!this.engine) throw new Error('No model loaded. Call load() first.');

    const { temperature = 0.7, maxTokens, onChunk } = options;

    if (onChunk) {
      // Streaming
      const stream = await this.engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let full = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        if (token) {
          full += token;
          onChunk(token);
        }
      }
      return full;
    } else {
      // Non-streaming
      const reply = await this.engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      });
      return reply.choices[0]?.message?.content ?? '';
    }
  }

  /** Unload the current model and free memory */
  async unload(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload(); } catch (_) {}
      this.engine = null;
      this.loadedModelId = null;
    }
  }
}

export const mobileLLM = new MobileLLMService();

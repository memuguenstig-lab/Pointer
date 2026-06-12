import React, { useEffect, useState, useRef } from 'react';
import llamaService, { LlamaModel, DownloadState, GpuInfo } from '../services/LlamaService';

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
    repo: 'second-state/StarCoder2-3B-GGUF',
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
    recommended: true,
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
    recommended: true,
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
  // ── Extra Code models ──────────────────────────────────────────────────
  {
    id: 'qwen2.5-coder-14b',
    name: 'Qwen 2.5 Coder 14B',
    description: 'Top-tier code model. Needs 10GB+ RAM.',
    category: 'Code',
    repo: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
    file: 'qwen2.5-coder-14b-instruct-q4_k_m.gguf',
    sizeGb: 8.7,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'codegemma-7b',
    name: 'CodeGemma 7B',
    description: 'Google code model. Fast and accurate.',
    category: 'Code',
    repo: 'bartowski/codegemma-7b-it-GGUF',
    file: 'codegemma-7b-it-Q4_K_M.gguf',
    sizeGb: 4.5,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'deepseek-coder-6.7b',
    name: 'DeepSeek Coder 6.7B',
    description: 'Strong at code completion and generation.',
    category: 'Code',
    repo: 'TheBloke/deepseek-coder-6.7B-instruct-GGUF',
    file: 'deepseek-coder-6.7b-instruct.Q4_K_M.gguf',
    sizeGb: 4.1,
    contextLength: 16384,
    recommended: false,
  },
  // ── Extra General models ───────────────────────────────────────────────
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    description: 'Tiny but capable. Runs on anything.',
    category: 'General',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeGb: 0.8,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: 'Meta flagship. Best quality, needs 40GB+ RAM.',
    category: 'General',
    repo: 'bartowski/Llama-3.3-70B-Instruct-GGUF',
    file: 'Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    sizeGb: 42.5,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'mistral-nemo-12b',
    name: 'Mistral Nemo 12B',
    description: 'Mistral + NVIDIA. 128K context window.',
    category: 'General',
    repo: 'bartowski/Mistral-Nemo-Instruct-2407-GGUF',
    file: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    sizeGb: 7.1,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'gemma-3-4b',
    name: 'Gemma 3 4B',
    description: 'Google latest. Great reasoning, 128K context.',
    category: 'General',
    repo: 'bartowski/gemma-3-4b-it-GGUF',
    file: 'gemma-3-4b-it-Q4_K_M.gguf',
    sizeGb: 3.3,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'gemma-3-12b',
    name: 'Gemma 3 12B',
    description: 'Google Gemma 3 12B. Strong all-rounder.',
    category: 'General',
    repo: 'bartowski/gemma-3-12b-it-GGUF',
    file: 'gemma-3-12b-it-Q4_K_M.gguf',
    sizeGb: 8.1,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'qwen2.5-14b',
    name: 'Qwen 2.5 14B',
    description: 'Alibaba 14B. Excellent multilingual and reasoning.',
    category: 'General',
    repo: 'Qwen/Qwen2.5-14B-Instruct-GGUF',
    file: 'qwen2.5-14b-instruct-q4_k_m.gguf',
    sizeGb: 8.9,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'qwen2.5-32b',
    name: 'Qwen 2.5 32B',
    description: 'Alibaba 32B. Near GPT-4 quality locally.',
    category: 'General',
    repo: 'Qwen/Qwen2.5-32B-Instruct-GGUF',
    file: 'qwen2.5-32b-instruct-q4_k_m.gguf',
    sizeGb: 19.8,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'smollm2-1.7b',
    name: 'SmolLM2 1.7B',
    description: 'HuggingFace tiny model. Extremely fast.',
    category: 'General',
    repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
    file: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sizeGb: 1.1,
    contextLength: 8192,
    recommended: false,
  },
  // ── Extra Reasoning models ─────────────────────────────────────────────
  {
    id: 'deepseek-r1-14b',
    name: 'DeepSeek R1 14B',
    description: 'Strong reasoning and math. Needs 10GB+ RAM.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF',
    file: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    sizeGb: 8.9,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 32B',
    description: 'Very strong reasoning. Needs 20GB+ RAM.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF',
    file: 'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf',
    sizeGb: 19.8,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'phi-4',
    name: 'Phi 4 14B',
    description: 'Microsoft Phi 4. Exceptional reasoning and math.',
    category: 'Reasoning',
    repo: 'bartowski/phi-4-GGUF',
    file: 'phi-4-Q4_K_M.gguf',
    sizeGb: 8.9,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    description: 'Top reasoning quality. Needs 40GB+ RAM.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF',
    file: 'DeepSeek-R1-Distill-Llama-70B-Q4_K_M.gguf',
    sizeGb: 42.5,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'deepseek-r1-8b',
    name: 'DeepSeek R1 8B',
    description: 'Llama-based R1 distill. Good reasoning, 8GB RAM.',
    category: 'Reasoning',
    repo: 'bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF',
    file: 'DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf',
    sizeGb: 5.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'phi-4-reasoning',
    name: 'Phi 4 Reasoning 14B',
    description: 'Microsoft Phi 4 fine-tuned for chain-of-thought reasoning.',
    category: 'Reasoning',
    repo: 'bartowski/Phi-4-reasoning-GGUF',
    file: 'Phi-4-reasoning-Q4_K_M.gguf',
    sizeGb: 9.0,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'qwq-32b-preview',
    name: 'QwQ 32B Preview',
    description: 'Alibaba reasoning model, strong at math & logic. 20GB+ RAM.',
    category: 'Reasoning',
    repo: 'bartowski/QwQ-32B-Preview-GGUF',
    file: 'QwQ-32B-Preview-Q4_K_M.gguf',
    sizeGb: 19.8,
    contextLength: 32768,
    recommended: false,
  },

  // ── Additional Code models ─────────────────────────────────────────────
  {
    id: 'tinyllama-1.1b-code',
    name: 'TinyLlama 1.1B',
    description: 'Ultra-tiny, runs on anything. Good for simple completions.',
    category: 'Code',
    repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    sizeGb: 0.7,
    contextLength: 2048,
    recommended: false,
  },
  {
    id: 'stable-code-3b',
    name: 'Stable Code 3B',
    description: 'Stability AI code model. Fast, great for completions.',
    category: 'Code',
    repo: 'stabilityai/stable-code-3b',
    file: 'stable-code-3b-Q4_K_M.gguf',
    sizeGb: 1.8,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'codegemma-2b',
    name: 'CodeGemma 2B',
    description: 'Google tiny code model. Extremely fast fill-in-the-middle.',
    category: 'Code',
    repo: 'bartowski/codegemma-2b-GGUF',
    file: 'codegemma-2b-Q4_K_M.gguf',
    sizeGb: 1.4,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'deepseek-coder-1.3b',
    name: 'DeepSeek Coder 1.3B',
    description: 'Tiny DeepSeek code model. Runs on any hardware.',
    category: 'Code',
    repo: 'TheBloke/deepseek-coder-1.3b-instruct-GGUF',
    file: 'deepseek-coder-1.3b-instruct.Q4_K_M.gguf',
    sizeGb: 0.8,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'deepseek-coder-5.7b-moe',
    name: 'DeepSeek Coder 5.7B MoE',
    description: 'MoE architecture — fast inference, 16B total params.',
    category: 'Code',
    repo: 'TheBloke/deepseek-coder-5.7bmoe-instruct-GGUF',
    file: 'deepseek-coder-5.7bmoe-instruct.Q4_K_M.gguf',
    sizeGb: 3.8,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'codellama-70b',
    name: 'CodeLlama 70B',
    description: 'Meta\'s largest code model. Best CodeLlama quality. 40GB+ RAM.',
    category: 'Code',
    repo: 'TheBloke/CodeLlama-70B-Instruct-GGUF',
    file: 'codellama-70b-instruct.Q4_K_M.gguf',
    sizeGb: 41.0,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'opencoder-8b',
    name: 'OpenCoder 8B',
    description: 'Fully open code model with open data. Strong at coding tasks.',
    category: 'Code',
    repo: 'bartowski/OpenCoder-8B-Instruct-GGUF',
    file: 'OpenCoder-8B-Instruct-Q4_K_M.gguf',
    sizeGb: 5.0,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'granite-3.1-8b-code',
    name: 'Granite 3.1 8B Code',
    description: 'IBM Granite code model. Enterprise-grade, Apache 2.0 license.',
    category: 'Code',
    repo: 'bartowski/granite-3.1-8b-instruct-GGUF',
    file: 'granite-3.1-8b-instruct-Q4_K_M.gguf',
    sizeGb: 5.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'granite-3.1-2b-code',
    name: 'Granite 3.1 2B Code',
    description: 'IBM Granite tiny model. Fast, Apache 2.0 license.',
    category: 'Code',
    repo: 'bartowski/granite-3.1-2b-instruct-GGUF',
    file: 'granite-3.1-2b-instruct-Q4_K_M.gguf',
    sizeGb: 1.6,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'yi-coder-9b',
    name: 'Yi Coder 9B',
    description: '01.AI code model. Strong at multi-file context understanding.',
    category: 'Code',
    repo: 'bartowski/Yi-Coder-9B-Chat-GGUF',
    file: 'Yi-Coder-9B-Chat-Q4_K_M.gguf',
    sizeGb: 5.5,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'yi-coder-1.5b',
    name: 'Yi Coder 1.5B',
    description: '01.AI tiny code model. Very fast, 128K context.',
    category: 'Code',
    repo: 'bartowski/Yi-Coder-1.5B-Chat-GGUF',
    file: 'Yi-Coder-1.5B-Chat-Q4_K_M.gguf',
    sizeGb: 1.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'nxcode-cq-7b',
    name: 'NxCode CQ 7B',
    description: 'NTQAI code model. Optimized for code quality & correctness.',
    category: 'Code',
    repo: 'bartowski/NxCode-CQ-7B-orpo-GGUF',
    file: 'NxCode-CQ-7B-orpo-Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'sqlcoder-7b',
    name: 'SQLCoder 7B',
    description: 'Defog SQL specialist. Best open model for SQL generation.',
    category: 'Code',
    repo: 'TheBloke/sqlcoder-7b-2-GGUF',
    file: 'sqlcoder-7b-2.Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 4096,
    recommended: false,
  },

  // ── Uncensored / No-filter Code models ────────────────────────────────
  {
    id: 'wizardcoder-python-7b',
    name: 'WizardCoder Python 7B',
    description: 'Evol-Instruct trained. No refusals, pure code focus.',
    category: 'Code',
    repo: 'TheBloke/WizardCoder-Python-7B-V1.0-GGUF',
    file: 'wizardcoder-python-7b-v1.0.Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'wizardcoder-python-13b',
    name: 'WizardCoder Python 13B',
    description: 'Stronger WizardCoder. No filters, great Python & JS.',
    category: 'Code',
    repo: 'TheBloke/WizardCoder-Python-13B-V1.0-GGUF',
    file: 'wizardcoder-python-13b-v1.0.Q4_K_M.gguf',
    sizeGb: 7.9,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'wizardcoder-python-34b',
    name: 'WizardCoder Python 34B',
    description: 'Best WizardCoder. Unrestricted, top code quality. 20GB+ RAM.',
    category: 'Code',
    repo: 'TheBloke/WizardCoder-Python-34B-V1.0-GGUF',
    file: 'wizardcoder-python-34b-v1.0.Q4_K_M.gguf',
    sizeGb: 20.2,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'phind-codellama-34b',
    name: 'Phind CodeLlama 34B',
    description: 'Phind fine-tune of CodeLlama. No refusals, dev-focused.',
    category: 'Code',
    repo: 'TheBloke/Phind-CodeLlama-34B-v2-GGUF',
    file: 'phind-codellama-34b-v2.Q4_K_M.gguf',
    sizeGb: 20.2,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'phind-codellama-34b-python',
    name: 'Phind CodeLlama 34B Python',
    description: 'Python-specialized Phind model. Unrestricted, high accuracy.',
    category: 'Code',
    repo: 'TheBloke/Phind-CodeLlama-34B-Python-v1-GGUF',
    file: 'phind-codellama-34b-python-v1.Q4_K_M.gguf',
    sizeGb: 20.2,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'deepseek-coder-33b',
    name: 'DeepSeek Coder 33B',
    description: 'DeepSeek\'s largest base code model. No RLHF filters. 20GB+ RAM.',
    category: 'Code',
    repo: 'TheBloke/deepseek-coder-33b-instruct-GGUF',
    file: 'deepseek-coder-33b-instruct.Q4_K_M.gguf',
    sizeGb: 19.5,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'openchat-3.5-code',
    name: 'OpenChat 3.5 7B',
    description: 'C-RLFT trained. Minimal restrictions, strong at code & chat.',
    category: 'Code',
    repo: 'TheBloke/openchat_3.5-GGUF',
    file: 'openchat_3.5.Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 8192,
    recommended: false,
  },
  {
    id: 'mistral-7b-code-uncensored',
    name: 'Mistral 7B Code Instruct',
    description: 'Mistral base fine-tuned for code. Minimal safety filters.',
    category: 'Code',
    repo: 'TheBloke/Mistral-7B-Code-16K-qlora-GGUF',
    file: 'mistral-7b-code-16k-qlora.Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 16384,
    recommended: false,
  },

  // ── Large Code models ──────────────────────────────────────────────────
  {
    id: 'qwen2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    description: 'Best open-source code model. Needs 20GB+ RAM.',
    category: 'Code',
    repo: 'Qwen/Qwen2.5-Coder-32B-Instruct-GGUF',
    file: 'qwen2.5-coder-32b-instruct-q4_k_m.gguf',
    sizeGb: 19.8,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'codellama-13b',
    name: 'CodeLlama 13B',
    description: 'Meta CodeLlama 13B. Better than 7B for complex code.',
    category: 'Code',
    repo: 'TheBloke/CodeLlama-13B-Instruct-GGUF',
    file: 'codellama-13b-instruct.Q4_K_M.gguf',
    sizeGb: 7.9,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'codellama-34b',
    name: 'CodeLlama 34B',
    description: 'Meta CodeLlama 34B. Top-tier code generation. 20GB+ RAM.',
    category: 'Code',
    repo: 'TheBloke/CodeLlama-34B-Instruct-GGUF',
    file: 'codellama-34b-instruct.Q4_K_M.gguf',
    sizeGb: 20.2,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'deepseek-coder-v2-236b',
    name: 'DeepSeek Coder V2 236B',
    description: 'Flagship code model. Needs 130GB+ RAM (server-grade).',
    category: 'Code',
    repo: 'bartowski/DeepSeek-Coder-V2-Instruct-GGUF',
    file: 'DeepSeek-Coder-V2-Instruct-Q4_K_M.gguf',
    sizeGb: 133.0,
    contextLength: 163840,
    recommended: false,
  },
  {
    id: 'starcoder2-7b',
    name: 'StarCoder2 7B',
    description: 'BigCode 7B model. Strong at code completion.',
    category: 'Code',
    repo: 'second-state/StarCoder2-7B-GGUF',
    file: 'starcoder2-7b-Q4_K_M.gguf',
    sizeGb: 4.4,
    contextLength: 16384,
    recommended: false,
  },
  {
    id: 'starcoder2-15b',
    name: 'StarCoder2 15B',
    description: 'BigCode flagship. Best StarCoder quality. 10GB+ RAM.',
    category: 'Code',
    repo: 'bartowski/starcoder2-15b-instruct-v0.1-GGUF',
    file: 'starcoder2-15b-instruct-v0.1-Q4_K_M.gguf',
    sizeGb: 9.9,
    contextLength: 16384,
    recommended: false,
  },

  // ── Large General models ───────────────────────────────────────────────
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    description: 'Meta 70B. Near GPT-4 quality. Needs 40GB+ RAM.',
    category: 'General',
    repo: 'bartowski/Meta-Llama-3.1-70B-Instruct-GGUF',
    file: 'Meta-Llama-3.1-70B-Instruct-Q4_K_M.gguf',
    sizeGb: 42.5,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    description: 'Meta flagship. Best open model. Needs 230GB+ RAM.',
    category: 'General',
    repo: 'bartowski/Meta-Llama-3.1-405B-Instruct-GGUF',
    file: 'Meta-Llama-3.1-405B-Instruct-Q4_K_M.gguf',
    sizeGb: 243.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'gemma-3-27b',
    name: 'Gemma 3 27B',
    description: 'Google Gemma 3 27B. Excellent all-rounder. 16GB+ RAM.',
    category: 'General',
    repo: 'bartowski/gemma-3-27b-it-GGUF',
    file: 'gemma-3-27b-it-Q4_K_M.gguf',
    sizeGb: 17.2,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'mistral-small-22b',
    name: 'Mistral Small 22B',
    description: 'Mistral\'s efficient 22B. Great instruction following.',
    category: 'General',
    repo: 'bartowski/Mistral-Small-Instruct-2409-GGUF',
    file: 'Mistral-Small-Instruct-2409-Q4_K_M.gguf',
    sizeGb: 13.5,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'mistral-large-123b',
    name: 'Mistral Large 123B',
    description: 'Mistral flagship. Top-tier quality. Needs 70GB+ RAM.',
    category: 'General',
    repo: 'bartowski/Mistral-Large-Instruct-2407-GGUF',
    file: 'Mistral-Large-Instruct-2407-Q4_K_M.gguf',
    sizeGb: 74.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'qwen2.5-72b',
    name: 'Qwen 2.5 72B',
    description: 'Alibaba 72B. Exceptional multilingual & reasoning. 40GB+ RAM.',
    category: 'General',
    repo: 'Qwen/Qwen2.5-72B-Instruct-GGUF',
    file: 'qwen2.5-72b-instruct-q4_k_m.gguf',
    sizeGb: 43.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'command-r-35b',
    name: 'Command R 35B',
    description: 'Cohere\'s RAG-optimized model. Great for long documents.',
    category: 'General',
    repo: 'bartowski/c4ai-command-r-v01-GGUF',
    file: 'c4ai-command-r-v01-Q4_K_M.gguf',
    sizeGb: 21.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'command-r-plus-104b',
    name: 'Command R+ 104B',
    description: 'Cohere flagship. Best RAG & tool use. Needs 60GB+ RAM.',
    category: 'General',
    repo: 'bartowski/c4ai-command-r-plus-GGUF',
    file: 'c4ai-command-r-plus-Q4_K_M.gguf',
    sizeGb: 62.0,
    contextLength: 131072,
    recommended: false,
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    description: 'Mistral MoE. Fast and smart. Needs 26GB+ RAM.',
    category: 'General',
    repo: 'TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF',
    file: 'mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf',
    sizeGb: 26.4,
    contextLength: 32768,
    recommended: false,
  },
  {
    id: 'mixtral-8x22b',
    name: 'Mixtral 8x22B',
    description: 'Mistral large MoE. Near GPT-4 quality. Needs 80GB+ RAM.',
    category: 'General',
    repo: 'bartowski/Mixtral-8x22B-Instruct-v0.1-GGUF',
    file: 'Mixtral-8x22B-Instruct-v0.1-Q4_K_M.gguf',
    sizeGb: 79.0,
    contextLength: 65536,
    recommended: false,
  },
];

const CATEGORIES = ['All', 'Code', 'General', 'Reasoning'];

type SortKey = 'default' | 'name' | 'size-asc' | 'size-desc' | 'context-desc' | 'context-asc';
type SizeFilter = 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'huge';

const SIZE_FILTERS: { key: SizeFilter; label: string; desc: string }[] = [
  { key: 'all',    label: 'All sizes',  desc: '' },
  { key: 'tiny',   label: '< 2 GB',     desc: 'Runs on anything' },
  { key: 'small',  label: '2–6 GB',     desc: '8 GB RAM' },
  { key: 'medium', label: '6–12 GB',    desc: '16 GB RAM' },
  { key: 'large',  label: '12–30 GB',   desc: '32 GB RAM' },
  { key: 'huge',   label: '> 30 GB',    desc: 'Server / 40GB+ RAM' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default',      label: 'Default' },
  { key: 'name',         label: 'Name A–Z' },
  { key: 'size-asc',     label: 'Size ↑' },
  { key: 'size-desc',    label: 'Size ↓' },
  { key: 'context-desc', label: 'Context ↓' },
  { key: 'context-asc',  label: 'Context ↑' },
];

/**
 * Given GPU/RAM info, pick the best recommended model per category.
 * Targets the middle of the affordable range — not the largest, not the smallest.
 */
function getRecommendedIds(gpu: GpuInfo | null): Record<string, string> {
  // Determine effective budget in MB
  let budgetMb = 4096; // safe default
  if (gpu) {
    const maxVram = Math.max(0, ...gpu.gpus.map(g => g.vramMb));
    if (maxVram > 0) {
      budgetMb = Math.floor(maxVram * 0.8);
    } else {
      budgetMb = Math.floor(gpu.freeRamMb * 0.75);
    }
  }

  const budgetGb = budgetMb / 1024;

  const categories = ['Code', 'General', 'Reasoning'];
  const result: Record<string, string> = {};

  for (const cat of categories) {
    const fits = BUILTIN_MODELS
      .filter(m => m.category === cat && m.sizeGb <= budgetGb)
      .sort((a, b) => a.sizeGb - b.sizeGb); // smallest → largest

    if (fits.length === 0) {
      // Nothing fits — pick the smallest
      const smallest = BUILTIN_MODELS
        .filter(m => m.category === cat)
        .sort((a, b) => a.sizeGb - b.sizeGb)[0];
      if (smallest) result[cat] = smallest.id;
    } else if (fits.length <= 2) {
      // Only 1–2 options — pick the larger one
      result[cat] = fits[fits.length - 1].id;
    } else {
      // Pick the model at ~40th percentile of the affordable range
      // This lands in the comfortable middle — fast enough, capable enough
      const idx = Math.floor(fits.length * 0.4);
      result[cat] = fits[idx].id;
    }
  }

  return result;
}

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
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showDownloadedOnly, setShowDownloadedOnly] = useState(false);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<{ modelId: string; diskReadSpeedMBs: number; fileSizeMb: number; readTimeMs: number; note: string } | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadModels();
    // Fetch GPU info for smart recommendations
    llamaService.getGpuInfo().then(setGpuInfo).catch(() => {});
    // Check if a download is already running in the background
    llamaService.getDownloadStatus().then(state => {
      if (state.active) {
        setDownloadState(state);
        setDownloadQueue(state.queue ?? []);
        setLoading(true);
        startPolling();
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

  // Compute dynamic recommended IDs based on GPU/RAM
  const recommendedIds = getRecommendedIds(gpuInfo);

  // Merge backend state (downloaded/loaded) into builtin list
  const models: (ModelEntry & { downloaded: boolean; loaded: boolean; recommended: boolean })[] = BUILTIN_MODELS.map(m => {
    const bm = backendModels.find(b => b.id === m.id);
    const isRecommended = Object.values(recommendedIds).includes(m.id);
    return { ...m, recommended: isRecommended, downloaded: bm?.downloaded ?? false, loaded: bm?.loaded ?? false };
  });

  const filtered = models.filter(m => {
    const matchCat = category === 'All' || m.category === category;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    const matchSize = (() => {
      switch (sizeFilter) {
        case 'tiny':   return m.sizeGb < 2;
        case 'small':  return m.sizeGb >= 2 && m.sizeGb < 6;
        case 'medium': return m.sizeGb >= 6 && m.sizeGb < 12;
        case 'large':  return m.sizeGb >= 12 && m.sizeGb <= 30;
        case 'huge':   return m.sizeGb > 30;
        default:       return true;
      }
    })();
    const matchDownloaded = !showDownloadedOnly || m.downloaded;
    const matchRecommended = !showRecommendedOnly || m.recommended;
    return matchCat && matchSearch && matchSize && matchDownloaded && matchRecommended;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'name':         return a.name.localeCompare(b.name);
      case 'size-asc':     return a.sizeGb - b.sizeGb;
      case 'size-desc':    return b.sizeGb - a.sizeGb;
      case 'context-desc': return b.contextLength - a.contextLength;
      case 'context-asc':  return a.contextLength - b.contextLength;
      default:             return 0;
    }
  });

  async function handleDownload() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      await llamaService.downloadModel(selected);
      startPolling();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function handleQueueDownload() {
    if (!selected) return;
    setError(null);
    try {
      await llamaService.downloadModel(selected);
      const state = await llamaService.getDownloadStatus();
      setDownloadQueue(state.queue ?? []);
      if (state.active) { setLoading(true); startPolling(); }
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const state = await llamaService.getDownloadStatus();
      setDownloadState(state);
      setDownloadQueue(state.queue ?? []);
      if (!state.active) {
        clearInterval(pollRef.current!);
        setLoading(false);
        if (state.done && !state.error) await loadModels();
        else if (state.error) setError('Download failed: ' + state.error);
        // Start polling again if queue still has items
        if ((state.queue ?? []).length > 0) {
          setTimeout(() => { setLoading(true); startPolling(); }, 500);
        }
      }
    }, 500);
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
      await llamaService.cancelDownload();
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      setDownloadState(null);
      setDownloadQueue([]);
      await loadModels();
    } catch (e: any) {
      setError('Cancel failed: ' + e.message);
    }
  }

  async function handleCancelQueued(modelId: string) {
    try {
      await llamaService.removeFromQueue(modelId);
      const state = await llamaService.getDownloadStatus();
      setDownloadQueue(state.queue ?? []);
    } catch (e: any) {
      setError('Cancel failed: ' + e.message);
    }
  }

  async function handleBenchmark(modelId: string) {
    setBenchmarkLoading(true);
    setBenchmarkResult(null);
    setShowBenchmark(true);
    try {
      const result = await llamaService.benchmarkModel(modelId);
      setBenchmarkResult({ modelId, ...result });
    } catch (e: any) {
      setBenchmarkResult({ modelId, diskReadSpeedMBs: 0, fileSizeMb: 0, readTimeMs: 0, note: 'Benchmark failed: ' + e.message });
    } finally {
      setBenchmarkLoading(false);
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

      {/* GPU info banner */}
      {gpuInfo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 10px', borderRadius: '5px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          fontSize: '11px', color: 'var(--text-secondary)',
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}>
            <path d="M4 0h1v1h6V0h1v1h1a1 1 0 0 1 1 1v1h1v1h-1v2h1v1h-1v2h1v1h-1v1a1 1 0 0 1-1 1h-1v1h-1v-1H5v1H4v-1H3a1 1 0 0 1-1-1v-1H1v-1h1V8H1V7h1V5H1V4h1V3a1 1 0 0 1 1-1h1V0zm8 3H4a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9A.5.5 0 0 0 12 3zM6 5h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
          </svg>
          {gpuInfo.gpus.length > 0 ? (
            <span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {gpuInfo.gpus[0].name}
              </span>
              {gpuInfo.gpus[0].vramMb > 0 && (
                <span> · {(gpuInfo.gpus[0].vramMb / 1024).toFixed(1)} GB VRAM</span>
              )}
              <span> · {(gpuInfo.totalRamMb / 1024).toFixed(0)} GB RAM</span>
            </span>
          ) : (
            <span>
              CPU only · {(gpuInfo.totalRamMb / 1024).toFixed(0)} GB RAM
              <span style={{ opacity: 0.6 }}> ({(gpuInfo.freeRamMb / 1024).toFixed(1)} GB free)</span>
            </span>
          )}
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>★ = recommended for your system</span>
        </div>
      )}

      {/* Search + Category + Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Row 1: Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }}
            width="12" height="12" viewBox="0 0 16 16" fill="var(--text-primary)">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
          </svg>
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px 6px 28px', fontSize: '12px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '6px', color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>

        {/* Row 2: Categories left, Filter button right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '4px 10px', fontSize: '11px', borderRadius: '5px',
                  border: `1px solid ${category === cat ? 'var(--accent-color)' : 'var(--border-color)'}`,
                  background: category === cat ? 'rgba(14,99,156,0.15)' : 'transparent',
                  color: category === cat ? 'var(--accent-color)' : 'var(--text-secondary)',
                  cursor: 'shadowide', transition: 'all 0.15s', fontWeight: category === cat ? 600 : 400,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Result count */}
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.5, marginRight: '6px' }}>
            {filtered.length} model{filtered.length !== 1 ? 's' : ''}
          </span>

          {/* Filter button */}
          {(() => {
            const hasActive = sizeFilter !== 'all' || showDownloadedOnly || showRecommendedOnly || sortKey !== 'default';
            return (
              <button
                onClick={() => setShowFilterPanel(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', fontSize: '11px', borderRadius: '5px', whiteSpace: 'nowrap',
                  border: `1px solid ${hasActive || showFilterPanel ? 'var(--accent-color)' : 'var(--border-color)'}`,
                  background: hasActive || showFilterPanel ? 'rgba(14,99,156,0.15)' : 'transparent',
                  color: hasActive || showFilterPanel ? 'var(--accent-color)' : 'var(--text-secondary)',
                  cursor: 'shadowide', transition: 'all 0.15s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                </svg>
                Filter
                {hasActive && (
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: 'var(--accent-color)', display: 'inline-block',
                  }} />
                )}
              </button>
            );
          })()}
        </div>

        {/* Filter panel — slides in below when open */}
        {showFilterPanel && (() => {
          const hasActive = sizeFilter !== 'all' || showDownloadedOnly || showRecommendedOnly || sortKey !== 'default';
          return (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '10px',
              padding: '12px', borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}>
              {/* Size */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Size</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {SIZE_FILTERS.map(sf => (
                    <button
                      key={sf.key}
                      onClick={() => setSizeFilter(sf.key)}
                      title={sf.desc}
                      style={{
                        padding: '3px 9px', fontSize: '11px', borderRadius: '4px',
                        border: `1px solid ${sizeFilter === sf.key ? '#bc8cff' : 'var(--border-color)'}`,
                        background: sizeFilter === sf.key ? 'rgba(188,140,255,0.15)' : 'transparent',
                        color: sizeFilter === sf.key ? '#bc8cff' : 'var(--text-secondary)',
                        cursor: 'shadowide', transition: 'all 0.12s',
                      }}
                    >
                      {sf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort by</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      onClick={() => setSortKey(o.key)}
                      style={{
                        padding: '3px 9px', fontSize: '11px', borderRadius: '4px',
                        border: `1px solid ${sortKey === o.key ? 'var(--accent-color)' : 'var(--border-color)'}`,
                        background: sortKey === o.key ? 'rgba(14,99,156,0.15)' : 'transparent',
                        color: sortKey === o.key ? 'var(--accent-color)' : 'var(--text-secondary)',
                        cursor: 'shadowide', transition: 'all 0.12s',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles + Reset */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowDownloadedOnly(v => !v)}
                  style={{
                    padding: '3px 9px', fontSize: '11px', borderRadius: '4px',
                    border: `1px solid ${showDownloadedOnly ? '#3fb950' : 'var(--border-color)'}`,
                    background: showDownloadedOnly ? 'rgba(63,185,80,0.15)' : 'transparent',
                    color: showDownloadedOnly ? '#3fb950' : 'var(--text-secondary)',
                    cursor: 'shadowide', transition: 'all 0.12s',
                  }}
                >
                  ✓ Downloaded only
                </button>
                <button
                  onClick={() => setShowRecommendedOnly(v => !v)}
                  style={{
                    padding: '3px 9px', fontSize: '11px', borderRadius: '4px',
                    border: `1px solid ${showRecommendedOnly ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: showRecommendedOnly ? 'rgba(14,99,156,0.15)' : 'transparent',
                    color: showRecommendedOnly ? 'var(--accent-color)' : 'var(--text-secondary)',
                    cursor: 'shadowide', transition: 'all 0.12s',
                  }}
                >
                  ★ Recommended only
                </button>
                {hasActive && (
                  <button
                    onClick={() => { setSizeFilter('all'); setShowDownloadedOnly(false); setShowRecommendedOnly(false); setSortKey('default'); }}
                    style={{
                      marginLeft: 'auto', padding: '3px 9px', fontSize: '11px', borderRadius: '4px',
                      border: '1px solid var(--border-color)', background: 'transparent',
                      color: 'var(--text-secondary)', cursor: 'shadowide', opacity: 0.7,
                    }}
                  >
                    ✕ Reset filters
                  </button>
                )}
              </div>
            </div>
          );
        })()}
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
              cursor: 'shadowide', transition: 'all 0.12s',
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
                    background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                    borderRadius: '4px', cursor: 'shadowide',
                    color: '#f85149', padding: '2px 6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,81,73,0.22)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,81,73,0.1)'; }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15z"/>
                  </svg>
                  Delete
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
                borderRadius: '4px', color: '#f85149', cursor: 'shadowide',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Download queue */}
      {downloadQueue.length > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: '5px',
          border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Queue ({downloadQueue.length})
          </span>
          {downloadQueue.map((qid, i) => {
            const qm = models.find(m => m.id === qid);
            return (
              <div key={qid} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ opacity: 0.4, width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{qm?.name ?? qid}</span>
                <span style={{ opacity: 0.5 }}>{qm?.sizeGb} GB</span>
                <button
                  onClick={() => handleCancelQueued(qid)}
                  style={{
                    background: 'none', border: 'none', cursor: 'shadowide',
                    color: '#f85149', fontSize: '12px', padding: '0 2px', lineHeight: 1,
                  }}
                  title="Remove from queue"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!isDownloaded && (
          <>
            <button
              onClick={handleDownload}
              disabled={loading || !selected}
              style={{
                flex: 1, padding: '7px 14px',
                background: 'var(--accent-color)', color: '#fff',
                border: 'none', borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'shadowide',
                opacity: loading ? 0.7 : 1, fontSize: '12px', fontWeight: 500,
              }}
            >
              {loading && downloadState?.modelId === selected
                ? `Downloading… ${downloadState?.percent ?? 0}%`
                : `Download ${selectedModel?.name ?? 'Model'}`}
            </button>
            {/* Queue button — add to queue without starting immediately */}
            {(loading || downloadQueue.length > 0) && (
              <button
                onClick={handleQueueDownload}
                disabled={!selected || downloadQueue.includes(selected ?? '')}
                title="Add to download queue"
                style={{
                  padding: '7px 10px', fontSize: '12px', borderRadius: '4px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)', cursor: 'shadowide',
                }}
              >
                + Queue
              </button>
            )}
          </>
        )}
        {isDownloaded && !isLoaded && (
          <>
            <button
              onClick={handleLoad}
              disabled={loadingModel}
              style={{
                flex: 1, padding: '7px 14px',
                background: 'var(--accent-color)', color: '#fff',
                border: 'none', borderRadius: '4px',
                cursor: loadingModel ? 'not-allowed' : 'shadowide',
                opacity: loadingModel ? 0.7 : 1, fontSize: '12px', fontWeight: 500,
              }}
            >
              {loadingModel ? 'Loading into memory…' : `Load ${selectedModel?.name ?? 'Model'}`}
            </button>
            <button
              onClick={() => handleBenchmark(selected!)}
              disabled={benchmarkLoading}
              title="Run benchmark"
              style={{
                padding: '7px 10px', fontSize: '12px', borderRadius: '4px',
                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)', cursor: 'shadowide',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
              </svg>
              Test
            </button>
          </>
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
        {isLoaded && (
          <button
            onClick={() => handleBenchmark(selected!)}
            disabled={benchmarkLoading}
            title="Run benchmark"
            style={{
              padding: '7px 10px', fontSize: '12px', borderRadius: '4px',
              border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)', cursor: 'shadowide',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
            </svg>
            Test
          </button>
        )}
      </div>

      {/* Benchmark popup — slides in from right */}
      {showBenchmark && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px',
          background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Model Benchmark
            </span>
            <button
              onClick={() => setShowBenchmark(false)}
              style={{ background: 'none', border: 'none', cursor: 'shadowide', color: 'var(--text-secondary)', fontSize: '16px' }}
            >✕</button>
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {benchmarkLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '40px' }}>
                <div style={{ fontSize: '24px', animation: 'spin 1s linear infinite' }}>⚙</div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Running benchmark…</span>
              </div>
            ) : benchmarkResult ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {models.find(m => m.id === benchmarkResult.modelId)?.name ?? benchmarkResult.modelId}
                </div>

                {/* Disk speed */}
                <div style={{
                  padding: '12px', borderRadius: '6px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disk Read Speed</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {benchmarkResult.diskReadSpeedMBs} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>MB/s</span>
                  </div>
                  <div style={{ marginTop: '8px', height: '4px', background: 'var(--bg-accent)', borderRadius: '2px' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${Math.min(100, (benchmarkResult.diskReadSpeedMBs / 3000) * 100)}%`,
                      background: benchmarkResult.diskReadSpeedMBs > 1000 ? '#3fb950' : benchmarkResult.diskReadSpeedMBs > 400 ? 'var(--accent-color)' : '#f0883e',
                    }} />
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', opacity: 0.6 }}>
                    {benchmarkResult.diskReadSpeedMBs > 1000 ? '🟢 Fast SSD' : benchmarkResult.diskReadSpeedMBs > 400 ? '🟡 Good' : '🔴 Slow — may affect load time'}
                  </div>
                </div>

                {/* File info */}
                <div style={{
                  padding: '12px', borderRadius: '6px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '2px' }}>File Size</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{benchmarkResult.fileSizeMb} MB</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '2px' }}>Read Time</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{benchmarkResult.readTimeMs} ms</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6, lineHeight: 1.5 }}>
                  {benchmarkResult.note}
                </div>

                <button
                  onClick={() => handleBenchmark(benchmarkResult.modelId)}
                  style={{
                    padding: '7px 14px', fontSize: '12px', borderRadius: '4px',
                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)', cursor: 'shadowide', marginTop: 'auto',
                  }}
                >
                  ↻ Run again
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbeddedModelSetup;

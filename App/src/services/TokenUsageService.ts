/**
 * TokenUsageService — tracks token usage per message/session.
 * Captures usage data from OpenAI-compatible API responses.
 * Also calculates estimated costs based on current pricing.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  timestamp: number;
}

// Pricing per 1M tokens (input / output) in USD — updated May 2025
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o':                    { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':               { input: 10.00, output: 30.00 },
  'gpt-4':                     { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':             { input: 0.50,  output: 1.50  },
  'o1':                        { input: 15.00, output: 60.00 },
  'o1-mini':                   { input: 1.10,  output: 4.40  },
  'o3-mini':                   { input: 1.10,  output: 4.40  },
  // Anthropic
  'claude-opus-4-5':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00  },
  'claude-3-7-sonnet-20250219':{ input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20241022':{ input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80,  output: 4.00  },
  'claude-3-opus-20240229':    { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229':  { input: 3.00,  output: 15.00 },
  'claude-3-haiku-20240307':   { input: 0.25,  output: 1.25  },
  // xAI Grok
  'grok-3':                    { input: 3.00,  output: 15.00 },
  'grok-3-fast':               { input: 5.00,  output: 25.00 },
  'grok-3-mini':               { input: 0.30,  output: 0.50  },
  'grok-3-mini-fast':          { input: 0.60,  output: 4.00  },
  'grok-2-1212':               { input: 2.00,  output: 10.00 },
};

function getPricing(model?: string): { input: number; output: number } | null {
  if (!model) return null;
  // Exact match
  if (PRICING[model]) return PRICING[model];
  // Prefix match (e.g. "gpt-4o-2024-11-20" → "gpt-4o")
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key];
  }
  return null;
}

export function calculateCost(usage: TokenUsage): number | null {
  const pricing = getPricing(usage.model);
  if (!pricing) return null;
  return (usage.promptTokens * pricing.input + usage.completionTokens * pricing.output) / 1_000_000;
}

export function getPricingTable() { return PRICING; }

type UsageListener = (usage: TokenUsage) => void;

class TokenUsageServiceClass {
  private listeners: UsageListener[] = [];
  private sessionUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, timestamp: Date.now() };
  private lastMessageUsage: TokenUsage | null = null;
  private sessionCost = 0;
  private history: { usage: TokenUsage; cost: number | null; ts: number }[] = [];

  subscribe(listener: UsageListener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  emit(usage: TokenUsage) {
    this.lastMessageUsage = usage;
    this.sessionUsage.promptTokens += usage.promptTokens;
    this.sessionUsage.completionTokens += usage.completionTokens;
    this.sessionUsage.totalTokens += usage.totalTokens;
    const cost = calculateCost(usage);
    if (cost !== null) this.sessionCost += cost;
    this.history.push({ usage, cost, ts: Date.now() });
    if (this.history.length > 200) this.history.shift();
    this.listeners.forEach(l => l(usage));
  }

  getLastMessageUsage() { return this.lastMessageUsage; }
  getSessionUsage() { return { ...this.sessionUsage }; }
  getSessionCost() { return this.sessionCost; }
  getHistory() { return [...this.history]; }

  resetSession() {
    this.sessionUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, timestamp: Date.now() };
    this.lastMessageUsage = null;
    this.sessionCost = 0;
    this.history = [];
  }
}

export const TokenUsageService = new TokenUsageServiceClass();
export default TokenUsageService;

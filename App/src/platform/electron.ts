/**
 * Electron platform adapter.
 * All calls go through window.electron (preload) or the backend at localhost:23816.
 */

import type {
  PlatformAPI, PlatformFS, PlatformWindow, PlatformShell,
  PlatformNetwork, PlatformStorage, PlatformInfo,
  FileDialogOptions, FileDialogResult,
} from './types';

const API = 'http://127.0.0.1:23816';
const WS  = 'ws://127.0.0.1:23816';
const el  = () => (window as any).electron;

// ── File System ────────────────────────────────────────────────────────────

class ElectronFS implements PlatformFS {
  async readFile(path: string): Promise<string> {
    const res = await fetch(`${API}/read-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(`readFile failed: ${res.statusText}`);
    return res.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const res = await fetch(`${API}/save-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`writeFile failed: ${res.statusText}`);
  }

  async deleteItem(path: string): Promise<void> {
    const res = await fetch(`${API}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(`deleteItem failed: ${res.statusText}`);
  }

  async renameItem(path: string, newName: string): Promise<string> {
    const res = await fetch(`${API}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, new_name: newName }),
    });
    if (!res.ok) throw new Error(`renameItem failed: ${res.statusText}`);
    const data = await res.json();
    return data.new_path ?? path;
  }

  async listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory'; path: string }[]> {
    const res = await fetch(`${API}/files?currentDir=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`listDirectory failed: ${res.statusText}`);
    const data = await res.json();
    return (data as any[]).map(f => ({
      name: f.path.split('/').pop() ?? f.path,
      type: f.type as 'file' | 'directory',
      path: f.path,
    }));
  }

  async showOpenDialog(options: FileDialogOptions): Promise<FileDialogResult> {
    const e = el();
    if (e?.showOpenDialog) {
      return e.showOpenDialog(options);
    }
    return { canceled: true, filePaths: [] };
  }

  async openInExplorer(path: string): Promise<void> {
    const e = el();
    if (e?.openInExplorer) await e.openInExplorer(path);
  }
}

// ── Window ─────────────────────────────────────────────────────────────────

class ElectronWindow implements PlatformWindow {
  minimize()              { el()?.window?.minimize(); }
  maximize()              { el()?.window?.maximize(); }
  close(force = false)    { force ? el()?.window?.forceClose?.() : el()?.window?.close(); }
  newWindow()             { el()?.window?.newWindow?.(); }
  async isMaximized()     { return el()?.window?.isMaximized?.() ?? false; }
  hasNativeControls()     { return true; }
}

// ── Shell ──────────────────────────────────────────────────────────────────

class ElectronShell implements PlatformShell {
  isSupported() { return true; }

  async exec(command: string, cwd?: string) {
    const res = await fetch(`${API}/execute-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd, timeout: 30 }),
    });
    if (!res.ok) throw new Error(`exec failed: ${res.statusText}`);
    const data = await res.json();
    return {
      stdout: data.output ?? '',
      stderr: data.error ?? '',
      exitCode: data.exitCode ?? 0,
    };
  }
}

// ── Network ────────────────────────────────────────────────────────────────

class ElectronNetwork implements PlatformNetwork {
  getApiUrl() { return API; }
  getWsUrl()  { return WS; }
  async openExternal(url: string) {
    const e = el();
    if (e?.openExternal) await e.openExternal(url);
    else window.open(url, '_blank');
  }
}

// ── Storage ────────────────────────────────────────────────────────────────

class ElectronStorage implements PlatformStorage {
  async get(key: string)              { return localStorage.getItem(key); }
  async set(key: string, value: string) { localStorage.setItem(key, value); }
  async remove(key: string)           { localStorage.removeItem(key); }
}

// ── Info ───────────────────────────────────────────────────────────────────

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Mac'))     return 'macos';
  if (ua.includes('Linux'))   return 'linux';
  return 'unknown';
}

// ── Assemble ───────────────────────────────────────────────────────────────

export class ElectronPlatform implements PlatformAPI {
  fs      = new ElectronFS();
  window  = new ElectronWindow();
  shell   = new ElectronShell();
  network = new ElectronNetwork();
  storage = new ElectronStorage();
  info: PlatformInfo = {
    type: 'electron',
    isMobile: false,
    isDesktop: true,
    os: detectOS(),
  };
}

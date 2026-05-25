/**
 * Web platform adapter — browser without Electron or Capacitor.
 * Used for development in a plain browser or as a PWA.
 * Most features degrade gracefully.
 */

import type {
  PlatformAPI, PlatformFS, PlatformWindow, PlatformShell,
  PlatformNetwork, PlatformStorage, PlatformInfo,
  FileDialogOptions, FileDialogResult,
} from './types';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:23816';
const WS  = (import.meta as any).env?.VITE_WS_URL  ?? 'ws://localhost:23816';

class WebFS implements PlatformFS {
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
    await fetch(`${API}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  }
  async renameItem(path: string, newName: string): Promise<string> {
    const res = await fetch(`${API}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, new_name: newName }),
    });
    const data = await res.json();
    return data.new_path ?? path;
  }
  async listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory'; path: string }[]> {
    const res = await fetch(`${API}/files?currentDir=${encodeURIComponent(path)}`);
    const data = await res.json();
    return (data as any[]).map(f => ({
      name: f.path.split('/').pop() ?? f.path,
      type: f.type as 'file' | 'directory',
      path: f.path,
    }));
  }
  async showOpenDialog(_options: FileDialogOptions): Promise<FileDialogResult> {
    // Use File System Access API if available
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({ multiple: false });
        const file = await handles[0].getFile();
        return { canceled: false, filePaths: [file.name] };
      } catch { return { canceled: true, filePaths: [] }; }
    }
    return { canceled: true, filePaths: [] };
  }
  async openInExplorer(_path: string): Promise<void> {
    console.warn('openInExplorer not available in browser');
  }
}

class WebWindow implements PlatformWindow {
  minimize()           { /* no-op */ }
  maximize()           { /* no-op */ }
  close()              { window.close(); }
  newWindow()          { window.open(window.location.href, '_blank'); }
  async isMaximized()  { return false; }
  hasNativeControls()  { return false; }
}

class WebShell implements PlatformShell {
  isSupported() { return false; }
  async exec(_command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    throw new Error('Shell execution not available in browser');
  }
}

class WebNetwork implements PlatformNetwork {
  getApiUrl() { return API; }
  getWsUrl()  { return WS; }
  async openExternal(url: string) { window.open(url, '_blank'); }
}

class WebStorage implements PlatformStorage {
  async get(key: string)              { return localStorage.getItem(key); }
  async set(key: string, value: string) { localStorage.setItem(key, value); }
  async remove(key: string)           { localStorage.removeItem(key); }
}

export class WebPlatform implements PlatformAPI {
  fs      = new WebFS();
  window  = new WebWindow();
  shell   = new WebShell();
  network = new WebNetwork();
  storage = new WebStorage();
  info: PlatformInfo = {
    type: 'web',
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isDesktop: !/Mobi|Android/i.test(navigator.userAgent),
    os: 'web',
  };
}

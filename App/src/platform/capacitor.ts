/**
 * Capacitor platform adapter (iOS / Android).
 *
 * Uses:
 *   @capacitor/filesystem   — file read/write
 *   @capacitor/preferences  — key-value storage
 *   @capacitor/browser      — open external URLs
 *   @capacitor/dialog       — native dialogs
 *
 * The backend (Node.js server) does NOT run on mobile.
 * File operations go directly through Capacitor plugins.
 * Terminal / Git are not available on mobile.
 */

import type {
  PlatformAPI, PlatformFS, PlatformWindow, PlatformShell,
  PlatformNetwork, PlatformStorage, PlatformInfo,
  FileDialogOptions, FileDialogResult,
} from './types';

// Lazy-load Capacitor plugins so the desktop build doesn't break
async function getFilesystem() {
  const mod = await import('@capacitor/filesystem' as any);
  return { Filesystem: mod.Filesystem, Directory: mod.Directory, Encoding: mod.Encoding };
}
async function getPreferences() {
  const mod = await import('@capacitor/preferences' as any);
  return mod.Preferences;
}
async function getBrowser() {
  const mod = await import('@capacitor/browser' as any);
  return mod.Browser;
}

// ── File System ────────────────────────────────────────────────────────────

class CapacitorFS implements PlatformFS {
  async readFile(path: string): Promise<string> {
    const { Filesystem, Directory, Encoding } = await getFilesystem();
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { Filesystem, Directory, Encoding } = await getFilesystem();
    await Filesystem.writeFile({
      path,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async deleteItem(path: string): Promise<void> {
    const { Filesystem, Directory } = await getFilesystem();
    await Filesystem.deleteFile({ path, directory: Directory.Documents });
  }

  async renameItem(path: string, newName: string): Promise<string> {
    const { Filesystem, Directory } = await getFilesystem();
    const dir = path.substring(0, path.lastIndexOf('/'));
    const newPath = dir ? `${dir}/${newName}` : newName;
    await Filesystem.rename({
      from: path,
      to: newPath,
      directory: Directory.Documents,
    });
    return newPath;
  }

  async listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory'; path: string }[]> {
    const { Filesystem, Directory } = await getFilesystem();
    const result = await Filesystem.readdir({ path, directory: Directory.Documents });
    return result.files.map((f: any) => ({
      name: f.name,
      type: f.type === 'directory' ? 'directory' : 'file',
      path: `${path}/${f.name}`,
    }));
  }

  async showOpenDialog(_options: FileDialogOptions): Promise<FileDialogResult> {
    // On mobile, use @capacitor/filesystem directory picker or FilePicker plugin
    // For now return a stub — implement with @capawesome/capacitor-file-picker
    console.warn('showOpenDialog: not fully implemented on mobile');
    return { canceled: true, filePaths: [] };
  }

  async openInExplorer(path: string): Promise<void> {
    // Open in Files app via Browser plugin
    const Browser = await getBrowser();
    await Browser.open({ url: `file://${path}` });
  }
}

// ── Window ─────────────────────────────────────────────────────────────────

class CapacitorWindow implements PlatformWindow {
  minimize()           { /* no-op on mobile */ }
  maximize()           { /* no-op on mobile */ }
  close()              { /* no-op on mobile */ }
  newWindow()          { /* no-op on mobile */ }
  async isMaximized()  { return true; } // always fullscreen on mobile
  hasNativeControls()  { return false; } // use custom mobile header instead
}

// ── Shell ──────────────────────────────────────────────────────────────────

class CapacitorShell implements PlatformShell {
  isSupported() { return false; }
  async exec(_command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    throw new Error('Shell execution is not available on mobile');
  }
}

// ── Network ────────────────────────────────────────────────────────────────

class CapacitorNetwork implements PlatformNetwork {
  // On mobile, the backend runs as a bundled HTTP server via a Capacitor plugin
  // or we use a cloud backend. Default to localhost for dev.
  getApiUrl() {
    return (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:23816';
  }
  getWsUrl() {
    return (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:23816';
  }
  async openExternal(url: string) {
    const Browser = await getBrowser();
    await Browser.open({ url });
  }
}

// ── Storage ────────────────────────────────────────────────────────────────

class CapacitorStorage implements PlatformStorage {
  async get(key: string): Promise<string | null> {
    const Preferences = await getPreferences();
    const { value } = await Preferences.get({ key });
    return value;
  }
  async set(key: string, value: string): Promise<void> {
    const Preferences = await getPreferences();
    await Preferences.set({ key, value });
  }
  async remove(key: string): Promise<void> {
    const Preferences = await getPreferences();
    await Preferences.remove({ key });
  }
}

// ── Info ───────────────────────────────────────────────────────────────────

function detectMobileOS(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua))          return 'android';
  return 'unknown';
}

// ── Assemble ───────────────────────────────────────────────────────────────

export class CapacitorPlatform implements PlatformAPI {
  fs      = new CapacitorFS();
  window  = new CapacitorWindow();
  shell   = new CapacitorShell();
  network = new CapacitorNetwork();
  storage = new CapacitorStorage();
  info: PlatformInfo = {
    type: 'capacitor',
    isMobile: true,
    isDesktop: false,
    os: detectMobileOS(),
  };
}

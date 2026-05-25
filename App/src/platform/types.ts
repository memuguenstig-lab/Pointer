/**
 * Platform API interface — implemented by Electron, Capacitor, and Web adapters.
 */

export interface FileDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface PlatformFS {
  /** Read a file as text */
  readFile(path: string): Promise<string>;
  /** Write text to a file */
  writeFile(path: string, content: string): Promise<void>;
  /** Delete a file or directory */
  deleteItem(path: string): Promise<void>;
  /** Rename/move a file */
  renameItem(path: string, newName: string): Promise<string>;
  /** List directory contents */
  listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory'; path: string }[]>;
  /** Open a native file/folder picker dialog */
  showOpenDialog(options: FileDialogOptions): Promise<FileDialogResult>;
  /** Open a path in the system file explorer */
  openInExplorer(path: string): Promise<void>;
}

export interface PlatformWindow {
  minimize(): void;
  maximize(): void;
  close(force?: boolean): void;
  newWindow(): void;
  isMaximized(): Promise<boolean>;
  /** Whether native window controls should be shown */
  hasNativeControls(): boolean;
}

export interface PlatformShell {
  /** Execute a shell command, returns stdout */
  exec(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  /** Whether shell execution is supported */
  isSupported(): boolean;
}

export interface PlatformNetwork {
  /** Base URL for the backend API */
  getApiUrl(): string;
  /** WebSocket URL for the terminal */
  getWsUrl(): string;
  /** Open a URL in the default browser */
  openExternal(url: string): Promise<void>;
}

export interface PlatformStorage {
  /** Get a persisted value */
  get(key: string): Promise<string | null>;
  /** Set a persisted value */
  set(key: string, value: string): Promise<void>;
  /** Remove a persisted value */
  remove(key: string): Promise<void>;
}

export interface PlatformInfo {
  /** 'electron' | 'capacitor' | 'web' */
  type: 'electron' | 'capacitor' | 'web';
  /** Whether this is a mobile device */
  isMobile: boolean;
  /** Whether this is a desktop app */
  isDesktop: boolean;
  /** OS: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'web' */
  os: string;
}

export interface PlatformAPI {
  fs: PlatformFS;
  window: PlatformWindow;
  shell: PlatformShell;
  network: PlatformNetwork;
  storage: PlatformStorage;
  info: PlatformInfo;
}

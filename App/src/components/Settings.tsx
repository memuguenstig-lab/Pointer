import React, { useState, useEffect, useRef, useCallback } from 'react';
import tinycolor from 'tinycolor2';
import { FileSystemService } from '../services/FileSystemService';
import { ModelConfig, EditorSettings, ThemeSettings, AppSettings, ModelAssignments, DiscordRpcSettings, PromptsSettings, CustomRule } from '../types';
import * as monaco from 'monaco-editor';
import ColorInput from './ColorInput';
import { presetThemes } from '../themes/presetThemes';
import { PathConfig } from '../config/paths';
import { ModelDiscoveryService, ModelInfo } from '../services/ModelDiscoveryService';
import EmbeddedModelSetup from './EmbeddedModelSetup';
import CollapsibleSection from './CollapsibleSection';
import ThemeEditor from './ThemeEditor';
// Add electron API import with proper typing
// @ts-ignore
const electron = window.require ? window.require('electron') : null;
// @ts-ignore
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Add PasswordInput component
const PasswordInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
}> = ({ value, onChange, placeholder, showPassword, onToggleVisibility }) => {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px',
          paddingRight: '32px', // Make room for the eye icon
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
        }}
      />
      <button
        onClick={onToggleVisibility}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          padding: '0',
        }}
      >
        {showPassword ? '👁️' : '👁️‍🗨️'}
      </button>
    </div>
  );
};

interface SettingsProps {
  isVisible: boolean;
  onClose: () => void;
  initialSettings?: {
    discordRpc?: DiscordRpcSettings;
    onDiscordSettingsChange?: (settings: Partial<DiscordRpcSettings>) => void;
    [key: string]: any;
  };
}

const defaultConfig: ModelConfig = {
  id: '', // Allow empty model ID for automatic discovery
  name: 'Default Model',
  temperature: 0.7,
  maxTokens: null,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  contextLength: 8192,
  stopSequences: [],
  modelProvider: 'local',
  apiEndpoint: 'http://localhost:1234/v1',
  apiKey: '',
  purpose: 'general',
};

const defaultModelAssignments: ModelAssignments = {
  chat: 'default',
  insert: 'default',
  autocompletion: 'default',
  summary: 'default',
  agent: 'default',  // Add agent mode assignment
};

const defaultDiscordRpcSettings: DiscordRpcSettings = {
  enabled: true,
  details: 'Editing {file}',
  state: 'Workspace: {workspace}',
  largeImageKey: 'pointer_logo',
  largeImageText: 'Pointer - Code Editor',
  smallImageKey: 'code',
  smallImageText: '{languageId} | Line {line}:{column}',
  button1Label: 'Download Pointer',
  button1Url: 'https://pointr.sh',
  button2Label: '',
  button2Url: '',
};

const defaultPromptsSettings: PromptsSettings = {
  enhancedSystemMessage: true,
  conciseChatSystem: true,
  advancedAgentSystem: true,
  refreshKnowledgeSystem: true,
  coreTraits: true,
  fileOperations: true,
  explorationProtocol: true,
  enhancedCapabilities: true,
  communicationExcellence: true,
  customRules: [],
};

const settingsCategories = [
  { id: 'models', name: 'LLM Models' },
  { id: 'prompts', name: 'AI Prompts' },
  { id: 'theme', name: 'Theme & Editor' },
  { id: 'discord', name: 'Discord Rich Presence' },
  { id: 'github', name: 'GitHub' },
  { id: 'keybindings', name: 'Keybindings' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'advanced', name: 'Advanced' },
];

// Path configuration moved to PathConfig.getActiveSettingsPath()

// ── Animation keyframes injected once ────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('theme-preview-anim')) {
  const s = document.createElement('style');
  s.id = 'theme-preview-anim';
  s.textContent = `
    @keyframes prev-neon{0%,100%{box-shadow:0 0 4px var(--pn,#f0f),0 0 8px var(--pn,#f0f)}50%{box-shadow:0 0 14px var(--pn,#f0f),0 0 28px var(--pn,#f0f)}}
    @keyframes prev-aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes prev-scan{0%{background-position:0 0}100%{background-position:0 4px}}
    @keyframes prev-star{from{background-position:0 0,0 0,0 0,0 0,0 0}to{background-position:0 200px,0 150px,0 100px,0 80px,0 60px}}
    @keyframes prev-badge{0%,100%{opacity:1}50%{opacity:.65}}
  `;
  document.head.appendChild(s);
}

const ThemePreview: React.FC<{ theme: ThemeSettings; name: string; onSelect: () => void }> = ({ theme, name, onSelect }) => {
  const c = theme.customColors;
  const preset = c.animationPreset;
  const isAnimated = !!preset && preset !== 'none';
  const neon = c.neonPulseColor || c.accentColor || '#ff00ff';
  const acc  = c.accentColor || '#0078d4';
  const kw   = theme.tokenColors?.find(t => t.token === 'keyword')?.foreground  || '#569cd6';
  const fn   = theme.tokenColors?.find(t => t.token === 'function')?.foreground || '#dcdcaa';
  const str  = theme.tokenColors?.find(t => t.token === 'string')?.foreground   || '#ce9178';
  const vr   = theme.tokenColors?.find(t => t.token === 'variable')?.foreground || '#9cdcfe';
  const num  = theme.tokenColors?.find(t => t.token === 'number')?.foreground   || '#b5cea8';
  const ln   = theme.editorColors['editorLineNumber.foreground'] || '#858585';
  const bg   = theme.editorColors['editor.background'] || c.bgSecondary || '#1e1e1e';
  const fg   = c.textPrimary || '#ccc';

  let overlayStyle: React.CSSProperties = {};
  if (preset === 'aurora') {
    overlayStyle = { background: `linear-gradient(135deg,${acc}18,${c.accentHover||acc}12,${c.terminalCyan||acc}10,${acc}18)`, backgroundSize: '400% 400%', animation: 'prev-aurora 4s ease infinite' };
  } else if (preset === 'matrix-rain') {
    overlayStyle = { background: `repeating-linear-gradient(0deg,transparent 0px,transparent 3px,${acc}20 3px,${acc}20 4px)`, animation: 'prev-scan .1s linear infinite' };
  } else if (preset === 'starfield') {
    overlayStyle = { backgroundImage: 'radial-gradient(1px 1px at 15% 20%,rgba(255,255,255,.7) 0%,transparent 100%),radial-gradient(1px 1px at 40% 60%,rgba(255,255,255,.5) 0%,transparent 100%),radial-gradient(1px 1px at 70% 30%,rgba(255,255,255,.6) 0%,transparent 100%),radial-gradient(1px 1px at 85% 75%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(2px 2px at 55% 45%,rgba(255,255,255,.3) 0%,transparent 100%)', animation: 'prev-star 8s linear infinite' };
  } else if (preset === 'scanlines') {
    overlayStyle = { background: 'repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px)', animation: 'prev-scan .12s linear infinite' };
  }

  return (
    <div onClick={onSelect} style={{
      width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden',
      cursor: 'pointer', position: 'relative',
      border: `1px solid ${isAnimated ? neon+'55' : (c.borderPrimary||'#333')}`,
      boxShadow: isAnimated ? `0 2px 12px ${neon}30` : '0 2px 8px rgba(0,0,0,.2)',
      transition: 'transform .18s ease, box-shadow .18s ease',
      animation: preset === 'neon-pulse' ? 'prev-neon 2.5s ease-in-out infinite' : 'none',
      ['--pn' as any]: neon,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'; e.currentTarget.style.boxShadow = isAnimated ? `0 8px 24px ${neon}50` : '0 8px 20px rgba(0,0,0,.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = isAnimated ? `0 2px 12px ${neon}30` : '0 2px 8px rgba(0,0,0,.2)'; }}
    >
      {isAnimated && preset !== 'neon-pulse' && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, ...overlayStyle }} />}
      {/* Titlebar */}
      <div style={{ height: 22, background: c.titlebarGradient && c.titlebarGradient !== 'none' ? c.titlebarGradient : (c.titlebarBg||c.bgPrimary||'#1e1e1e'), borderBottom: `1px solid ${preset==='neon-pulse'?neon:(c.borderPrimary||'#333')}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 5, boxShadow: preset==='neon-pulse'?`0 1px 10px ${neon}70`:'none', position: 'relative', zIndex: 3 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
      </div>
      {/* Body */}
      <div style={{ display: 'flex', height: 'calc(100% - 22px)', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 24, flexShrink: 0, background: c.activityBarBg||c.bgPrimary||'#1e1e1e', borderRight: `1px solid ${c.borderPrimary||'#333'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0', gap: 6 }}>
          {[.5,1,.5].map((op,i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: i===1?acc:(c.activityBarFg||'#888'), opacity: op }} />)}
        </div>
        <div style={{ flex: 1, background: bg, padding: '4px 0 0 4px', overflow: 'hidden', fontFamily: 'Consolas,monospace', fontSize: 8, lineHeight: 1.5 }}>
          <div style={{ display: 'flex' }}><span style={{ color: ln, width: 12, textAlign: 'right', marginRight: 5, opacity: .6 }}>1</span><span style={{ color: kw }}>function </span><span style={{ color: fn }}>hello</span><span style={{ color: fg }}>() {'{'}</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: ln, width: 12, textAlign: 'right', marginRight: 5, opacity: .6 }}>2</span><span style={{ color: fg }}>  </span><span style={{ color: kw }}>const </span><span style={{ color: vr }}>x</span><span style={{ color: fg }}> = </span><span style={{ color: str }}>"world"</span><span style={{ color: fg }}>;</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: ln, width: 12, textAlign: 'right', marginRight: 5, opacity: .6 }}>3</span><span style={{ color: fg }}>  </span><span style={{ color: kw }}>return </span><span style={{ color: num }}>42</span><span style={{ color: fg }}>;</span></div>
          <div style={{ display: 'flex' }}><span style={{ color: ln, width: 12, textAlign: 'right', marginRight: 5, opacity: .6 }}>4</span><span style={{ color: fg }}>{'}'}</span></div>
        </div>
      </div>
      {/* Name + badge */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 8px', background: 'linear-gradient(transparent,rgba(0,0,0,.78))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{name}</span>
        {isAnimated && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', padding: '2px 6px', borderRadius: 4, background: neon, color: '#000', textTransform: 'uppercase', animation: 'prev-badge 2s ease-in-out infinite', boxShadow: `0 0 6px ${neon}`, flexShrink: 0 }}>✦ animated</span>}
      </div>
    </div>
  );
};

const ThemeLibraryModal: React.FC<{ isVisible: boolean; onClose: () => void; onSelectTheme: (theme: ThemeSettings) => void }> = ({ isVisible, onClose, onSelectTheme }) => {
  const [filter, setFilter] = React.useState<'all'|'dark'|'light'|'animated'>('all');
  if (!isVisible) return null;
  const filtered = Object.entries(presetThemes).filter(([,t]) => {
    if (filter === 'dark')     return t.name === 'vs-dark';
    if (filter === 'light')    return t.name === 'vs';
    if (filter === 'animated') return !!t.customColors.animationPreset && t.customColors.animationPreset !== 'none';
    return true;
  });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '88%', maxWidth: 1100, maxHeight: '85vh', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-primary)', boxShadow: '0 24px 64px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Theme Library</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{filtered.length} theme{filtered.length !== 1 ? 's' : ''} — click to apply</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all','dark','light','animated'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-primary)', cursor: 'pointer', background: filter===f?'var(--accent-color)':'var(--bg-secondary)', color: filter===f?'#fff':'var(--text-secondary)', textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
            {filtered.map(([n,t]) => <ThemePreview key={n} name={n} theme={t} onSelect={() => { onSelectTheme(t); onClose(); }} />)}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>✦ animated = has live animation effects</span>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
};
export function Settings({ isVisible, onClose, initialSettings }: SettingsProps) {
  const [activeCategory, setActiveCategory] = useState('models');
  const [activeTab, setActiveTab] = useState('default');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({
    'default': { ...defaultConfig },
  });
  const [modelAssignments, setModelAssignments] = useState<ModelAssignments>({...defaultModelAssignments});
  const [editorSettings, setEditorSettings] = useState({
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 1.5,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: true,
    rulers: [],
    formatOnSave: true,
    formatOnPaste: false,
    autoSave: true,
    autoAcceptGhostText: false,
  });
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    name: 'vs-dark',
    customColors: {
      bgPrimary: '',
      bgSecondary: '',
      bgTertiary: '',
      bgSelected: '',
      bgHover: '',
      bgAccent: '',
      textPrimary: '',
      textSecondary: '',
      borderColor: '',
      borderPrimary: '',
      accentColor: '',
      accentHover: '',
      errorColor: '',
      titlebarBg: '',
      statusbarBg: '',
      statusbarFg: '',
      activityBarBg: '',
      activityBarFg: '',
      inlineCodeColor: '#cc0000',
    },
    editorColors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorCursor.foreground": "#d4d4d4",
      "editor.selectionBackground": "#264f78",
      "editor.lineHighlightBackground": "#2d2d2d50",
    },
    tokenColors: [
      { token: 'keyword', foreground: '#569CD6', fontStyle: 'bold' },
      { token: 'comment', foreground: '#6A9955', fontStyle: 'italic' },
      { token: 'string', foreground: '#CE9178' },
      { token: 'number', foreground: '#B5CEA8' },
      { token: 'operator', foreground: '#D4D4D4' },
      { token: 'type', foreground: '#4EC9B0' },
      { token: 'function', foreground: '#DCDCAA' },
      { token: 'variable', foreground: '#9CDCFE' }
    ]
  });
  const [discordRpcSettings, setDiscordRpcSettings] = useState<DiscordRpcSettings>({...defaultDiscordRpcSettings});
  const [promptsSettings, setPromptsSettings] = useState<PromptsSettings>({...defaultPromptsSettings});
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<Record<string, any>>({
    titleFormat: '{filename} - {workspace} - Pointer'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [isThemeLibraryVisible, setIsThemeLibraryVisible] = useState(false);
  const [isThemeEditorVisible, setIsThemeEditorVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [availableModelsError, setAvailableModelsError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [filteredModels, setFilteredModels] = useState<ModelInfo[]>([]);
  const [autocompletionConnectionStatus, setAutocompletionConnectionStatus] = useState<{
    connected: boolean;
    error: string | null;
    testing: boolean;
    url: string | null;
  }>({
    connected: false,
    error: null,
    testing: false,
    url: null
  });

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      setDiscordRpcSettings({...defaultDiscordRpcSettings});
      console.log('Settings opened - initiating full sync with main process');
      const loadSettingsAsync = async () => {
        try {
          if (ipcRenderer) {
            const rpcSettings = await ipcRenderer.invoke('get-discord-rpc-settings');
            if (rpcSettings) {
              setDiscordRpcSettings(rpcSettings);
            } else {
              console.warn('No settings received from main process');
            }
          }
          await loadAllSettings();
          await checkAuthStatus();
          
          // Auto-discover models for configurations with empty model IDs when settings are opened
          for (const [key, modelConfig] of Object.entries(modelConfigs)) {
            if ((!modelConfig.id || modelConfig.id.trim() === '') && modelConfig.apiEndpoint) {
              // Discover models in the background
              fetchAvailableModels(modelConfig.apiEndpoint, modelConfig.apiKey);
              break; // Only discover for one config to avoid overwhelming the API
            }
          }
        } catch (error) {
          console.error('Error during settings sync:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadSettingsAsync();
    }
  }, [isVisible]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://localhost:23816/github/auth-status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Error checking GitHub auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const handleLogin = () => {
    // Open GitHub OAuth URL in default browser
    if (electron && electron.shell) {
      electron.shell.openExternal('http://localhost:23816/github/auth');
    } else {
      // Fallback to window.open if electron is not available
      window.open('http://localhost:23816/github/auth', '_blank');
    }
    
    // Start polling for auth status
    const pollInterval = setInterval(async () => {
      const response = await fetch('http://localhost:23816/github/auth-status');
      const data = await response.json();
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        clearInterval(pollInterval);
      }
    }, 2000);
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:23816/github/logout', { method: 'POST' });
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out from GitHub:', error);
    }
  };

  async function loadDiscordRpcSettings(): Promise<void> {
    try {
      if (ipcRenderer) {
        const rpcSettings = await ipcRenderer.invoke('get-discord-rpc-settings');
        if (rpcSettings) {
          const currentSettingsJson = JSON.stringify(discordRpcSettings);
          const newSettingsJson = JSON.stringify(rpcSettings);
          if (currentSettingsJson !== newSettingsJson) {
            const updatedSettings = {
              ...discordRpcSettings,
              ...rpcSettings
            };
            setDiscordRpcSettings(updatedSettings);
            setHasUnsavedChanges(false);
          } else {
            console.log('Discord RPC settings unchanged');
          }
          return;
        } else {
          console.log('No Discord RPC settings received from main process');
        }
      } else {
        console.log('IPC Renderer not available, skipping Discord RPC settings load');
      }
    } catch (rpcError) {
      console.error('Error loading Discord RPC settings:', rpcError);
    }
    console.log('Using default Discord RPC settings');
    setDiscordRpcSettings({...defaultDiscordRpcSettings});
  }

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      const localStorageConfig = localStorage.getItem('modelConfig');
      if (localStorageConfig) {
        const parsed = JSON.parse(localStorageConfig);
        setModelConfigs(prev => ({
          ...prev,
          'default': {
            ...prev.default,
            ...parsed,
            id: parsed.id && parsed.id !== 'default-model' ? parsed.id : 'deepseek-coder-v2-lite-instruct'
          }
        }));
      }
      await loadDiscordRpcSettings();
      const settingsPath = PathConfig.getActiveSettingsPath();
      const result = await FileSystemService.readSettingsFiles(settingsPath);
      if (result && result.success) {
        if (result.settings.models) {
          const validatedModels = { ...result.settings.models };
          Object.keys(validatedModels).forEach(key => {
            if (!validatedModels[key].id || validatedModels[key].id === 'default-model') {
              validatedModels[key].id = 'deepseek-coder-v2-lite-instruct';
            }
          });
          setModelConfigs(prev => ({
            ...prev,
            ...validatedModels
          }));
          
          // Auto-discover models for configurations with empty model IDs
          for (const [key, modelConfig] of Object.entries(validatedModels)) {
            const config = modelConfig as any;
            if ((!config.id || config.id.trim() === '') && config.apiEndpoint) {
              // Discover models in the background
              fetchAvailableModels(config.apiEndpoint, config.apiKey);
              break; // Only discover for one config to avoid overwhelming the API
            }
          }
        }
        if (result.settings.modelAssignments) {
          const assignments = { ...defaultModelAssignments };
          Object.keys(result.settings.modelAssignments).forEach(key => {
            if (key === 'chat' || key === 'insert' || key === 'autocompletion' || key === 'summary' || key === 'agent') {
              assignments[key as keyof ModelAssignments] = result.settings.modelAssignments[key];
            }
          });
          setModelAssignments(assignments);
        } else {
          setModelAssignments({...defaultModelAssignments});
        }
        if (result.settings.editor) {
          setEditorSettings(prev => ({
            ...prev,
            ...result.settings.editor
          }));
        }
        if (result.settings.theme) {
          setThemeSettings(prev => ({
            ...prev,
            ...result.settings.theme
          }));
        }
        if (result.settings.discordRpc) {
          setDiscordRpcSettings(prev => ({
            ...prev,
            ...result.settings.discordRpc
          }));
        }
        if (initialSettings?.discordRpc) {
          setDiscordRpcSettings(prev => ({
            ...prev,
            ...initialSettings.discordRpc
          }));
        }
        if (result.settings.prompts) {
          setPromptsSettings(prev => ({
            ...prev,
            ...result.settings.prompts
          }));
        }
        if (result.settings.advanced) {
          setAdvanced(prev => ({
            ...prev,
            ...result.settings.advanced
          }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    window.loadSettings = loadAllSettings;
    return () => {
      delete window.loadSettings;
    };
  }, []);

  const saveAllSettings = async () => {
    setIsLoading(true);
    try {
      localStorage.setItem('modelConfig', JSON.stringify(modelConfigs.default));
      localStorage.setItem('modelAssignments', JSON.stringify(modelAssignments));
      applyThemeSettings();
      const settingsPath = PathConfig.getActiveSettingsPath();
      const settings = {
        models: modelConfigs,
        modelAssignments: modelAssignments,
        editor: editorSettings,
        theme: themeSettings,
        discordRpc: discordRpcSettings,
        prompts: promptsSettings,
        advanced: advanced
      };
      const result = await FileSystemService.saveSettingsFiles(settingsPath, settings);
      if (result.success) {
        console.log('Settings saved successfully');
        
        // Auto-discover models for configurations with empty model IDs after saving
        for (const [key, modelConfig] of Object.entries(modelConfigs)) {
          if ((!modelConfig.id || modelConfig.id.trim() === '') && modelConfig.apiEndpoint) {
            // Discover models in the background
            fetchAvailableModels(modelConfig.apiEndpoint, modelConfig.apiKey);
            break; // Only discover for one config to avoid overwhelming the API
          }
        }
      } else {
        console.error('Failed to save settings');
      }
      if (ipcRenderer) {
        ipcRenderer.send('discord-settings-update', discordRpcSettings);
        console.log('Discord RPC settings sent to main process via discord-settings-update');
      } else {
        console.log('IPC Renderer not available, skipping Discord RPC settings save');
      }
      setHasUnsavedChanges(false);
      window.dispatchEvent(new Event('settings-saved'));
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const applyThemeSettings = () => {
    const validBaseThemes = ['vs', 'vs-dark', 'hc-black', 'hc-light'];
    const baseTheme = validBaseThemes.includes(themeSettings.name) 
      ? themeSettings.name as monaco.editor.BuiltinTheme
      : 'vs-dark';
    const processedEditorColors: Record<string, string> = {};
    Object.entries(themeSettings.editorColors).forEach(([key, value]) => {
      if (value) {
        const processedValue = value.length > 7 ? value.substring(0, 7) : value;
        processedEditorColors[key] = processedValue;
      }
    });
    monaco.editor.defineTheme('custom-theme', {
      base: baseTheme,
      inherit: true,
      rules: (themeSettings.tokenColors || []).map(item => ({
        token: item.token,
        foreground: item.foreground?.replace('#', ''),
        background: item.background?.replace('#', ''),
        fontStyle: item.fontStyle
      })),
      colors: processedEditorColors
    });
    monaco.editor.setTheme('custom-theme');

    const root = document.documentElement;
    const c = themeSettings.customColors;

    // Apply all string customColors as CSS variables (camelCase → kebab-case)
    Object.entries(c).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVarName, value);
      }
    });

    // Explicit mappings for new grouped fields
    const set = (v: string, val: string | undefined) => { if (val) root.style.setProperty(v, val); };

    // UI Shape
    set('--border-radius',    c.borderRadius);
    set('--border-radius-lg', c.borderRadiusLg);
    set('--shadow-color',     c.shadowColor);
    set('--shadow-sm',        c.shadowSm);
    set('--shadow-md',        c.shadowMd);
    set('--shadow-lg',        c.shadowLg);

    // Typography
    set('--font-ui',       c.fontUi);
    set('--font-mono',     c.fontMono);
    set('--font-size-ui',  c.fontSizeUi);

    // Scrollbar
    set('--scrollbar-width',       c.scrollbarWidth);
    set('--scrollbar-thumb',       c.scrollbarThumb);
    set('--scrollbar-thumb-hover', c.scrollbarThumbHover);
    set('--scrollbar-track',       c.scrollbarTrack);

    // Chat
    set('--chat-bg',               c.chatBg);
    set('--chat-user-bubble-bg',   c.chatUserBubbleBg);
    set('--chat-user-bubble-fg',   c.chatUserBubbleFg);
    set('--chat-ai-bubble-bg',     c.chatAiBubbleBg);
    set('--chat-ai-bubble-fg',     c.chatAiBubbleFg);
    set('--chat-input-bg',         c.chatInputBg);
    set('--chat-input-border',     c.chatInputBorder);
    set('--chat-code-block-bg',    c.chatCodeBlockBg);

    // Diff
    set('--diff-added-bg',       c.diffAddedBg);
    set('--diff-removed-bg',     c.diffRemovedBg);
    set('--diff-modified-bg',    c.diffModifiedBg);
    set('--diff-added-gutter',   c.diffAddedGutter);
    set('--diff-removed-gutter', c.diffRemovedGutter);
    set('--diff-modified-gutter',c.diffModifiedGutter);

    // Terminal — derive from theme if not explicitly set
    const bg     = c.bgPrimary     || '#141414';
    const fg     = c.textPrimary   || '#cccccc';
    const accent = c.accentColor   || '#58a6ff';
    const err    = c.errorColor    || '#f85149';

    const termMap: [string, keyof typeof c][] = [
      ['--terminal-bg',             'terminalBg'],
      ['--terminal-fg',             'terminalFg'],
      ['--terminal-cursor',         'terminalCursor'],
      ['--terminal-black',          'terminalBlack'],
      ['--terminal-bright-black',   'terminalBrightBlack'],
      ['--terminal-red',            'terminalRed'],
      ['--terminal-bright-red',     'terminalBrightRed'],
      ['--terminal-green',          'terminalGreen'],
      ['--terminal-bright-green',   'terminalBrightGreen'],
      ['--terminal-yellow',         'terminalYellow'],
      ['--terminal-bright-yellow',  'terminalBrightYellow'],
      ['--terminal-blue',           'terminalBlue'],
      ['--terminal-bright-blue',    'terminalBrightBlue'],
      ['--terminal-magenta',        'terminalMagenta'],
      ['--terminal-bright-magenta', 'terminalBrightMagenta'],
      ['--terminal-cyan',           'terminalCyan'],
      ['--terminal-bright-cyan',    'terminalBrightCyan'],
      ['--terminal-white',          'terminalWhite'],
      ['--terminal-bright-white',   'terminalBrightWhite'],
    ];
    termMap.forEach(([cssVar, key]) => {
      const val = c[key] as string | undefined;
      if (val) {
        root.style.setProperty(cssVar, val);
      } else {
        // Derive sensible defaults from theme colors
        if (cssVar === '--terminal-bg')     root.style.setProperty(cssVar, bg);
        if (cssVar === '--terminal-fg')     root.style.setProperty(cssVar, fg);
        if (cssVar === '--terminal-cursor') root.style.setProperty(cssVar, accent);
        if (cssVar === '--terminal-blue')   root.style.setProperty(cssVar, accent);
        if (cssVar === '--terminal-red')    root.style.setProperty(cssVar, err);
      }
    });

    // ── Animation & Effects ──────────────────────────────────────────────
    // Always reset effect variables first so switching themes clears old values
    const resetVar = (v: string, fallback: string) => root.style.setProperty(v, fallback);
    resetVar('--transition-speed',            '0.15s');
    resetVar('--transition-easing',           'ease');
    resetVar('--glow-color',                  'transparent');
    resetVar('--glow-intensity',              '0 0 0 0');
    resetVar('--focus-glow',                  'none');
    resetVar('--accent-glow',                 'none');
    resetVar('--titlebar-gradient',           'none');
    resetVar('--statusbar-gradient',          'none');
    resetVar('--activity-bar-gradient',       'none');
    resetVar('--sidebar-gradient',            'none');
    resetVar('--chat-user-bubble-gradient',   'none');
    resetVar('--accent-gradient',             'none');
    resetVar('--backdrop-blur',               'none');
    resetVar('--glass-bg',                    'transparent');
    resetVar('--glass-border',                'none');
    resetVar('--scanlines-opacity',           '0.04');
    resetVar('--neon-pulse-color',            '#ffffff');
    resetVar('--animations-enabled',          '1');

    // Now apply theme-specific values
    if (c.transitionSpeed)  root.style.setProperty('--transition-speed',  c.transitionSpeed);
    if (c.transitionEasing) root.style.setProperty('--transition-easing', c.transitionEasing);
    if (c.glowColor)        root.style.setProperty('--glow-color',        c.glowColor);
    if (c.glowIntensity)    root.style.setProperty('--glow-intensity',    c.glowIntensity);
    if (c.focusGlow)        root.style.setProperty('--focus-glow',        c.focusGlow);
    if (c.accentGlow)       root.style.setProperty('--accent-glow',       c.accentGlow);

    if (c.titlebarGradient)          root.style.setProperty('--titlebar-gradient',          c.titlebarGradient);
    if (c.statusbarGradient)         root.style.setProperty('--statusbar-gradient',         c.statusbarGradient);
    if (c.activityBarGradient)       root.style.setProperty('--activity-bar-gradient',      c.activityBarGradient);
    if (c.sidebarGradient)           root.style.setProperty('--sidebar-gradient',           c.sidebarGradient);
    if (c.chatUserBubbleGradient)    root.style.setProperty('--chat-user-bubble-gradient',  c.chatUserBubbleGradient);
    if (c.accentGradient)            root.style.setProperty('--accent-gradient',            c.accentGradient);

    if (c.backdropBlur) root.style.setProperty('--backdrop-blur', c.backdropBlur);
    if (c.glassBg)      root.style.setProperty('--glass-bg',      c.glassBg);
    if (c.glassBorder)  root.style.setProperty('--glass-border',  c.glassBorder);

    if (c.scanlinesOpacity) root.style.setProperty('--scanlines-opacity', c.scanlinesOpacity);
    if (c.neonPulseColor)   root.style.setProperty('--neon-pulse-color',  c.neonPulseColor);
    if (c.animationsEnabled === false) root.style.setProperty('--animations-enabled', '0');

    // Animation preset — toggle CSS classes on <html>
    const html = document.documentElement;
    const allPresets = ['theme-scanlines','theme-neon-pulse','theme-aurora','theme-starfield','theme-matrix-rain'];
    allPresets.forEach(p => html.classList.remove(p));
    if (c.animationPreset && c.animationPreset !== 'none') {
      html.classList.add(`theme-${c.animationPreset}`);

      // Set aurora colors derived from the theme's accent palette
      if (c.animationPreset === 'aurora') {
        const a1 = c.accentColor   || '#7aa2f7';
        const a2 = c.accentHover   || '#bb9af7';
        const a3 = c.terminalCyan  || c.successColor || '#2ac3de';
        const toRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1,3),16);
          const g = parseInt(hex.slice(3,5),16);
          const b = parseInt(hex.slice(5,7),16);
          return `rgba(${r},${g},${b},${alpha})`;
        };
        try {
          root.style.setProperty('--aurora-color-1', toRgba(a1, 0.06));
          root.style.setProperty('--aurora-color-2', toRgba(a2, 0.05));
          root.style.setProperty('--aurora-color-3', toRgba(a3, 0.04));
        } catch(_) {}
      }
    }

    window.dispatchEvent(new Event('theme-changed'));
  };

  useEffect(() => {
    applyThemeSettings();
  }, [themeSettings]);

  // Auto-discover models when active tab changes
  useEffect(() => {
    if (activeTab && modelConfigs[activeTab]) {
      const config = modelConfigs[activeTab];
      if ((!config.id || config.id.trim() === '') && config.apiEndpoint) {
        // Discover models in the background
        fetchAvailableModels(config.apiEndpoint, config.apiKey);
      }
    }
  }, [activeTab, modelConfigs]);

  // Close model suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showModelSuggestions) {
        const target = event.target as Element;
        if (!target.closest('.model-id-container')) {
          setShowModelSuggestions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelSuggestions]);

  const handleModelConfigChange = (modelId: string, field: keyof ModelConfig, value: any) => {
    setModelConfigs(prev => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);

    // Save settings immediately when API key changes
    if (field === 'apiKey') {
      handleTogglePasswordVisibility();
    }
    
    // Auto-discover models when provider changes (if no model ID is set)
    if (field === 'modelProvider' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId].apiKey);
    }
    
    // Auto-discover models when API endpoint changes (if no model ID is set)
    if (field === 'apiEndpoint' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiKey) {
      fetchAvailableModels(value, modelConfigs[modelId].apiKey);
    }
    
    // Auto-discover models when API key changes (if no model ID is set)
    if (field === 'apiKey' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, value);
    }
    
    // Auto-discover models when model name changes (if no model ID is set)
    if (field === 'name' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model purpose changes (if no model ID is set)
    if (field === 'purpose' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model temperature changes (if no model ID is set)
    if (field === 'temperature' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model maxTokens changes (if no model ID is set)
    if (field === 'maxTokens' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model topP changes (if no model ID is set)
    if (field === 'topP' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model frequencyPenalty changes (if no model ID is set)
    if (field === 'frequencyPenalty' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model presencePenalty changes (if no model ID is set)
    if (field === 'presencePenalty' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    
    // Auto-discover models when model contextLength changes (if no model ID is set)
    if (field === 'contextLength' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model stopSequences changes (if no model ID is set)
    if (field === 'stopSequences' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
    
    // Auto-discover models when model purpose changes (if no model ID is set)
    if (field === 'purpose' && value && 
        (!modelConfigs[modelId]?.id || modelConfigs[modelId]?.id.trim() === '') &&
        modelConfigs[modelId]?.apiEndpoint) {
      fetchAvailableModels(modelConfigs[modelId].apiEndpoint, modelConfigs[modelId]?.apiKey);
    }
  };

  const handleEditorSettingChange = (field: string, value: any) => {
    setEditorSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleThemeSettingChange = (field: string, value: any) => {
    setThemeSettings({
      ...themeSettings,
      [field]: value
    });
    setHasUnsavedChanges(true);
    if (field === 'customColors' && typeof value === 'object') {
      window.appSettings = window.appSettings || {};
      window.appSettings.theme = window.appSettings.theme || {};
      window.appSettings.theme.customColors = window.appSettings.theme.customColors || {};
      if (value.customFileExtensions) {
        window.appSettings.theme.customColors.customFileExtensions = 
          { ...value.customFileExtensions };
      }
      window.dispatchEvent(new Event('theme-changed'));
    }
  };

  const applyAutoPaletteFromAccent = () => {
    const accentColor = themeSettings.customColors.accentColor || '#0078d4';
    const parsed = tinycolor(accentColor);
    if (!parsed.isValid()) return;

    const light = parsed.clone().lighten(20).toHexString();
    const medium = parsed.clone().lighten(10).toHexString();
    const dark = parsed.clone().darken(20).toHexString();

    setThemeSettings(prev => ({
      ...prev,
      customColors: {
        ...prev.customColors,
        bgPrimary: parsed.clone().darken(15).toHexString(),
        bgSecondary: parsed.clone().darken(10).toHexString(),
        bgTertiary: light,
        textPrimary: parsed.isLight() ? '#0d0d0d' : '#ffffff',
        textSecondary: parsed.isLight() ? '#2e2e2e' : '#cccccc',
        borderColor: medium,
        accentHover: parsed.clone().desaturate(10).toHexString(),
        titlebarBg: dark,
        statusbarBg: dark,
        statusbarFg: parsed.isLight() ? '#000000' : '#f5f5f5',
      }
    }));

    setHasUnsavedChanges(true);
    window.dispatchEvent(new Event('theme-changed'));
  };


  const handleDiscordRpcSettingChange = (field: keyof DiscordRpcSettings, value: any) => {
    setDiscordRpcSettings((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (initialSettings?.onDiscordSettingsChange) {
        initialSettings.onDiscordSettingsChange(updated);
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handlePromptsSettingChange = (field: keyof PromptsSettings, value: boolean) => {
    setPromptsSettings((prev) => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleCustomRuleChange = (ruleId: string, field: keyof CustomRule, value: any) => {
    setPromptsSettings((prev) => ({
      ...prev,
      customRules: prev.customRules.map(rule => 
        rule.id === ruleId ? { ...rule, [field]: value } : rule
      )
    }));
    setHasUnsavedChanges(true);
  };

  const addCustomRule = () => {
    const newRule: CustomRule = {
      id: `rule_${Date.now()}`,
      name: 'New Rule',
      content: 'Enter your custom rule content here...',
      enabled: true
    };
    setPromptsSettings((prev) => ({
      ...prev,
      customRules: [...prev.customRules, newRule]
    }));
    setHasUnsavedChanges(true);
  };

  const deleteCustomRule = (ruleId: string) => {
    setPromptsSettings((prev) => ({
      ...prev,
      customRules: prev.customRules.filter(rule => rule.id !== ruleId)
    }));
    setHasUnsavedChanges(true);
  };

  const handleEditPrompt = (promptKey: string) => {
    setEditingPrompt(promptKey);
  };

  const handleEditRule = (ruleId: string) => {
    setEditingRule(ruleId);
  };

  const savePromptEdit = (promptKey: string, newContent: string) => {
    // For now, we'll just close the editor
    // In the future, this could save to a custom prompt content store
    setEditingPrompt(null);
  };

  const saveRuleEdit = (ruleId: string, newContent: string) => {
    handleCustomRuleChange(ruleId, 'content', newContent);
    setEditingRule(null);
  };

  const handleAdvancedSettingChange = (field: string, value: any) => {
    setAdvanced((prev) => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
    
    // Dispatch custom event for live title format updates
    if (field === 'titleFormat') {
      const event = new CustomEvent('title-format-changed', { detail: { titleFormat: value } });
      window.dispatchEvent(event);
    }
  };

  const addModelConfig = () => {
    const newId = `model_${Object.keys(modelConfigs).length}`;
    setModelConfigs(prev => ({
      ...prev,
      [newId]: { 
        ...defaultConfig, 
        id: '', // Start with empty model ID for auto-discovery
        name: `Custom Model ${Object.keys(modelConfigs).length}` 
      }
    }));
    setActiveTab(newId);
  };

  const deleteModelConfig = (modelId: string) => {
    if (modelId === 'default') {
      alert('Cannot delete the default model configuration');
      return;
    }

    setModelConfigs(prev => {
      const newConfigs = { ...prev };
      delete newConfigs[modelId];
      return newConfigs;
    });

    setActiveTab('default');
  };

  const fetchAvailableModels = async (apiEndpoint: string, apiKey?: string) => {
    if (!apiEndpoint) return;
    // Don't try to discover models for embedded provider
    if (apiEndpoint.includes('/api/llama')) return;
    
    setIsLoadingModels(true);
    try {
      const models = await ModelDiscoveryService.getAvailableModels(apiEndpoint, apiKey);
      setAvailableModels(models);
    } catch (error) {
      const userMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to fetch available models:', userMessage);
      setAvailableModels([]);
      setAvailableModelsError(userMessage);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelIdInputChange = (modelId: string, field: keyof ModelConfig, value: string) => {
    handleModelConfigChange(modelId, field, value);
    
    // Filter models for autocomplete
    if (field === 'id' && value && availableModels.length > 0) {
      const filtered = availableModels.filter(model => 
        model.id.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredModels(filtered);
      setShowModelSuggestions(filtered.length > 0);
    } else {
      setShowModelSuggestions(false);
    }
  };

  const handleModelIdFocus = async (modelId: string) => {
    const config = modelConfigs[modelId];
    if (config?.apiEndpoint && availableModels.length === 0) {
      await fetchAvailableModels(config.apiEndpoint, config.apiKey);
    }
  };

  const selectModelSuggestion = (modelId: string, selectedModel: ModelInfo) => {
    handleModelConfigChange(modelId, 'id', selectedModel.id);
    setShowModelSuggestions(false);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleCustomColorChange = (key: keyof ThemeSettings['customColors'], value: string) => {
    const newCustomColors = {
      ...themeSettings.customColors,
      [key]: value
    };

    setThemeSettings({
      ...themeSettings,
      customColors: newCustomColors
    });

    setHasUnsavedChanges(true);
    const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    document.documentElement.style.setProperty(cssVarName, value);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const handleEditorColorChange = (key: string, value: string) => {
    setThemeSettings(prev => ({
      ...prev,
      editorColors: {
        ...prev.editorColors,
        [key]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleTokenColorChange = (index: number, field: string, value: string) => {
    setThemeSettings(prev => {
      const newTokenColors = [...(prev.tokenColors || [])];
      if (!newTokenColors[index]) {
        newTokenColors[index] = { token: '' };
      }
      newTokenColors[index] = { ...newTokenColors[index], [field]: value };
      return {
        ...prev,
        tokenColors: newTokenColors
      };
    });
    setHasUnsavedChanges(true);
  };

  const addTokenColor = () => {
    setThemeSettings(prev => ({
      ...prev,
      tokenColors: [...(prev.tokenColors || []), { token: '' }]
    }));
    setHasUnsavedChanges(true);
  };

  const removeTokenColor = (index: number) => {
    setThemeSettings(prev => {
      const newTokenColors = [...(prev.tokenColors || [])];
      newTokenColors.splice(index, 1);
      return {
        ...prev,
        tokenColors: newTokenColors
      };
    });
    setHasUnsavedChanges(true);
  };

  // Add useEffect to load password visibility state
  useEffect(() => {
    const loadPasswordVisibility = async () => {
      try {
        const response = await fetch('http://localhost:23816/api/settings');
        if (response.ok) {
          const data = await response.json();
          setShowPassword(data.show_password ?? false);
          if (data.openai_api_key) {
            setModelConfigs(prev => ({
              ...prev,
              [activeTab]: { ...prev[activeTab], apiKey: data.openai_api_key }
            }));
          }
        }
      } catch {
        // Backend not available — ignore silently
      }
    };
    loadPasswordVisibility();
  }, [activeTab]);

  const testAutocompletionConnection = useCallback(async () => {
    setAutocompletionConnectionStatus(prev => ({ ...prev, testing: true, error: null, url: null }));
    
    let testEndpoint = '';
    
    try {
      // Get the autocompletion model configuration
      const autocompletionModelId = modelAssignments.autocompletion;
      const autocompletionConfig = modelConfigs[autocompletionModelId];
      
      if (!autocompletionConfig) {
        throw new Error('No autocompletion model configured');
      }
      
      if (!autocompletionConfig.apiEndpoint) {
        throw new Error('No API endpoint configured for autocompletion model');
      }
      
      // Test the connection by making a simple request
      testEndpoint = autocompletionConfig.apiEndpoint.endsWith('/v1') 
        ? autocompletionConfig.apiEndpoint 
        : autocompletionConfig.apiEndpoint.endsWith('/') 
          ? `${autocompletionConfig.apiEndpoint}v1` 
          : `${autocompletionConfig.apiEndpoint}/v1`;
      
      const response = await fetch(`${testEndpoint}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(autocompletionConfig.apiKey && { 'Authorization': `Bearer ${autocompletionConfig.apiKey}` })
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      setAutocompletionConnectionStatus({
        connected: true,
        error: null,
        testing: false,
        url: testEndpoint
      });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Autocompletion connection test failed (endpoint: ${testEndpoint}):`, message);

      const userMessage = message.includes('Unable to reach model endpoint')
        ? `${message} Ensure Pointer backend or local AI adapter is running.`
        : message;

      setAutocompletionConnectionStatus({
        connected: false,
        error: userMessage,
        testing: false,
        url: testEndpoint
      });
    }
  }, [modelAssignments.autocompletion, modelConfigs]);

  // Test autocompletion connection when model assignments change
  useEffect(() => {
    if (modelAssignments.autocompletion && modelConfigs[modelAssignments.autocompletion]) {
      testAutocompletionConnection();
    }
  }, [modelAssignments.autocompletion, modelConfigs, testAutocompletionConnection]);

  // Test autocompletion connection only when settings are opened (not on every config change)
  // Removed aggressive re-test on every modelConfigs change to reduce noise

  // Add function to handle password visibility toggle
  const handleTogglePasswordVisibility = async () => {
    const newVisibility = !showPassword;
    setShowPassword(newVisibility);
    try {
      await fetch('http://localhost:23816/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: modelConfigs[activeTab].apiKey || '',
          openai_api_endpoint: modelConfigs[activeTab].apiEndpoint || '',
          show_password: newVisibility,
        }),
      });
    } catch {
      // Ignore — not critical
    }
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }}>
      <div className="modal-content" style={{ 
        width: '1100px', 
        height: '80vh',
        maxWidth: '95vw',
        maxHeight: '90vh',
        background: 'var(--bg-primary)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>
            Settings
            {hasUnsavedChanges && 
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--accent-color)', 
                marginLeft: '10px',
                fontWeight: 'normal'
              }}>
                (unsaved changes)
              </span>
            }
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '18px',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Main content with sidebar */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
        }}>
          {/* Sidebar */}
          <div style={{ 
            width: '200px', 
            borderRight: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}>
            {settingsCategories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  background: activeCategory === category.id ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                Loading settings...
              </div>
            ) : (
              <>
                {/* LLM Models */}
                {activeCategory === 'models' && (
                  <div>
                    {/* Tabs for model configurations */}
                    <div style={{ 
                      display: 'flex', 
                      borderBottom: '1px solid var(--border-primary)',
                      marginBottom: '16px',
                      overflowX: 'auto',
                    }}>
                      {Object.keys(modelConfigs).map(modelId => (
                        <button
                          key={modelId}
                          onClick={() => setActiveTab(modelId)}
                          style={{
                            padding: '8px 16px',
                            background: activeTab === modelId ? 'var(--bg-hover)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === modelId ? '2px solid var(--accent-color)' : 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {modelConfigs[modelId].name || modelId}
                        </button>
                      ))}
                      <button
                        onClick={addModelConfig}
                        style={{
                          padding: '8px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        + Add Model
                      </button>
                    </div>

                    {/* Model assignments section */}
                    <CollapsibleSection title="Model Assignments" defaultOpen={false}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Assign specific models to different purposes in the application
                      </p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Chat Model
                          </label>
                          <select
                            value={modelAssignments.chat}
                            onChange={(e) => setModelAssignments(prev => ({
                              ...prev,
                              chat: e.target.value
                            }))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {Object.keys(modelConfigs).map(modelId => (
                              <option key={modelId} value={modelId}>
                                {modelConfigs[modelId].name || modelId}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Insert Model
                          </label>
                          <select
                            value={modelAssignments.insert}
                            onChange={(e) => setModelAssignments(prev => ({
                              ...prev,
                              insert: e.target.value
                            }))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {Object.keys(modelConfigs).map(modelId => (
                              <option key={modelId} value={modelId}>
                                {modelConfigs[modelId].name || modelId}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Autocompletion Model
                          </label>
                          <select
                            value={modelAssignments.autocompletion}
                            onChange={(e) => setModelAssignments(prev => ({
                              ...prev,
                              autocompletion: e.target.value
                            }))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {Object.keys(modelConfigs).map(modelId => (
                              <option key={modelId} value={modelId}>
                                {modelConfigs[modelId].name || modelId}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Summary Model
                          </label>
                          <select
                            value={modelAssignments.summary}
                            onChange={(e) => setModelAssignments(prev => ({
                              ...prev,
                              summary: e.target.value
                            }))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {Object.keys(modelConfigs).map(modelId => (
                              <option key={modelId} value={modelId}>
                                {modelConfigs[modelId].name || modelId}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Agent Model
                          </label>
                          <select
                            value={modelAssignments.agent}
                            onChange={(e) => setModelAssignments(prev => ({
                              ...prev,
                              agent: e.target.value
                            }))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {Object.keys(modelConfigs).map(modelId => (
                              <option key={modelId} value={modelId}>
                                {modelConfigs[modelId].name || modelId}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* Model configuration form */}
                    {activeTab && modelConfigs[activeTab] && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '16px' }}>
                            Model Configuration
                          </h3>
                          {activeTab !== 'default' && (
                            <button
                              onClick={() => deleteModelConfig(activeTab)}
                              style={{
                                padding: '4px 8px',
                                background: 'var(--error-color)',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              Display Name
            </label>
            <input
              type="text"
                              value={modelConfigs[activeTab].name}
                              onChange={(e) => handleModelConfigChange(activeTab, 'name', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              Model ID
                            </label>
                            <div style={{ position: 'relative' }} className="model-id-container">
                              <input
                                type="text"
                                value={modelConfigs[activeTab].id || ''}
                                onChange={(e) => handleModelIdInputChange(activeTab, 'id', e.target.value)}
                                onFocus={() => handleModelIdFocus(activeTab)}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                }}
                                placeholder="Enter the model ID"
                              />
                              {isLoadingModels && !autocompletionConnectionStatus.error && (
                                <div style={{
                                  position: 'absolute',
                                  right: '8px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '12px',
                                  color: 'var(--text-secondary)'
                                }}>
                                  Loading...
                                </div>
                              )}
                              {autocompletionConnectionStatus.error && modelAssignments.autocompletion === activeTab && (
                                <div style={{
                                  position: 'absolute',
                                  right: '8px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '16px',
                                  color: 'red',
                                  fontWeight: 'bold',
                                  cursor: 'help'
                                }}
                                title={`${autocompletionConnectionStatus.error}${autocompletionConnectionStatus.url ? `\nURL: ${autocompletionConnectionStatus.url}/models` : ''}`}
                                >
                                  !
                                </div>
                              )}
                              {showModelSuggestions && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  zIndex: 1000,
                                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                }}>
                                  {filteredModels.map((model, index) => (
                                    <div
                                      key={model.id}
                                      onClick={() => selectModelSuggestion(activeTab, model)}
                                      style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        borderBottom: index < filteredModels.length - 1 ? '1px solid var(--border-primary)' : 'none'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'var(--bg-primary)';
                                      }}
                                    >
                                      <div style={{ fontWeight: 'bold' }}>{model.id}</div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {model.owned_by}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {autocompletionConnectionStatus.testing && modelAssignments.autocompletion === activeTab && (
                                <span>Testing connection...</span>
                              )}
                              {autocompletionConnectionStatus.error && modelAssignments.autocompletion === activeTab && (
                                <span style={{ color: '#ff4d4f' }}>Error: {autocompletionConnectionStatus.error}</span>
                              )}
                              {availableModelsError && modelAssignments.autocompletion === activeTab && (
                                <span style={{ color: '#ffa500' }}>Model discovery warning: {availableModelsError}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              Model Provider
                            </label>
                            <select
                              value={modelConfigs[activeTab].modelProvider || 'local'}
                              onChange={async (e) => {
                                const newProvider = e.target.value;
                                handleModelConfigChange(activeTab, 'modelProvider', newProvider);
                                
                                // Auto-discover models when provider changes (if no model ID is set)
                                if (newProvider && modelConfigs[activeTab].apiEndpoint && 
                                    (!modelConfigs[activeTab].id || modelConfigs[activeTab].id.trim() === '')) {
                                  await fetchAvailableModels(modelConfigs[activeTab].apiEndpoint, modelConfigs[activeTab].apiKey);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '8px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <option value="local">Local (LMStudio/Ollama)</option>
                              <option value="ollama-embedded">Embedded (no install needed)</option>
                              <option value="openai">OpenAI</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              API Endpoint
                            </label>
                            <input
                              type="text"
                              value={modelConfigs[activeTab].apiEndpoint || ''}
                              onChange={async (e) => {
                                const newEndpoint = e.target.value;
                                handleModelConfigChange(activeTab, 'apiEndpoint', newEndpoint);
                                
                                // Auto-discover models when endpoint changes (if no model ID is set)
                                if (newEndpoint && (!modelConfigs[activeTab].id || modelConfigs[activeTab].id.trim() === '')) {
                                  await fetchAvailableModels(newEndpoint, modelConfigs[activeTab].apiKey);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '8px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                              }}
                              placeholder={modelConfigs[activeTab].modelProvider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:1234/v1'}
                            />
                          </div>
                        </div>

                        {modelConfigs[activeTab].modelProvider === 'openai' && (
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              OpenAI API Key
                            </label>
                            <PasswordInput
                              value={modelConfigs[activeTab].apiKey || ''}
                              onChange={async (value) => {
                                handleModelConfigChange(activeTab, 'apiKey', value);
                                
                                // Auto-discover models when API key changes (if no model ID is set)
                                if (value && modelConfigs[activeTab].apiEndpoint && 
                                    (!modelConfigs[activeTab].id || modelConfigs[activeTab].id.trim() === '')) {
                                  await fetchAvailableModels(modelConfigs[activeTab].apiEndpoint, value);
                                }
                              }}
                              placeholder="Enter your OpenAI API key"
                              showPassword={showPassword}
                              onToggleVisibility={handleTogglePasswordVisibility}
                            />
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              Your API key will be stored securely and only used for API calls
                            </p>
                          </div>
                        )}

                        {modelConfigs[activeTab].modelProvider === 'ollama-embedded' && (
                          <div style={{
                            padding: '16px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: 'var(--text-primary)' }}>
                              Embedded AI Model
                            </div>
                            <EmbeddedModelSetup
                              onModelReady={(modelId) => {
                                handleModelConfigChange(activeTab, 'id', modelId);
                                handleModelConfigChange(activeTab, 'apiEndpoint', 'http://127.0.0.1:23816/api/llama');
                              }}
                            />
                          </div>
                        )}


                        <CollapsibleSection title="Advanced Parameters" defaultOpen={false}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              Temperature ({modelConfigs[activeTab].temperature})
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
                              value={modelConfigs[activeTab].temperature}
                              onChange={(e) => handleModelConfigChange(activeTab, 'temperature', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                              Top P ({modelConfigs[activeTab].topP})
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={modelConfigs[activeTab].topP}
                              onChange={(e) => handleModelConfigChange(activeTab, 'topP', parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                        </CollapsibleSection>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Prompts Settings */}
                {activeCategory === 'prompts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>AI Prompts Configuration</h3>
                    
                    {/* Essential Prompts Section */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Essential Prompts
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Enhanced System Message */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Enhanced System Message</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('enhancedSystemMessage')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.enhancedSystemMessage}
                              onChange={(e) => handlePromptsSettingChange('enhancedSystemMessage', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Concise Chat System */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Concise Chat System</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('conciseChatSystem')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.conciseChatSystem}
                              onChange={(e) => handlePromptsSettingChange('conciseChatSystem', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Advanced Agent System */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Advanced Agent System</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('advancedAgentSystem')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.advancedAgentSystem}
                              onChange={(e) => handlePromptsSettingChange('advancedAgentSystem', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Refresh Knowledge System */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Refresh Knowledge System</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('refreshKnowledgeSystem')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.refreshKnowledgeSystem}
                              onChange={(e) => handlePromptsSettingChange('refreshKnowledgeSystem', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Core Traits */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Core Traits</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('coreTraits')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.coreTraits}
                              onChange={(e) => handlePromptsSettingChange('coreTraits', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* File Operations */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>File Operations</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('fileOperations')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.fileOperations}
                              onChange={(e) => handlePromptsSettingChange('fileOperations', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Exploration Protocol */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Exploration Protocol</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('explorationProtocol')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.explorationProtocol}
                              onChange={(e) => handlePromptsSettingChange('explorationProtocol', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Enhanced Capabilities */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Enhanced Capabilities</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('enhancedCapabilities')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.enhancedCapabilities}
                              onChange={(e) => handlePromptsSettingChange('enhancedCapabilities', e.target.checked)}
                            />
                          </div>
                        </div>

                        {/* Communication Excellence */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Communication Excellence</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleEditPrompt('communicationExcellence')}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-secondary)', 
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '3px'
                              }}
                              title="Edit prompt content"
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={promptsSettings.communicationExcellence}
                              onChange={(e) => handlePromptsSettingChange('communicationExcellence', e.target.checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Rules Section */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          Rules
                        </h4>
                        <button
                          onClick={addCustomRule}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          + Add Rule
                        </button>
                      </div>
                      
                      {promptsSettings.customRules.length === 0 ? (
                        <div style={{ 
                          padding: '20px', 
                          textAlign: 'center', 
                          color: 'var(--text-secondary)', 
                          fontSize: '13px',
                          background: 'var(--bg-primary)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          No custom rules yet. Click "Add Rule" to create one.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {promptsSettings.customRules.map((rule) => (
                            <div key={rule.id} style={{ 
                              padding: '12px', 
                              background: 'var(--bg-primary)', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-primary)' 
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <input
                                  type="text"
                                  value={rule.name}
                                  onChange={(e) => handleCustomRuleChange(rule.id, 'name', e.target.value)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    flex: 1,
                                    outline: 'none'
                                  }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={() => handleEditRule(rule.id)}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: 'var(--text-secondary)', 
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: '3px'
                                    }}
                                    title="Edit rule content"
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={(e) => handleCustomRuleChange(rule.id, 'enabled', e.target.checked)}
                                  />
                                  <button
                                    onClick={() => deleteCustomRule(rule.id)}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: 'var(--error-color)', 
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: '3px'
                                    }}
                                    title="Delete rule"
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3,6 5,6 21,6"/>
                                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                      <line x1="10" y1="11" x2="10" y2="17"/>
                                      <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={rule.content}
                                onChange={(e) => handleCustomRuleChange(rule.id, 'content', e.target.value)}
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  padding: '8px',
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontSize: '12px',
                                  resize: 'vertical',
                                  fontFamily: 'monospace'
                                }}
                                placeholder="Enter your custom rule content..."
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Prompt Modal */}
                {editingPrompt && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}>
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '8px',
                      padding: '20px',
                      width: '80%',
                      maxWidth: '600px',
                      maxHeight: '80%',
                      overflow: 'auto'
                    }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                        Edit {editingPrompt.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </h3>
                      <textarea
                        style={{
                          width: '100%',
                          height: '300px',
                          padding: '12px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                        placeholder="Enter prompt content..."
                        defaultValue="This prompt content is currently read-only. In a future update, this will allow editing the actual prompt content."
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setEditingPrompt(null)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Rule Modal */}
                {editingRule && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}>
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '8px',
                      padding: '20px',
                      width: '80%',
                      maxWidth: '600px',
                      maxHeight: '80%',
                      overflow: 'auto'
                    }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                        Edit Rule Content
                      </h3>
                      <textarea
                        style={{
                          width: '100%',
                          height: '300px',
                          padding: '12px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                        placeholder="Enter rule content..."
                        defaultValue={promptsSettings.customRules.find(r => r.id === editingRule)?.content || ''}
                        onChange={(e) => {
                          const rule = promptsSettings.customRules.find(r => r.id === editingRule);
                          if (rule) {
                            handleCustomRuleChange(editingRule, 'content', e.target.value);
                          }
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingRule(null)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setEditingRule(null)}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Theme Settings */}
                {activeCategory === 'theme' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Theme & Editor</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Colors, animations, fonts and editor behavior</p>
                      </div>
                      <button onClick={() => setIsThemeLibraryVisible(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--accent-color)', background: 'transparent', color: 'var(--accent-color)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="15" y="2" width="7" height="7" rx="1"/><rect x="2" y="15" width="7" height="7" rx="1"/><rect x="15" y="15" width="7" height="7" rx="1"/></svg>
                        Browse Themes
                      </button>
                      <button onClick={() => setIsThemeEditorVisible(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Edit Theme
                      </button>
                    </div>

                    <ThemeLibraryModal isVisible={isThemeLibraryVisible} onClose={() => setIsThemeLibraryVisible(false)} onSelectTheme={(theme) => { setThemeSettings(theme); setHasUnsavedChanges(true); }} />

                    {/* Theme Editor */}
                    <ThemeEditor
                      isVisible={isThemeEditorVisible}
                      theme={themeSettings}
                      onClose={() => setIsThemeEditorVisible(false)}
                      onChange={(t) => { setThemeSettings(t); setHasUnsavedChanges(true); }}
                    />

                    {/* Quick preset + export/import */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select onChange={(e) => { const t = presetThemes[e.target.value]; if (t) { setThemeSettings(t); setHasUnsavedChanges(true); } }} style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                        <option value="">Quick-select preset…</option>
                        {Object.keys(presetThemes).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={() => { const blob = new Blob([JSON.stringify({ theme: themeSettings, editor: editorSettings }, null, 2)], { type: 'application/json' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pointer-theme.json' }); document.body.appendChild(a); a.click(); document.body.removeChild(a); }} style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Export</button>
                      <label style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Import
                        <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const imp = JSON.parse(ev.target?.result as string); if (!imp.theme) throw new Error(); setThemeSettings(imp.theme); if (imp.editor) setEditorSettings((p: any) => ({ ...p, ...imp.editor })); setHasUnsavedChanges(true); } catch { alert('Invalid theme file'); } e.target.value = ''; }; reader.readAsText(file); }} />
                      </label>
                    </div>

                    {/* ── UI Colors ── */}
                    <CollapsibleSection title="UI Colors" defaultOpen={true}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <h5 style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Backgrounds</h5>
                          {([['bgPrimary','Primary','--bg-primary'],['bgSecondary','Secondary','--bg-secondary'],['bgTertiary','Tertiary','--bg-tertiary'],['bgSelected','Selected','--bg-selected'],['bgHover','Hover','--bg-hover']] as const).map(([k,l,v]) => (
                            <ColorInput key={k} label={l} value={themeSettings.customColors[k] || ''} onChange={val => handleCustomColorChange(k, val)} variable={v} />
                          ))}
                        </div>
                        <div>
                          <h5 style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Text & Accent</h5>
                          {([['textPrimary','Primary Text','--text-primary'],['textSecondary','Secondary Text','--text-secondary'],['accentColor','Accent','--accent-color'],['accentHover','Accent Hover','--accent-hover'],['errorColor','Error','--error-color'],['inlineCodeColor','Inline Code','--inline-code-color']] as const).map(([k,l,v]) => (
                            <ColorInput key={k} label={l} value={themeSettings.customColors[k] || ''} onChange={val => handleCustomColorChange(k, val)} variable={v} />
                          ))}
                        </div>
                        <div>
                          <h5 style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bars & Borders</h5>
                          {([['titlebarBg','Titlebar','--titlebar-bg'],['statusbarBg','Statusbar BG','--statusbar-bg'],['statusbarFg','Statusbar Text','--statusbar-fg'],['activityBarBg','Activity Bar BG','--activity-bar-bg'],['activityBarFg','Activity Bar Icons','--activity-bar-fg'],['borderColor','Border','--border-color']] as const).map(([k,l,v]) => (
                            <ColorInput key={k} label={l} value={themeSettings.customColors[k] || ''} onChange={val => handleCustomColorChange(k, val)} variable={v} />
                          ))}
                        </div>
                        <div>
                          <h5 style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Explorer</h5>
                          {([['explorerFolderFg','Folder','--explorer-folder-fg'],['explorerFolderExpandedFg','Folder (open)','--explorer-folder-expanded-fg'],['explorerFileFg','File','--explorer-file-fg']] as const).map(([k,l,v]) => (
                            <ColorInput key={k} label={l} value={themeSettings.customColors[k] || ''} onChange={val => handleCustomColorChange(k, val)} variable={v} />
                          ))}
                          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, border: '1px dashed var(--border-primary)', background: 'var(--bg-secondary)' }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Generate palette from accent color</p>
                            <button onClick={applyAutoPaletteFromAccent} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent-color)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Auto-generate</button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── File Extension Colors ── */}
                    <CollapsibleSection title="File Extension Colors" defaultOpen={false}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>Override colors for specific file extensions in the explorer.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: 8 }}>
                        {Object.entries(themeSettings.customColors.customFileExtensions || {}).map(([ext, color], i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                            <input type="text" value={ext} onChange={e => { const ne = e.target.value.toLowerCase().trim(); if (!ne || ne === ext) return; const exts = { ...(themeSettings.customColors.customFileExtensions || {}) }; const col = exts[ext]; delete exts[ext]; exts[ne] = col; handleThemeSettingChange('customColors', { ...themeSettings.customColors, customFileExtensions: exts }); }} style={{ width: 60, padding: '2px 6px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11 }} />
                            <input type="color" value={color} onChange={e => { const exts = { ...(themeSettings.customColors.customFileExtensions || {}), [ext]: e.target.value }; handleThemeSettingChange('customColors', { ...themeSettings.customColors, customFileExtensions: exts }); }} style={{ width: 24, height: 24, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                            <span style={{ flex: 1, fontSize: 11, color, fontFamily: 'monospace' }}>.{ext}</span>
                            <button onClick={() => { const exts = { ...(themeSettings.customColors.customFileExtensions || {}) }; delete exts[ext]; handleThemeSettingChange('customColors', { ...themeSettings.customColors, customFileExtensions: exts }); }} style={{ background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => { const exts = { ...(themeSettings.customColors.customFileExtensions || {}), 'ext': '#ffffff' }; handleThemeSettingChange('customColors', { ...themeSettings.customColors, customFileExtensions: exts }); }} style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>+ Add Extension</button>
                    </CollapsibleSection>

                    {/* ── Terminal Colors ── */}
                    <CollapsibleSection title="Terminal Colors" defaultOpen={false}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Full 16-color ANSI palette for the integrated terminal. Leave blank to auto-derive from theme.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <ColorInput label="Background"    value={themeSettings.customColors.terminalBg || ''} onChange={v => handleCustomColorChange('terminalBg', v)} variable="--terminal-bg" />
                          <ColorInput label="Foreground"    value={themeSettings.customColors.terminalFg || ''} onChange={v => handleCustomColorChange('terminalFg', v)} variable="--terminal-fg" />
                          <ColorInput label="Cursor"        value={themeSettings.customColors.terminalCursor || ''} onChange={v => handleCustomColorChange('terminalCursor', v)} variable="--terminal-cursor" />
                          <ColorInput label="Black"         value={themeSettings.customColors.terminalBlack || ''} onChange={v => handleCustomColorChange('terminalBlack', v)} variable="--terminal-black" />
                          <ColorInput label="Bright Black"  value={themeSettings.customColors.terminalBrightBlack || ''} onChange={v => handleCustomColorChange('terminalBrightBlack', v)} variable="--terminal-bright-black" />
                          <ColorInput label="Red"           value={themeSettings.customColors.terminalRed || ''} onChange={v => handleCustomColorChange('terminalRed', v)} variable="--terminal-red" />
                          <ColorInput label="Bright Red"    value={themeSettings.customColors.terminalBrightRed || ''} onChange={v => handleCustomColorChange('terminalBrightRed', v)} variable="--terminal-bright-red" />
                          <ColorInput label="Green"         value={themeSettings.customColors.terminalGreen || ''} onChange={v => handleCustomColorChange('terminalGreen', v)} variable="--terminal-green" />
                          <ColorInput label="Bright Green"  value={themeSettings.customColors.terminalBrightGreen || ''} onChange={v => handleCustomColorChange('terminalBrightGreen', v)} variable="--terminal-bright-green" />
                        </div>
                        <div>
                          <ColorInput label="Yellow"         value={themeSettings.customColors.terminalYellow || ''} onChange={v => handleCustomColorChange('terminalYellow', v)} variable="--terminal-yellow" />
                          <ColorInput label="Bright Yellow"  value={themeSettings.customColors.terminalBrightYellow || ''} onChange={v => handleCustomColorChange('terminalBrightYellow', v)} variable="--terminal-bright-yellow" />
                          <ColorInput label="Blue"           value={themeSettings.customColors.terminalBlue || ''} onChange={v => handleCustomColorChange('terminalBlue', v)} variable="--terminal-blue" />
                          <ColorInput label="Bright Blue"    value={themeSettings.customColors.terminalBrightBlue || ''} onChange={v => handleCustomColorChange('terminalBrightBlue', v)} variable="--terminal-bright-blue" />
                          <ColorInput label="Magenta"        value={themeSettings.customColors.terminalMagenta || ''} onChange={v => handleCustomColorChange('terminalMagenta', v)} variable="--terminal-magenta" />
                          <ColorInput label="Bright Magenta" value={themeSettings.customColors.terminalBrightMagenta || ''} onChange={v => handleCustomColorChange('terminalBrightMagenta', v)} variable="--terminal-bright-magenta" />
                          <ColorInput label="Cyan"           value={themeSettings.customColors.terminalCyan || ''} onChange={v => handleCustomColorChange('terminalCyan', v)} variable="--terminal-cyan" />
                          <ColorInput label="Bright Cyan"    value={themeSettings.customColors.terminalBrightCyan || ''} onChange={v => handleCustomColorChange('terminalBrightCyan', v)} variable="--terminal-bright-cyan" />
                          <ColorInput label="White"          value={themeSettings.customColors.terminalWhite || ''} onChange={v => handleCustomColorChange('terminalWhite', v)} variable="--terminal-white" />
                          <ColorInput label="Bright White"   value={themeSettings.customColors.terminalBrightWhite || ''} onChange={v => handleCustomColorChange('terminalBrightWhite', v)} variable="--terminal-bright-white" />
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── Chat UI Colors ── */}
                    <CollapsibleSection title="Chat UI Colors" defaultOpen={false}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <ColorInput label="Chat Background"     value={themeSettings.customColors.chatBg || ''} onChange={v => handleCustomColorChange('chatBg', v)} variable="--chat-bg" />
                          <ColorInput label="User Bubble BG"      value={themeSettings.customColors.chatUserBubbleBg || ''} onChange={v => handleCustomColorChange('chatUserBubbleBg', v)} variable="--chat-user-bubble-bg" />
                          <ColorInput label="User Bubble Text"    value={themeSettings.customColors.chatUserBubbleFg || ''} onChange={v => handleCustomColorChange('chatUserBubbleFg', v)} variable="--chat-user-bubble-fg" />
                          <ColorInput label="AI Bubble BG"        value={themeSettings.customColors.chatAiBubbleBg || ''} onChange={v => handleCustomColorChange('chatAiBubbleBg', v)} variable="--chat-ai-bubble-bg" />
                        </div>
                        <div>
                          <ColorInput label="AI Bubble Text"      value={themeSettings.customColors.chatAiBubbleFg || ''} onChange={v => handleCustomColorChange('chatAiBubbleFg', v)} variable="--chat-ai-bubble-fg" />
                          <ColorInput label="Input Background"    value={themeSettings.customColors.chatInputBg || ''} onChange={v => handleCustomColorChange('chatInputBg', v)} variable="--chat-input-bg" />
                          <ColorInput label="Input Border"        value={themeSettings.customColors.chatInputBorder || ''} onChange={v => handleCustomColorChange('chatInputBorder', v)} variable="--chat-input-border" />
                          <ColorInput label="Code Block BG"       value={themeSettings.customColors.chatCodeBlockBg || ''} onChange={v => handleCustomColorChange('chatCodeBlockBg', v)} variable="--chat-code-block-bg" />
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── Diff & Git Colors ── */}
                    <CollapsibleSection title="Diff & Git Colors" defaultOpen={false}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <ColorInput label="Added Background"    value={themeSettings.customColors.diffAddedBg || ''} onChange={v => handleCustomColorChange('diffAddedBg', v)} variable="--diff-added-bg" />
                          <ColorInput label="Removed Background"  value={themeSettings.customColors.diffRemovedBg || ''} onChange={v => handleCustomColorChange('diffRemovedBg', v)} variable="--diff-removed-bg" />
                          <ColorInput label="Modified Background" value={themeSettings.customColors.diffModifiedBg || ''} onChange={v => handleCustomColorChange('diffModifiedBg', v)} variable="--diff-modified-bg" />
                        </div>
                        <div>
                          <ColorInput label="Added Gutter"        value={themeSettings.customColors.diffAddedGutter || ''} onChange={v => handleCustomColorChange('diffAddedGutter', v)} variable="--diff-added-gutter" />
                          <ColorInput label="Removed Gutter"      value={themeSettings.customColors.diffRemovedGutter || ''} onChange={v => handleCustomColorChange('diffRemovedGutter', v)} variable="--diff-removed-gutter" />
                          <ColorInput label="Modified Gutter"     value={themeSettings.customColors.diffModifiedGutter || ''} onChange={v => handleCustomColorChange('diffModifiedGutter', v)} variable="--diff-modified-gutter" />
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── UI Shape & Typography ── */}
                    <CollapsibleSection title="UI Shape & Typography" defaultOpen={false}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <h5 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Border Radius</h5>
                          {[
                            { label: 'Small (buttons, inputs)', key: 'borderRadius', cssVar: '--border-radius', placeholder: '4px' },
                            { label: 'Large (modals, panels)', key: 'borderRadiusLg', cssVar: '--border-radius-lg', placeholder: '8px' },
                          ].map(({ label, key, cssVar, placeholder }) => (
                            <div key={key} style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>{label}</label>
                              <input
                                type="text"
                                placeholder={placeholder}
                                value={(themeSettings.customColors as any)[key] || ''}
                                onChange={e => handleCustomColorChange(key as any, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}
                              />
                            </div>
                          ))}
                          <h5 style={{ margin: '12px 0 8px 0', fontSize: '13px' }}>Scrollbar</h5>
                          {[
                            { label: 'Width', key: 'scrollbarWidth', placeholder: '8px' },
                          ].map(({ label, key, placeholder }) => (
                            <div key={key} style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>{label}</label>
                              <input
                                type="text"
                                placeholder={placeholder}
                                value={(themeSettings.customColors as any)[key] || ''}
                                onChange={e => handleCustomColorChange(key as any, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}
                              />
                            </div>
                          ))}
                          <ColorInput label="Scrollbar Thumb"       value={themeSettings.customColors.scrollbarThumb || ''} onChange={v => handleCustomColorChange('scrollbarThumb', v)} variable="--scrollbar-thumb" />
                          <ColorInput label="Scrollbar Thumb Hover" value={themeSettings.customColors.scrollbarThumbHover || ''} onChange={v => handleCustomColorChange('scrollbarThumbHover', v)} variable="--scrollbar-thumb-hover" />
                          <ColorInput label="Scrollbar Track"       value={themeSettings.customColors.scrollbarTrack || ''} onChange={v => handleCustomColorChange('scrollbarTrack', v)} variable="--scrollbar-track" />
                        </div>
                        <div>
                          <h5 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Typography</h5>
                          {[
                            { label: 'UI Font', key: 'fontUi', placeholder: 'Segoe UI, system-ui, sans-serif' },
                            { label: 'Mono Font', key: 'fontMono', placeholder: 'Consolas, Courier New, monospace' },
                            { label: 'UI Font Size', key: 'fontSizeUi', placeholder: '13px' },
                          ].map(({ label, key, placeholder }) => (
                            <div key={key} style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>{label}</label>
                              <input
                                type="text"
                                placeholder={placeholder}
                                value={(themeSettings.customColors as any)[key] || ''}
                                onChange={e => handleCustomColorChange(key as any, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}
                              />
                            </div>
                          ))}
                          <h5 style={{ margin: '12px 0 8px 0', fontSize: '13px' }}>Shadows</h5>
                          {[
                            { label: 'Small Shadow', key: 'shadowSm', placeholder: '0 2px 6px rgba(0,0,0,0.25)' },
                            { label: 'Medium Shadow', key: 'shadowMd', placeholder: '0 4px 16px rgba(0,0,0,0.35)' },
                            { label: 'Large Shadow', key: 'shadowLg', placeholder: '0 8px 32px rgba(0,0,0,0.5)' },
                          ].map(({ label, key, placeholder }) => (
                            <div key={key} style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>{label}</label>
                              <input
                                type="text"
                                placeholder={placeholder}
                                value={(themeSettings.customColors as any)[key] || ''}
                                onChange={e => handleCustomColorChange(key as any, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── Editor Behavior ── */}
                    <CollapsibleSection title="Editor Behavior" defaultOpen={false}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Font Family
                          </label>
                              <input
                                type="text"
                            value={editorSettings.fontFamily}
                            onChange={(e) => handleEditorSettingChange('fontFamily', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Font Size
                          </label>
                          <input
                            type="number"
                            value={editorSettings.fontSize}
                            onChange={(e) => handleEditorSettingChange('fontSize', parseInt(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Line Height
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editorSettings.lineHeight}
                            onChange={(e) => handleEditorSettingChange('lineHeight', parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                            Tab Size
                          </label>
                          <input
                            type="number"
                            value={editorSettings.tabSize}
                            onChange={(e) => handleEditorSettingChange('tabSize', parseInt(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={editorSettings.insertSpaces}
                              onChange={(e) => handleEditorSettingChange('insertSpaces', e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Insert spaces instead of tabs
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={editorSettings.wordWrap}
                              onChange={(e) => handleEditorSettingChange('wordWrap', e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Word Wrap
                          </label>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={editorSettings.formatOnSave}
                              onChange={(e) => handleEditorSettingChange('formatOnSave', e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Format on Save
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={editorSettings.autoSave}
                              onChange={(e) => handleEditorSettingChange('autoSave', e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Auto Save
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={editorSettings.autoAcceptGhostText}
                              onChange={(e) => handleEditorSettingChange('autoAcceptGhostText', e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Auto-accept ghost text
                          </label>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── Monaco Editor Colors ── */}
                    <CollapsibleSection title="Monaco Editor Colors" defaultOpen={false}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {/* Basic Editor Colors */}
                        <div>
                          <h5 style={{ margin: '8px 0', fontSize: '13px' }}>Basic Colors</h5>
                          <ColorInput
                            label="Editor Background"
                            value={themeSettings.editorColors["editor.background"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.background", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Editor Foreground"
                            value={themeSettings.editorColors["editor.foreground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.foreground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Line Numbers"
                            value={themeSettings.editorColors["editorLineNumber.foreground"] || ''}
                            onChange={(value) => handleEditorColorChange("editorLineNumber.foreground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Active Line Number"
                            value={themeSettings.editorColors["editorLineNumber.activeForeground"] || ''}
                            onChange={(value) => handleEditorColorChange("editorLineNumber.activeForeground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Cursor Foreground"
                            value={themeSettings.editorColors["editorCursor.foreground"] || ''}
                            onChange={(value) => handleEditorColorChange("editorCursor.foreground", value)}
                            variable=""
                          />
                        </div>

                        {/* Selection Colors */}
                        <div>
                          <h5 style={{ margin: '8px 0', fontSize: '13px' }}>Selection</h5>
                          <ColorInput
                            label="Selection Background"
                            value={themeSettings.editorColors["editor.selectionBackground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.selectionBackground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Selection Foreground"
                            value={themeSettings.editorColors["editor.selectionForeground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.selectionForeground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Selection Highlight Background"
                            value={themeSettings.editorColors["editor.selectionHighlightBackground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.selectionHighlightBackground", value)}
                            variable=""
                          />
                        </div>

                        {/* Line Highlight Colors */}
                        <div>
                          <h5 style={{ margin: '8px 0', fontSize: '13px' }}>Current Line</h5>
                          <ColorInput
                            label="Line Highlight Background"
                            value={themeSettings.editorColors["editor.lineHighlightBackground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.lineHighlightBackground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Line Highlight Border"
                            value={themeSettings.editorColors["editor.lineHighlightBorder"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.lineHighlightBorder", value)}
                            variable=""
                          />
                        </div>

                        {/* Find Match Colors */}
                        <div>
                          <h5 style={{ margin: '8px 0', fontSize: '13px' }}>Find Matches</h5>
                          <ColorInput
                            label="Find Match Background"
                            value={themeSettings.editorColors["editor.findMatchBackground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.findMatchBackground", value)}
                            variable=""
                          />
                          <ColorInput
                            label="Find Match Highlight"
                            value={themeSettings.editorColors["editor.findMatchHighlightBackground"] || ''}
                            onChange={(value) => handleEditorColorChange("editor.findMatchHighlightBackground", value)}
                            variable=""
                          />
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* ── Syntax Highlighting ── */}
                    <CollapsibleSection title="Syntax Highlighting" defaultOpen={false}>
                      
                      <div>
                        {(themeSettings.tokenColors || []).map((tokenColor, index) => (
                          <div key={index} style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            marginBottom: '12px',
                            padding: '8px', 
                            border: '1px solid var(--border-primary)',
                            borderRadius: '4px'
                          }}>
                            <div style={{ flex: 2 }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Token</label>
                              <input
                                type="text"
                                value={tokenColor.token}
                                onChange={(e) => handleTokenColorChange(index, 'token', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px',
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontSize: '12px'
                                }}
                                placeholder="e.g., keyword, comment, string"
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Foreground</label>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                  type="color"
                                  value={tokenColor.foreground || '#ffffff'}
                                  onChange={(e) => handleTokenColorChange(index, 'foreground', e.target.value)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    padding: '0',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                />
                                <input
                                  type="text"
                                  value={tokenColor.foreground || ''}
                                  onChange={(e) => handleTokenColorChange(index, 'foreground', e.target.value)}
                                  style={{
                                    width: '100%',
                                    marginLeft: '4px',
                                    padding: '6px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px'
                                  }}
                                  placeholder="#RRGGBB"
                                />
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Style</label>
                              <select
                                value={tokenColor.fontStyle || ''}
                                onChange={(e) => handleTokenColorChange(index, 'fontStyle', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px',
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontSize: '12px'
                                }}
                              >
                                <option value="">Normal</option>
                                <option value="italic">Italic</option>
                                <option value="bold">Bold</option>
                                <option value="underline">Underline</option>
                                <option value="bold italic">Bold Italic</option>
                              </select>
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'flex-end', 
                              paddingBottom: '6px' 
                            }}>
                              <button
                                onClick={() => removeTokenColor(index)}
                                style={{
                                  background: 'var(--error-color)',
                                  border: 'none',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          onClick={addTokenColor}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--accent-color)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            width: 'fit-content',
                            marginTop: '8px'
                          }}
                        >
                          Add Token Rule
                        </button>
                      </div>
                    </CollapsibleSection>

                    {/* Reset button */}
                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => {
                          if (confirm('Are you sure you want to reset all theme and editor settings to defaults?')) {
                            setEditorSettings({
                              fontFamily: 'monospace',
                              fontSize: 13,
                              lineHeight: 1.5,
                              tabSize: 2,
                              insertSpaces: true,
                              wordWrap: true,
                              rulers: [],
                              formatOnSave: true,
                              formatOnPaste: false,
                              autoSave: true,
                              autoAcceptGhostText: false,
                            });
                            
                            setThemeSettings({
                              name: 'vs-dark',
                              customColors: {
                                bgPrimary: '',
                                bgSecondary: '',
                                bgTertiary: '',
                                bgSelected: '',
                                bgHover: '',
                                bgAccent: '',
                                textPrimary: '',
                                textSecondary: '',
                                borderColor: '',
                                borderPrimary: '',
                                accentColor: '',
                                accentHover: '',
                                errorColor: '',
                                titlebarBg: '',
                                statusbarBg: '',
                                statusbarFg: '',
                                activityBarBg: '',
                                activityBarFg: '',
                                inlineCodeColor: '#cc0000',
                              },
                              editorColors: {
                                "editor.background": "#1e1e1e",
                                "editor.foreground": "#d4d4d4",
                                "editorLineNumber.foreground": "#858585",
                                "editorLineNumber.activeForeground": "#c6c6c6",
                                "editorCursor.foreground": "#d4d4d4",
                                "editor.selectionBackground": "#264f78",
                                "editor.lineHighlightBackground": "#2d2d2d50",
                              },
                              tokenColors: [
                                { token: 'keyword', foreground: '#569CD6', fontStyle: 'bold' },
                                { token: 'comment', foreground: '#6A9955', fontStyle: 'italic' },
                                { token: 'string', foreground: '#CE9178' },
                                { token: 'number', foreground: '#B5CEA8' },
                                { token: 'operator', foreground: '#D4D4D4' },
                                { token: 'type', foreground: '#4EC9B0' },
                                { token: 'function', foreground: '#DCDCAA' },
                                { token: 'variable', foreground: '#9CDCFE' }
                              ]
                            });

                            setHasUnsavedChanges(true);
                                  }
                                }}
                                style={{
                            padding: '8px 16px',
                            background: 'var(--accent-color)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          }}
                        >
                        <span>Reset Theme & Editor Settings</span>
                        </button>
                    </div>
                  </div>
                )}

                {/* Keybindings */}
                {activeCategory === 'keybindings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Keyboard Shortcuts</h3>
                    
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Custom keyboard shortcuts will be available in a future update.
                    </p>

                    <div style={{ marginTop: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Default Shortcuts</h4>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                      }}>
                        <thead>
                          <tr>
                            <th style={{ 
                              textAlign: 'left', 
                              padding: '8px', 
                              borderBottom: '1px solid var(--border-primary)',
                            }}>Command</th>
                            <th style={{ 
                              textAlign: 'left', 
                              padding: '8px', 
                              borderBottom: '1px solid var(--border-primary)',
                            }}>Shortcut</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Save File</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Ctrl+S</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Toggle Sidebar</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Ctrl+B</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Close Tab</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Ctrl+W</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Toggle LLM Chat</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Ctrl+I</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>Open Settings</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-secondary)' }}>{navigator.platform.indexOf('Mac') > -1 ? '⌘,' : 'Ctrl+,'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Terminal Settings */}
                {activeCategory === 'terminal' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Terminal Settings</h3>

                    {/* Appearance */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Appearance</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Font Family</label>
                          <input
                            type="text"
                            value={advanced.terminalFontFamily ?? 'Consolas, "Cascadia Code", "Courier New", monospace'}
                            onChange={e => handleAdvancedSettingChange('terminalFontFamily', e.target.value)}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Font Size</label>
                          <input
                            type="number"
                            min={8} max={32}
                            value={advanced.terminalFontSize ?? 13}
                            onChange={e => handleAdvancedSettingChange('terminalFontSize', parseInt(e.target.value))}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Line Height</label>
                          <input
                            type="number"
                            min={1} max={3} step={0.1}
                            value={advanced.terminalLineHeight ?? 1.3}
                            onChange={e => handleAdvancedSettingChange('terminalLineHeight', parseFloat(e.target.value))}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Scrollback Lines</label>
                          <input
                            type="number"
                            min={100} max={50000} step={100}
                            value={advanced.terminalScrollback ?? 5000}
                            onChange={e => handleAdvancedSettingChange('terminalScrollback', parseInt(e.target.value))}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.terminalCursorBlink ?? true} onChange={e => handleAdvancedSettingChange('terminalCursorBlink', e.target.checked)} />
                          Cursor Blink
                        </label>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Cursor Style</label>
                          <select
                            value={advanced.terminalCursorStyle ?? 'block'}
                            onChange={e => handleAdvancedSettingChange('terminalCursorStyle', e.target.value)}
                            style={{ width: '100%', padding: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          >
                            <option value="block">Block</option>
                            <option value="underline">Underline</option>
                            <option value="bar">Bar</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Shell */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Shell</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Default Shell</label>
                          <input
                            type="text"
                            value={advanced.terminalShell ?? ''}
                            onChange={e => handleAdvancedSettingChange('terminalShell', e.target.value)}
                            placeholder={navigator.platform.includes('Win') ? 'powershell.exe' : '/bin/zsh'}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Leave empty to use system default</p>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Default Height (px)</label>
                          <input
                            type="number"
                            min={100} max={800}
                            value={advanced.terminalDefaultHeight ?? 260}
                            onChange={e => handleAdvancedSettingChange('terminalDefaultHeight', parseInt(e.target.value))}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.terminalCopyOnSelect ?? false} onChange={e => handleAdvancedSettingChange('terminalCopyOnSelect', e.target.checked)} />
                          Copy on Select
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.terminalRightClickPaste ?? true} onChange={e => handleAdvancedSettingChange('terminalRightClickPaste', e.target.checked)} />
                          Right-click to Paste
                        </label>
                      </div>
                    </div>

                    {/* Colors */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Terminal Colors</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        {[
                          { key: 'terminalBg', label: 'Background', default: '#141414' },
                          { key: 'terminalFg', label: 'Foreground', default: '#cccccc' },
                          { key: 'terminalCursor', label: 'Cursor', default: '#ffffff' },
                          { key: 'terminalRed', label: 'Red', default: '#f85149' },
                          { key: 'terminalGreen', label: 'Green', default: '#3fb950' },
                          { key: 'terminalYellow', label: 'Yellow', default: '#d29922' },
                          { key: 'terminalBlue', label: 'Blue', default: '#58a6ff' },
                          { key: 'terminalMagenta', label: 'Magenta', default: '#bc8cff' },
                          { key: 'terminalCyan', label: 'Cyan', default: '#39c5cf' },
                        ].map(({ key, label, default: def }) => (
                          <div key={key}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="color"
                                value={advanced[key] ?? def}
                                onChange={e => handleAdvancedSettingChange(key, e.target.value)}
                                style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-primary)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                              />
                              <input
                                type="text"
                                value={advanced[key] ?? def}
                                onChange={e => handleAdvancedSettingChange(key, e.target.value)}
                                style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const defaults: Record<string, string> = { terminalBg: '#141414', terminalFg: '#cccccc', terminalCursor: '#ffffff', terminalRed: '#f85149', terminalGreen: '#3fb950', terminalYellow: '#d29922', terminalBlue: '#58a6ff', terminalMagenta: '#bc8cff', terminalCyan: '#39c5cf' };
                          Object.entries(defaults).forEach(([k, v]) => handleAdvancedSettingChange(k, v));
                        }}
                        style={{ marginTop: '12px', padding: '6px 12px', background: 'var(--bg-accent)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  </div>
                )}

                {/* Advanced Settings */}
                {activeCategory === 'advanced' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Advanced Settings</h3>

                    {/* Window & UI */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Window & UI</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Title Bar Format</label>
                          <input
                            type="text"
                            value={advanced.titleFormat || '{filename} - {workspace} - Pointer'}
                            onChange={e => handleAdvancedSettingChange('titleFormat', e.target.value)}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                            placeholder="{filename} - {workspace} - Pointer"
                          />
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Placeholders: <code>{'{filename}'}</code> <code>{'{workspace}'}</code>
                          </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.smoothScrolling ?? true} onChange={e => handleAdvancedSettingChange('smoothScrolling', e.target.checked)} />
                            Smooth Scrolling
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.showStatusBar ?? true} onChange={e => handleAdvancedSettingChange('showStatusBar', e.target.checked)} />
                            Show Status Bar
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.showBreadcrumbs ?? true} onChange={e => handleAdvancedSettingChange('showBreadcrumbs', e.target.checked)} />
                            Show Breadcrumbs
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.showMinimap ?? false} onChange={e => handleAdvancedSettingChange('showMinimap', e.target.checked)} />
                            Show Minimap
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.confirmOnClose ?? false} onChange={e => handleAdvancedSettingChange('confirmOnClose', e.target.checked)} />
                            Confirm on Close
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={advanced.restoreLastSession ?? true} onChange={e => handleAdvancedSettingChange('restoreLastSession', e.target.checked)} />
                            Restore Last Session
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* File Handling */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>File Handling</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.trimTrailingWhitespace ?? false} onChange={e => handleAdvancedSettingChange('trimTrailingWhitespace', e.target.checked)} />
                          Trim Trailing Whitespace on Save
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.insertFinalNewline ?? true} onChange={e => handleAdvancedSettingChange('insertFinalNewline', e.target.checked)} />
                          Insert Final Newline
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.detectIndentation ?? true} onChange={e => handleAdvancedSettingChange('detectIndentation', e.target.checked)} />
                          Auto-detect Indentation
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.showHiddenFiles ?? false} onChange={e => handleAdvancedSettingChange('showHiddenFiles', e.target.checked)} />
                          Show Hidden Files
                        </label>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Excluded File Patterns</label>
                        <input
                          type="text"
                          value={advanced.excludePatterns ?? 'node_modules, .git, dist, build'}
                          onChange={e => handleAdvancedSettingChange('excludePatterns', e.target.value)}
                          style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                          placeholder="node_modules, .git, dist"
                        />
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Comma-separated patterns to hide in the file explorer</p>
                      </div>
                    </div>

                    {/* Performance */}
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px' }}>Performance</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.hardwareAcceleration ?? true} onChange={e => handleAdvancedSettingChange('hardwareAcceleration', e.target.checked)} />
                          Hardware Acceleration
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={advanced.backgroundThrottling ?? false} onChange={e => handleAdvancedSettingChange('backgroundThrottling', e.target.checked)} />
                          Background Throttling
                        </label>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Max File Size to Open (MB)</label>
                        <input
                          type="number"
                          min={1} max={100}
                          value={advanced.maxFileSizeMb ?? 10}
                          onChange={e => handleAdvancedSettingChange('maxFileSizeMb', parseInt(e.target.value))}
                          style={{ width: '120px', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div style={{ padding: '16px', background: 'rgba(248,81,73,0.05)', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f85149' }}>Danger Zone</h4>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to reset ALL settings to default values? This cannot be undone.')) {
                            setModelConfigs({ 'default': { ...defaultConfig } });
                            setModelAssignments({...defaultModelAssignments});
                            setEditorSettings({ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5, tabSize: 2, insertSpaces: true, wordWrap: true, rulers: [], formatOnSave: true, formatOnPaste: false, autoSave: true, autoAcceptGhostText: false });
                            setThemeSettings({ name: 'vs-dark', customColors: { bgPrimary: '', bgSecondary: '', bgTertiary: '', bgSelected: '', bgHover: '', bgAccent: '', textPrimary: '', textSecondary: '', borderColor: '', borderPrimary: '', accentColor: '', accentHover: '', errorColor: '', titlebarBg: '', statusbarBg: '', statusbarFg: '', activityBarBg: '', activityBarFg: '', inlineCodeColor: '#cc0000' }, editorColors: { "editor.background": "#1e1e1e", "editor.foreground": "#d4d4d4", "editorLineNumber.foreground": "#858585", "editorLineNumber.activeForeground": "#c6c6c6", "editorCursor.foreground": "#d4d4d4", "editor.selectionBackground": "#264f78", "editor.lineHighlightBackground": "#2d2d2d50" }, tokenColors: [{ token: 'keyword', foreground: '#569CD6', fontStyle: 'bold' }, { token: 'comment', foreground: '#6A9955', fontStyle: 'italic' }, { token: 'string', foreground: '#CE9178' }, { token: 'number', foreground: '#B5CEA8' }, { token: 'operator', foreground: '#D4D4D4' }, { token: 'type', foreground: '#4EC9B0' }, { token: 'function', foreground: '#DCDCAA' }, { token: 'variable', foreground: '#9CDCFE' }] });
                            setDiscordRpcSettings({...defaultDiscordRpcSettings});
                            setAdvanced({});
                            setHasUnsavedChanges(true);
                          }
                        }}
                        style={{ padding: '8px 16px', background: '#f85149', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '13px' }}
                      >
                        Reset All Settings to Defaults
                      </button>
                    </div>
                  </div>
                )}

                {/* Discord RPC Settings */}
                {activeCategory === 'discord' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Discord Rich Presence Settings</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Show your friends what you're working on in Pointer with Discord Rich Presence integration.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                        <input
                          type="checkbox"
                          checked={discordRpcSettings.enabled}
                          onChange={(e) => handleDiscordRpcSettingChange('enabled', e.target.checked)}
                          style={{ marginRight: '8px' }}
                        />
                        Enable Discord Rich Presence
                      </label>
                    </div>
                    
                    <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Text Customization</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Details Line:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.details}
                            onChange={(e) => handleDiscordRpcSettingChange('details', e.target.value)}
                            placeholder="Editing {file}"
                            style={{
                              width: '100%',
                              padding: '8px',
                                  background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Primary line shown in your Discord status
                          </p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            State Line:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.state}
                            onChange={(e) => handleDiscordRpcSettingChange('state', e.target.value)}
                            placeholder="Workspace: {workspace}"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Secondary line shown in your Discord status
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Large Image Key:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.largeImageKey}
                            onChange={(e) => handleDiscordRpcSettingChange('largeImageKey', e.target.value)}
                            placeholder="pointer_logo"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Asset key for the large image
                          </p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Small Image Key:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.smallImageKey}
                            onChange={(e) => handleDiscordRpcSettingChange('smallImageKey', e.target.value)}
                            placeholder="code"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Asset key for the small image (use "code" for automatic language icons)
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Large Image Text:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.largeImageText}
                            onChange={(e) => handleDiscordRpcSettingChange('largeImageText', e.target.value)}
                            placeholder="Pointer - Code Editor"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Text shown when hovering the large icon
                          </p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Small Image Text:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.smallImageText}
                            onChange={(e) => handleDiscordRpcSettingChange('smallImageText', e.target.value)}
                            placeholder="{languageId} | Line {line}:{column}"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Text shown when hovering the small icon
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Button Customization</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Add up to two buttons that will appear on your Discord status. URLs must be complete and point to public websites.
                      </p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Button 1 Text:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.button1Label || ''}
                            onChange={(e) => handleDiscordRpcSettingChange('button1Label', e.target.value)}
                            placeholder="Download Pointer"
                            maxLength={32}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Max 32 characters (required for button to work)
                          </p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Button 1 URL:
                          </label>
                          <input
                            type="url"
                            value={discordRpcSettings.button1Url || ''}
                            onChange={(e) => handleDiscordRpcSettingChange('button1Url', e.target.value)}
                            placeholder="https://pointr.sh"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: !discordRpcSettings.button1Url || 
                                     (discordRpcSettings.button1Url.startsWith('http://') || discordRpcSettings.button1Url.startsWith('https://'))
                                ? 'var(--text-primary)' 
                                : 'var(--error-color)',
                            }}
                          />
                          <p style={{ 
                            fontSize: '12px', 
                            color: !discordRpcSettings.button1Url || 
                                   (discordRpcSettings.button1Url.startsWith('http://') || discordRpcSettings.button1Url.startsWith('https://'))
                              ? 'var(--text-secondary)'
                              : 'var(--error-color)',
                            marginTop: '4px' 
                          }}>
                            {!discordRpcSettings.button1Url || 
                             (discordRpcSettings.button1Url.startsWith('http://') || discordRpcSettings.button1Url.startsWith('https://'))
                              ? 'Must start with https:// or http://'
                              : 'ERROR: URL must start with https:// or http://'}
                          </p>
                      </div>
                      
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Button 2 Text:
                          </label>
                          <input
                            type="text"
                            value={discordRpcSettings.button2Label || ''}
                            onChange={(e) => handleDiscordRpcSettingChange('button2Label', e.target.value)}
                            placeholder="Join Discord"
                            maxLength={32}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Max 32 characters (required for button to work)
                          </p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                            Button 2 URL:
                          </label>
                          <input
                            type="url"
                            value={discordRpcSettings.button2Url || ''}
                            onChange={(e) => handleDiscordRpcSettingChange('button2Url', e.target.value)}
                            placeholder="https://discord.gg/coming-soon"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '4px',
                              color: !discordRpcSettings.button2Url || 
                                     (discordRpcSettings.button2Url.startsWith('http://') || discordRpcSettings.button2Url.startsWith('https://'))
                                ? 'var(--text-primary)' 
                                : 'var(--error-color)',
                            }}
                          />
                          <p style={{ 
                            fontSize: '12px', 
                            color: !discordRpcSettings.button2Url || 
                                   (discordRpcSettings.button2Url.startsWith('http://') || discordRpcSettings.button2Url.startsWith('https://'))
                              ? 'var(--text-secondary)'
                              : 'var(--error-color)',
                            marginTop: '4px' 
                          }}>
                            {!discordRpcSettings.button2Url || 
                             (discordRpcSettings.button2Url.startsWith('http://') || discordRpcSettings.button2Url.startsWith('https://'))
                              ? 'Must start with https:// or http://'
                              : 'ERROR: URL must start with https:// or http://'}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '8px', 
                        borderRadius: '4px', 
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                          <strong>Important:</strong> For buttons to work, you must:
                        </p>
                        <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', paddingLeft: '16px' }}>
                          <li>Include complete URLs (with https://)</li>
                          <li>Make sure both label and URL are filled for each button</li>
                          <li>Ensure URLs point to public websites (not localhost)</li>
                          <li>Keep button text under 32 characters</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div style={{ 
                      background: 'var(--bg-primary)', 
                      padding: '12px', 
                      borderRadius: '6px',
                      border: '1px solid var(--border-primary)',
                      marginTop: '8px'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Available Placeholders</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                        <div><code>{'{file}'}</code> - Current file name</div>
                        <div><code>{'{workspace}'}</code> - Workspace name</div>
                        <div><code>{'{line}'}</code> - Cursor line</div>
                        <div><code>{'{column}'}</code> - Cursor column</div>
                        <div><code>{'{languageId}'}</code> - File language</div>
                        <div><code>{'{fileSize}'}</code> - File size</div>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Note: Elapsed time is now automatically included by Discord and cannot be disabled.
                      </p>
                    </div>
                  </div>
                )}

                {/* GitHub Settings */}
                {activeCategory === 'github' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>GitHub Integration</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Connect your GitHub account to enable repository cloning and other GitHub features.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                        <input
                          type="checkbox"
                          checked={isAuthenticated}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleLogin();
                            } else {
                              handleLogout();
                            }
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        Connect GitHub Account
                      </label>
                    </div>
                    
                    <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Connection Status</h4>
                      
                      {isAuthenticated ? (
                        <div style={{ 
                          padding: '12px', 
                          background: 'var(--bg-hover)', 
                          borderRadius: '4px',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)'
                        }}>
                          ✓ Successfully connected to GitHub
                        </div>
                      ) : (
                        <div style={{ 
                          padding: '12px', 
                          background: 'var(--bg-hover)', 
                          borderRadius: '4px',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-secondary)'
                        }}>
                          Not connected to GitHub
                        </div>
                      )}
                    </div>
                    
                    <div style={{ 
                      background: 'var(--bg-primary)', 
                      padding: '12px', 
                      borderRadius: '6px',
                      border: '1px solid var(--border-primary)',
                      marginTop: '8px'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Available Features</h4>
                      <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '16px' }}>
                        <li>Clone repositories</li>
                        <li>List your repositories</li>
                        <li>Push and pull changes</li>
                        <li>Manage repository settings</li>
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer with save/cancel buttons */}
        <div style={{ 
          padding: '16px 20px',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={saveAllSettings}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              background: isLoading ? 'var(--bg-secondary)' : 
                        hasUnsavedChanges ? 'var(--accent-color)' : 'var(--bg-hover)',
              color: isLoading ? 'var(--text-secondary)' : 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {isLoading ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
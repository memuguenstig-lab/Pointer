import React, { useEffect, useState } from 'react';
import { RecentProjectsService } from '../services/RecentProjectsService';
import { llamaService, LlamaStatus, LlamaModel, DownloadState } from '../services/LlamaService';
import { FileSystemService } from '../services/FileSystemService';
import { PathConfig } from '../config/paths';

interface WelcomeDashboardProps {
  onOpenFolder: () => void;
  onCloneRepository: () => void;
  onOpenSpecificFolder: (path: string) => void;
  onOpenSettings: () => void;
}

const BUILTIN_RECOMMENDED = [
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    description: 'Fast, lightweight model for code autocomplete and chat.',
    size: '1.0 GB',
  },
  {
    id: 'qwen2.5-coder-3b',
    name: 'Qwen 2.5 Coder 3B',
    description: 'A stronger coder model that balances speed and quality.',
    size: '2.0 GB',
  }
];

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  onOpenFolder,
  onCloneRepository,
  onOpenSpecificFolder,
  onOpenSettings,
}) => {
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [modelProvider, setModelProvider] = useState<string>('ollama-embedded');
  const [llamaStatus, setLlamaStatus] = useState<LlamaStatus | null>(null);
  const [llamaModels, setLlamaModels] = useState<LlamaModel[]>([]);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);

  // Load state and data
  useEffect(() => {
    // Recent projects
    setRecentProjects(RecentProjectsService.getRecentProjects());

    const loadProvider = async () => {
      let provider = 'ollama-embedded';
      const savedConfig = localStorage.getItem('modelConfig');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          if (parsed.modelProvider) {
            provider = parsed.modelProvider;
          }
        } catch (_) {}
      }

      try {
        const settingsPath = PathConfig.getActiveSettingsPath();
        const result = await FileSystemService.readSettingsFiles(settingsPath);
        if (result && result.success && result.settings) {
          const chatModelId = result.settings.modelAssignments?.chat || 'default';
          const chatModelConfig = result.settings.models?.[chatModelId];
          if (chatModelConfig?.modelProvider) {
            provider = chatModelConfig.modelProvider;
          }
        }
      } catch (err) {
        console.warn('Failed to load model provider from settings file:', err);
      }
      setModelProvider(provider);
    };

    loadProvider();

    // Llama status and models
    fetchLlamaStatus();
    fetchLlamaModels();

    // Poll status / download state every 1.5s
    const timer = setInterval(() => {
      fetchLlamaStatus();
      fetchDownloadStatus();
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  const fetchLlamaStatus = async () => {
    try {
      const status = await llamaService.getStatus();
      setLlamaStatus(status);
    } catch (_) {}
  };

  const fetchLlamaModels = async () => {
    try {
      const models = await llamaService.getModels();
      setLlamaModels(models);
    } catch (_) {}
  };

  const fetchDownloadStatus = async () => {
    try {
      const dl = await llamaService.getDownloadStatus();
      setDownloadState(dl);
    } catch (_) {}
  };

  const handleDownload = async (modelId: string) => {
    try {
      await llamaService.downloadModel(modelId);
      fetchDownloadStatus();
    } catch (err: any) {
      alert(`Download start failed: ${err.message}`);
    }
  };

  const handleLoadModel = async (modelId: string) => {
    setLoadingModelId(modelId);
    try {
      await llamaService.loadModel(modelId);
      fetchLlamaStatus();
    } catch (err: any) {
      alert(`Failed to load model: ${err.message}`);
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await llamaService.cancelDownload(modelId);
      fetchDownloadStatus();
    } catch (_) {}
  };

  // Get active models (downloaded)
  const downloadedModels = llamaModels.filter(m => m.downloaded);
  const hasModels = downloadedModels.length > 0;
  const activeModel = llamaStatus?.loadedModelId 
    ? llamaModels.find(m => m.id === llamaStatus.loadedModelId) 
    : null;

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflowY: 'auto',
      padding: '40px',
      gap: '40px',
    }}>
      {/* LEFT HALF: AI model & downloader */}
      <div style={{
        flex: 1.2,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '560px',
        borderRight: '1px solid var(--border-primary)',
        paddingRight: '40px',
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤖</span> Local & Embedded AI
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Shadow runs AI models directly on your hardware for 100% offline, private code generation.
          </p>
        </div>

        {/* Provider switch status */}
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Selected Provider: </span>
            <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
              {modelProvider === 'ollama-embedded' ? 'Embedded (node-llama-cpp)' : modelProvider}
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Change
          </button>
        </div>

        {/* Active download progress (Shown persistently regardless of selected provider) */}
        {downloadState && downloadState.active && (
          <div style={{
            padding: '14px',
            borderRadius: '8px',
            background: 'rgba(240, 136, 62, 0.08)',
            border: '1px dashed #f0883e',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ color: '#f0883e' }}>Downloading model ({downloadState.modelId})...</span>
              <span>{downloadState.percent}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadState.percent}%`, height: '100%', background: '#f0883e', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Speed: {(downloadState.speed / 1024 / 1024).toFixed(1)} MB/s</span>
              <button
                onClick={() => handleCancelDownload(downloadState.modelId || '')}
                style={{ background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Embedded setup UI */}
        {modelProvider === 'ollama-embedded' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* If models are installed */}
            {hasModels ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  Downloaded Models
                </div>
                {downloadedModels.map(model => {
                  const isCurrent = activeModel?.id === model.id;
                  const isLoading = loadingModelId === model.id;

                  return (
                    <div key={model.id} style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: isCurrent ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{model.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Size: {model.sizeGb != null ? model.sizeGb.toFixed(1) : '?'} GB | Context: {model.contextLength ?? '?'} tokens
                        </div>
                      </div>
                      <button
                        disabled={isCurrent || isLoading}
                        onClick={() => handleLoadModel(model.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '4px',
                          background: isCurrent ? 'var(--bg-primary)' : 'var(--accent-color)',
                          color: isCurrent ? 'var(--text-secondary)' : '#fff',
                          border: isCurrent ? '1px solid var(--border-color)' : 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: isCurrent ? 'default' : 'pointer',
                        }}
                      >
                        {isLoading ? 'Loading...' : isCurrent ? 'Active' : 'Load Model'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(210, 153, 34, 0.08)',
                border: '1px solid rgba(210, 153, 34, 0.25)',
                color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                  <span>⚠️</span> No model installed
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                  Download an embedded model here to unlock full offline AI autocomplete and chat capabilities instantly.
                </p>
              </div>
            )}

            {/* Quick model downloader directory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                Available Models to Download
              </div>
              {BUILTIN_RECOMMENDED.map(item => {
                const isDownloaded = downloadedModels.some(m => m.id === item.id);
                const isDownloading = downloadState?.active && downloadState.modelId === item.id;

                return (
                  <div key={item.id} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>{item.description}</div>
                      </div>
                      <span style={{ fontSize: '10px', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {item.size}
                      </span>
                    </div>

                    {!isDownloaded && (
                      <button
                        disabled={isDownloading || (downloadState?.active && !isDownloading)}
                        onClick={() => handleDownload(item.id)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '4px',
                          background: 'var(--accent-color)',
                          color: '#fff',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: (isDownloading || (downloadState?.active && !isDownloading)) ? 'default' : 'pointer',
                          alignSelf: 'flex-start',
                          opacity: (isDownloading || (downloadState?.active && !isDownloading)) ? 0.6 : 1,
                        }}
                      >
                        {isDownloading ? 'Downloading...' : 'Download and Install'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            To configure local models via Ollama/LM Studio or enter API keys for OpenAI/Claude/Grok, please open settings.
          </div>
        )}
      </div>

      {/* RIGHT HALF: Recent Projects, News / Patch Notes */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}>
        {/* Recent Projects List */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }}>Recent Projects</h3>
          {recentProjects.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentProjects.map(proj => (
                <button
                  key={proj.path}
                  onClick={() => onOpenSpecificFolder(proj.path)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{proj.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{proj.path}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '16px',
              borderRadius: '6px',
              background: 'var(--bg-secondary)',
              border: '1px dashed var(--border-color)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              No projects opened recently. Click Open Folder to get started!
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={onOpenFolder}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                background: 'var(--accent-color)',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Folder...
            </button>
            <button
              onClick={onCloneRepository}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clone Git Repo...
            </button>
          </div>
        </div>

        {/* Patch Notes / News */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }}>News & Updates</h3>
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-color)', fontSize: '13px', marginBottom: '8px' }}>
              pointer Release Notes (v1.5.1)
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>
                <strong>AI Chat Theme Control:</strong> The assistant can now generate, customize, and apply UI/editor themes dynamically when requested in the chat interface.
              </li>
              <li>
                <strong>Frosted Glass Mode:</strong> Toggle frosted glass backdrop blur overlays directly within the Theme customizer panel.
              </li>
              <li>
                <strong>Unified Terminal Pickers:</strong> Upgraded the terminal color settings to use standard, premium color inputs with interactive slider consistency.
              </li>
              <li>
                <strong>Robust Background Shutdown:</strong> Exiting the desktop app from the system tray now automatically halts all background node and dev server instances gracefully.
              </li>
              <li>
                <strong>Polished GitHub Authentication:</strong> Clean connect/disconnect action buttons replace the legacy checkbox control.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeDashboard;

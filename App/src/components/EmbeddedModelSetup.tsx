import React, { useEffect, useState, useRef } from 'react';
import llamaService, { LlamaModel, DownloadState } from '../services/LlamaService';

interface Props {
  onModelReady: (modelId: string) => void;
}

export const EmbeddedModelSetup: React.FC<Props> = ({ onModelReady }) => {
  const [models, setModels] = useState<LlamaModel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadModels();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadModels() {
    try {
      const list = await llamaService.getModels();
      setModels(list);
      // Auto-select recommended or first downloaded
      const loaded = list.find(m => m.loaded);
      const downloaded = list.find(m => m.downloaded);
      const recommended = list.find(m => m.recommended);
      setSelected(loaded?.id || downloaded?.id || recommended?.id || list[0]?.id || null);

      // If a model is already loaded, notify parent
      if (loaded) onModelReady(loaded.id);
    } catch (e: any) {
      setError('Could not reach backend: ' + e.message);
    }
  }

  async function handleDownload() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      await llamaService.downloadModel(selected);
      // Poll download progress
      pollRef.current = setInterval(async () => {
        const state = await llamaService.getDownloadStatus();
        setDownloadState(state);
        if (!state.active) {
          clearInterval(pollRef.current!);
          setLoading(false);
          if (state.done && !state.error) {
            await loadModels();
          } else if (state.error) {
            setError('Download failed: ' + state.error);
          }
        }
      }, 500);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
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

  const selectedModel = models.find(m => m.id === selected);
  const isDownloaded = selectedModel?.downloaded ?? false;
  const isLoaded = selectedModel?.loaded ?? false;

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        Pointer can run AI models locally — no Ollama or LM Studio needed.
        Select a model to download and use directly.
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(248, 81, 73, 0.1)',
          border: '1px solid rgba(248, 81, 73, 0.3)',
          borderRadius: '4px',
          color: '#f85149',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Model list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {models.map(model => (
          <div
            key={model.id}
            onClick={() => setSelected(model.id)}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: `1px solid ${selected === model.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: selected === model.id ? 'rgba(14, 99, 156, 0.1)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {model.name}
              </span>
              {model.recommended && (
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(14, 99, 156, 0.2)',
                  color: 'var(--accent-color)',
                  border: '1px solid rgba(14, 99, 156, 0.3)',
                }}>
                  Recommended
                </span>
              )}
              {model.downloaded && (
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(40, 200, 64, 0.15)',
                  color: '#28c840',
                  border: '1px solid rgba(40, 200, 64, 0.3)',
                }}>
                  Downloaded
                </span>
              )}
              {model.loaded && (
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(40, 200, 64, 0.25)',
                  color: '#28c840',
                  border: '1px solid rgba(40, 200, 64, 0.4)',
                }}>
                  ● Active
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {model.description}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', opacity: 0.7 }}>
              ~{model.sizeGb} GB · {(model.contextLength / 1000).toFixed(0)}K context
            </div>
          </div>
        ))}
      </div>

      {/* Download progress */}
      {downloadState?.active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Downloading {downloadState.fileName}...</span>
            <span>
              {downloadState.bytesTotal > 0
                ? `${formatBytes(downloadState.bytesReceived)} / ${formatBytes(downloadState.bytesTotal)}`
                : formatBytes(downloadState.bytesReceived)}
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--bg-accent)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${downloadState.percent}%`,
              background: 'var(--accent-color)',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
            {downloadState.percent}%
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!isDownloaded && (
          <button
            onClick={handleDownload}
            disabled={loading || !selected}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {loading ? `Downloading... ${downloadState?.percent ?? 0}%` : `Download ${selectedModel?.name ?? 'Model'}`}
          </button>
        )}

        {isDownloaded && !isLoaded && (
          <button
            onClick={handleLoad}
            disabled={loadingModel}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loadingModel ? 'not-allowed' : 'pointer',
              opacity: loadingModel ? 0.7 : 1,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {loadingModel ? 'Loading into memory...' : `Load ${selectedModel?.name ?? 'Model'}`}
          </button>
        )}

        {isLoaded && (
          <div style={{
            flex: 1,
            padding: '8px 16px',
            background: 'rgba(40, 200, 64, 0.1)',
            border: '1px solid rgba(40, 200, 64, 0.3)',
            borderRadius: '4px',
            color: '#28c840',
            fontSize: '13px',
            textAlign: 'center',
          }}>
            ✓ Model active — ready to use
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedModelSetup;

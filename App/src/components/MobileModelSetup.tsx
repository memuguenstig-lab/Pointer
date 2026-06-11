/**
 * MobileModelSetup — WebLLM-based model download and management for mobile/web.
 * Replaces EmbeddedModelSetup on Capacitor/web builds.
 *
 * Models are downloaded once and cached in IndexedDB by WebLLM.
 */
import React, { useState, useEffect } from 'react';
import { mobileLLM, MOBILE_MODELS } from '../platform/mobileLLM';

interface Props {
  onModelReady: (modelId: string) => void;
}

const MobileModelSetup: React.FC<Props> = ({ onModelReady }) => {
  const [selected, setSelected] = useState<string>(MOBILE_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGPUSupported(mobileLLM.isSupported());
    const id = mobileLLM.getLoadedModelId();
    if (id) { setLoadedId(id); onModelReady(id); }
  }, []);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setProgressText('Initializing…');
    try {
      await mobileLLM.load(selected, (pct, text) => {
        setProgress(pct);
        setProgressText(text);
      });
      setLoadedId(selected);
      onModelReady(selected);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (webGPUSupported === false) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#f85149', background: 'rgba(248,81,73,0.1)', borderRadius: 6 }}>
        <strong>WebGPU not supported</strong> on this device/browser.
        Use an external AI provider (OpenAI, Anthropic, Grok) instead, or try Chrome on a modern device.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Run AI locally on your device — no internet required after download.
        Models are cached and load instantly after the first download.
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 4, color: '#f85149', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Model list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {MOBILE_MODELS.map(m => (
          <div
            key={m.id}
            onClick={() => !loading && setSelected(m.id)}
            style={{
              padding: '10px 12px', borderRadius: 6, cursor: 'shadowide',
              border: `1px solid ${selected === m.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: selected === m.id ? 'rgba(14,99,156,0.08)' : 'var(--bg-secondary)',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.name}</span>
              {m.recommended && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(14,99,156,0.2)', color: 'var(--accent-color)', border: '1px solid rgba(14,99,156,0.3)' }}>
                  ★ Recommended
                </span>
              )}
              {loadedId === m.id && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(63,185,80,0.2)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}>
                  ● Active
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>~{m.sizeGb} GB</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.description}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 4, background: 'var(--bg-accent)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent-color), #3fb950)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{progressText}</span>
            <span style={{ flexShrink: 0, marginLeft: 8 }}>{progress}%</span>
          </div>
        </div>
      )}

      {/* Load button */}
      {loadedId !== selected && (
        <button
          onClick={handleLoad}
          disabled={loading}
          style={{
            padding: '7px 14px', background: 'var(--accent-color)', color: '#fff',
            border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'shadowide',
            opacity: loading ? 0.7 : 1, fontSize: 12, fontWeight: 500,
          }}
        >
          {loading ? `Loading… ${progress}%` : `Load ${MOBILE_MODELS.find(m => m.id === selected)?.name ?? 'Model'}`}
        </button>
      )}

      {loadedId === selected && (
        <div style={{
          padding: '7px 14px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
          borderRadius: 4, color: '#3fb950', fontSize: 12, textAlign: 'center',
        }}>
          ✓ Model active — ready to use
        </div>
      )}
    </div>
  );
};

export default MobileModelSetup;

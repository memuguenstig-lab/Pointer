import React, { useEffect, useState, useCallback } from 'react';
import { PortEntry } from './types';

const PortsPanel: React.FC = () => {
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('http://localhost:23816/api/ports');
      if (r.ok) { const d = await r.json(); setPorts(d.ports || []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);

  return (
    <div style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '80px 80px 1fr 80px',
        padding: '4px 12px', borderBottom: '1px solid var(--border-color)',
        color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span>Port</span><span>PID</span><span>Protocol</span><span>Action</span>
      </div>
      {loading && ports.length === 0 && (
        <div style={{ padding: '12px', color: 'var(--text-secondary)', opacity: 0.5 }}>Scanning ports…</div>
      )}
      {!loading && ports.length === 0 && (
        <div style={{ padding: '12px', color: 'var(--text-secondary)', opacity: 0.5 }}>No listening ports found.</div>
      )}
      {ports.map(p => (
        <div key={p.port} style={{
          display: 'grid', gridTemplateColumns: '80px 80px 1fr 80px',
          padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          alignItems: 'center', color: 'var(--text-primary)',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: '#58a6ff', fontWeight: 600 }}>{p.port}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{p.pid}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{p.protocol}</span>
          <button
            onClick={() => window.open(`http://localhost:${p.port}`, '_blank')}
            title={`Open localhost:${p.port}`}
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 11, padding: '2px 6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >Open</button>
        </div>
      ))}
    </div>
  );
};

export default React.memo(PortsPanel);

import React, { useState } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

const CollapsibleSection: React.FC<Props> = ({ title, defaultOpen = true, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)', borderRadius: open ? '6px 6px 0 0' : '6px',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ flex: 1 }}>{title}</span>
        {badge != null && (
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
            background: 'var(--accent-color)', color: '#fff', fontWeight: 600,
          }}>{badge}</span>
        )}
      </button>
      {open && (
        <div style={{
          padding: '12px', background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)', borderTop: 'none',
          borderRadius: '0 0 6px 6px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;

import React from 'react';

interface Props { cwd: string; }

const TerminalBreadcrumb: React.FC<Props> = ({ cwd }) => {
  if (!cwd) return null;
  const normalized = cwd.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const isWinAbs = /^[A-Za-z]:/.test(normalized);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden',
      maxWidth: 400, flexShrink: 1, userSelect: 'none',
    }}>
      {!isWinAbs && <span style={{ opacity: 0.4, flexShrink: 0 }}>/</span>}
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{ opacity: 0.35, flexShrink: 0, padding: '0 1px' }}>/</span>
          )}
          <span
            title={parts.slice(0, i + 1).join('/')}
            style={{
              opacity: i === parts.length - 1 ? 1 : 0.45,
              fontWeight: i === parts.length - 1 ? 600 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: i === parts.length - 1 ? 180 : 72,
              cursor: 'default', borderRadius: 3, padding: '1px 3px',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default React.memo(TerminalBreadcrumb);

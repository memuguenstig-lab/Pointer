import React from 'react';

export type ActivityView = 'explorer' | 'git' | null;

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
  onToggleTerminal?: () => void;
  onOpenSettings?: () => void;
  terminalOpen?: boolean;
}

const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onViewChange,
  onToggleTerminal,
  onOpenSettings,
  terminalOpen,
}) => {
  const toggle = (view: ActivityView) => {
    onViewChange(activeView === view ? null : view);
  };

  const btn = (
    key: ActivityView | 'terminal' | 'settings',
    title: string,
    icon: React.ReactNode,
    badge?: number
  ) => {
    const isActive =
      key === 'terminal' ? !!terminalOpen :
      key === 'settings' ? false :
      activeView === key;

    return (
      <button
        key={String(key)}
        title={title}
        onClick={() => {
          if (key === 'terminal') onToggleTerminal?.();
          else if (key === 'settings') onOpenSettings?.();
          else toggle(key as ActivityView);
        }}
        style={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: 8,
          margin: '2px 4px',
          position: 'relative',
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
          outline: 'none',
        }}
        className="activity-bar-btn"
      >
        {icon}
        {badge != null && badge > 0 && (
          <span style={{
            position: 'absolute',
            bottom: 6,
            right: 4,
            background: 'var(--accent-color)',
            color: '#fff',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{
      width: 56,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      paddingTop: 4,
      paddingBottom: 8,
      zIndex: 10,
    }}>
      {/* Top icons */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

        {/* Explorer */}
        {btn('explorer', 'Explorer (Ctrl+B)',
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 4a1 1 0 0 1 1-1h5.172a1 1 0 0 1 .707.293l1.828 1.828A1 1 0 0 0 12.414 5.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7 13h10M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}

        {/* Git / Source Control */}
        {btn('git', 'Source Control',
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="18" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 8.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M8.5 6.5C11 6.5 15.5 6.5 15.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}

        {/* Terminal */}
        {btn('terminal', 'Terminal (Ctrl+`)',
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9l4 3.5L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}

      </div>

      {/* Bottom icons */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {btn('settings', 'Settings',
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )}
      </div>
    </div>
  );
};

export default ActivityBar;

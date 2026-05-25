/**
 * MobileHeader — replaces the Electron Titlebar on Capacitor/web builds.
 * Shows a simple top bar with the app name and key actions.
 */
import React, { useState } from 'react';
import logo from '../assets/logo.png';

interface MobileHeaderProps {
  currentFileName?: string;
  workspaceName?: string;
  onOpenFolder?: () => void;
  onToggleSidebar?: () => void;
  onToggleAgent?: () => void;
  isAgentVisible?: boolean;
  isSidebarVisible?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentFileName,
  workspaceName,
  onOpenFolder,
  onToggleSidebar,
  onToggleAgent,
  isAgentVisible,
  isSidebarVisible,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 48,
      background: 'var(--titlebar-bg, #3c3c3c)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 12px', gap: 10, flexShrink: 0,
      // Safe area for iOS notch
      paddingTop: 'env(safe-area-inset-top)',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      {/* Logo */}
      <img src={logo} alt="Pointer" style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0 }} />

      {/* File/workspace name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentFileName || workspaceName || 'Pointer'}
        </div>
        {workspaceName && currentFileName && (
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>{workspaceName}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {/* Open folder */}
        <button onClick={onOpenFolder} title="Open Folder"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        {/* Toggle sidebar */}
        <button onClick={onToggleSidebar} title="Toggle Sidebar"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSidebarVisible ? 'var(--accent-color)' : 'var(--text-secondary)', padding: 6, borderRadius: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
          </svg>
        </button>

        {/* Toggle AI chat */}
        <button onClick={onToggleAgent} title="Toggle AI"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAgentVisible ? 'var(--accent-color)' : 'var(--text-secondary)', padding: 6, borderRadius: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MobileHeader;

/**
 * PanelLayout — VSCode-style drag-and-drop panel reordering.
 *
 * Panels: 'sidebar' | 'editor' | 'chat'
 * The editor is always in the middle and cannot be dragged away,
 * but sidebar and chat can swap sides (left ↔ right).
 *
 * Usage:
 *   <PanelLayout
 *     sidebar={<Sidebar />}
 *     editor={<Editor />}
 *     chat={<Chat />}
 *     showSidebar={true}
 *     showChat={true}
 *   />
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

export type PanelSide = 'left' | 'right';

export interface PanelLayoutConfig {
  sidebarSide: PanelSide;   // which side the sidebar is on
  chatSide: PanelSide;      // which side the chat is on
}

const STORAGE_KEY = 'panelLayoutConfig';

function loadConfig(): PanelLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sidebarSide && parsed.chatSide) return parsed;
    }
  } catch (_) {}
  return { sidebarSide: 'left', chatSide: 'right' };
}

function saveConfig(cfg: PanelLayoutConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

interface Props {
  sidebar: React.ReactNode;
  editor: React.ReactNode;
  chat: React.ReactNode;
  showSidebar: boolean;
  showChat: boolean;
  onLayoutChange?: (cfg: PanelLayoutConfig) => void;
}

type DragTarget = 'sidebar' | 'chat' | null;

const DROP_ZONES = ['left', 'right'] as const;

export const PanelLayout: React.FC<Props> = ({
  sidebar,
  editor,
  chat,
  showSidebar,
  showChat,
  onLayoutChange,
}) => {
  const [config, setConfig] = useState<PanelLayoutConfig>(loadConfig);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [dropTarget, setDropTarget] = useState<PanelSide | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const updateConfig = useCallback((next: PanelLayoutConfig) => {
    setConfig(next);
    saveConfig(next);
    onLayoutChange?.(next);
  }, [onLayoutChange]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((panel: 'sidebar' | 'chat', e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panel);

    // Custom ghost
    const ghost = document.createElement('div');
    ghost.textContent = panel === 'sidebar' ? '⬜ Explorer' : '⬜ Agent';
    ghost.style.cssText = `
      position: fixed; top: -100px; left: -100px;
      padding: 6px 14px; border-radius: 6px;
      background: var(--accent-color, #0e639c); color: #fff;
      font-size: 12px; font-family: sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      pointer-events: none; z-index: 9999;
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 50, 20);
    dragGhostRef.current = ghost;

    setDragging(panel);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  const handleDrop = useCallback((side: PanelSide, e: React.DragEvent) => {
    e.preventDefault();
    const panel = e.dataTransfer.getData('text/plain') as 'sidebar' | 'chat';
    if (!panel) return;

    const next = { ...config };

    if (panel === 'sidebar') {
      // If chat is already on that side, swap
      if (config.chatSide === side) {
        next.chatSide = config.sidebarSide;
      }
      next.sidebarSide = side;
    } else {
      if (config.sidebarSide === side) {
        next.sidebarSide = config.chatSide;
      }
      next.chatSide = side;
    }

    updateConfig(next);
    setDragging(null);
    setDropTarget(null);
  }, [config, updateConfig]);

  const handleDragOver = useCallback((side: PanelSide, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(side);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderDropZone = (side: PanelSide) => {
    if (!dragging) return null;
    const isActive = dropTarget === side;
    return (
      <div
        onDrop={(e) => handleDrop(side, e)}
        onDragOver={(e) => handleDragOver(side, e)}
        onDragLeave={handleDragLeave}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [side]: 0,
          width: '80px',
          zIndex: 100,
          background: isActive
            ? 'rgba(14, 99, 156, 0.25)'
            : 'rgba(14, 99, 156, 0.08)',
          border: `2px dashed ${isActive ? 'var(--accent-color)' : 'rgba(14,99,156,0.3)'}`,
          borderRadius: '4px',
          transition: 'background 0.15s, border-color 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'all',
        }}
      >
        {isActive && (
          <span style={{
            fontSize: '11px',
            color: 'var(--accent-color)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Drop here
          </span>
        )}
      </div>
    );
  };

  const renderDragHandle = (panel: 'sidebar' | 'chat', label: string) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(panel, e)}
      onDragEnd={handleDragEnd}
      title={`Drag to move ${label} panel`}
      style={{
        position: 'absolute',
        top: '4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        height: '6px',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        transition: 'opacity 0.15s',
        zIndex: 10,
      }}
      className="panel-drag-handle"
    >
      {/* Thin drag line */}
      <div style={{
        width: '100%',
        height: '2px',
        borderRadius: '2px',
        background: 'var(--text-secondary)',
      }} />
    </div>
  );

  // ── Build panel order ──────────────────────────────────────────────────────

  const leftPanel = config.sidebarSide === 'left' ? 'sidebar' : 'chat';
  const rightPanel = config.chatSide === 'right' ? 'chat' : 'sidebar';

  const renderPanel = (panel: 'sidebar' | 'chat') => {
    if (panel === 'sidebar') {
      if (!showSidebar) return null;
      return (
        <div
          key="sidebar"
          style={{ position: 'relative', display: 'flex', height: '100%', overflow: 'hidden', minHeight: 0 }}
          className="panel-container"
        >
          {renderDragHandle('sidebar', 'Explorer')}
          {sidebar}
        </div>
      );
    } else {
      if (!showChat) return null;
      return (
        <div
          key="chat"
          style={{ position: 'relative', display: 'flex', height: '100%', overflow: 'hidden', minHeight: 0 }}
          className="panel-container"
        >
          {renderDragHandle('chat', 'Agent')}
          {chat}
        </div>
      );
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {/* Drop zones — only visible while dragging */}
      {renderDropZone('left')}
      {renderDropZone('right')}

      {/* Left panel */}
      {renderPanel(leftPanel)}

      {/* Editor — always center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        {editor}
      </div>

      {/* Right panel */}
      {renderPanel(rightPanel)}
    </div>
  );
};

export default PanelLayout;

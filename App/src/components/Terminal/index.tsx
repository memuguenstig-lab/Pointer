import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalProps, TerminalInstance, PanelTab, TAB_DEFS, actionBtn } from './types';
import { createInstance } from './utils';
import TerminalPane from './TerminalPane';
import TerminalBreadcrumb from './TerminalBreadcrumb';
import OutputPanel from './OutputPanel';
import PortsPanel from './PortsPanel';
import ProblemsPanel from './ProblemsPanel';

const Terminal: React.FC<TerminalProps> = ({ isVisible, errorCount = 0, warningCount = 0 }) => {
  const [instances, setInstances] = useState<TerminalInstance[]>(() => [createInstance()]);
  const [activeId, setActiveId] = useState<string>(() => instances[0].id);
  const [activeTab, setActiveTab] = useState<PanelTab>('terminal');
  const [height, setHeight] = useState(260);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const addTerminal = useCallback(() => {
    const inst = createInstance();
    setInstances(prev => [...prev, inst]);
    setActiveId(inst.id);
    setActiveTab('terminal');
  }, []);

  const closeTerminal = useCallback((id: string) => {
    setInstances(prev => {
      if (prev.length <= 1) return prev;
      const closed = prev.find(i => i.id === id);
      if (closed) {
        if (closed.reconnectTimer) clearTimeout(closed.reconnectTimer);
        closed.socket?.close();
        closed.xterm?.dispose();
      }
      return prev.filter(i => i.id !== id);
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = instances.filter(i => i.id !== id);
      return remaining[remaining.length - 1]?.id ?? instances[0].id;
    });
  }, [instances]);

  const handleCwdChange = useCallback((id: string, cwd: string) => {
    setInstances(prev => prev.map(i => i.id === id ? { ...i, cwd } : i));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setHeight(Math.max(100, Math.min(800, startHeightRef.current + (startYRef.current - ev.clientY))));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) requestAnimationFrame(() => active.fitAddon?.fit());
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (isVisible && activeTab === 'terminal') {
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) {
        requestAnimationFrame(() => { active.fitAddon?.fit(); active.xterm?.focus(); });
      }
    }
  }, [isVisible, activeId, activeTab, instances]);

  if (!isVisible) return null;

  const activeInstance = instances.find(i => i.id === activeId);
  const TABBAR_H = 35;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderTop: '1px solid var(--border-color)',
      background: '#141414', flexShrink: 0,
      height: height + TABBAR_H + 4,
      position: 'relative',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          cursor: 'row-resize', zIndex: 10, background: 'transparent',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-secondary, #1e1e1e)',
        borderBottom: '1px solid var(--border-color)',
        height: TABBAR_H, flexShrink: 0,
        paddingLeft: 4, paddingRight: 6, gap: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0 }}>
          {TAB_DEFS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === 'problems' ? (errorCount + warningCount) : 0;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0 12px', height: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent-color, #0078d4)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #888)',
                fontSize: 12, whiteSpace: 'nowrap', userSelect: 'none',
                transition: 'color 0.15s',
              }}>
                {tab.label}
                {badge > 0 && (
                  <span style={{
                    background: errorCount > 0 ? '#f85149' : '#d29922',
                    color: '#fff', borderRadius: 10, fontSize: 10,
                    padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center',
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'terminal' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 10, overflow: 'hidden', minWidth: 0 }}>
            {activeInstance?.cwd
              ? <TerminalBreadcrumb cwd={activeInstance.cwd} />
              : <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.4 }}>connecting…</span>
            }
          </div>
        )}
        {activeTab !== 'terminal' && <div style={{ flex: 1 }} />}

        {activeTab === 'terminal' && (
          <>
            <button
              onClick={addTerminal}
              title="New Terminal"
              style={actionBtn}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
            </button>
            <button
              onClick={() => activeInstance?.xterm?.clear()}
              title="Clear Terminal"
              style={actionBtn}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25z"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', height, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'terminal' && (
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {instances.map(inst => (
                <TerminalPane
                  key={inst.id}
                  instance={inst}
                  isActive={inst.id === activeId}
                  onReady={(id, xterm, fitAddon) =>
                    setInstances(prev => prev.map(i => i.id === id ? { ...i, xterm, fitAddon } : i))
                  }
                  onCwdChange={handleCwdChange}
                />
              ))}
            </div>
          )}
          {activeTab === 'output'   && <OutputPanel />}
          {activeTab === 'problems' && <ProblemsPanel errorCount={errorCount} warningCount={warningCount} />}
          {activeTab === 'ports'    && <PortsPanel />}
        </div>

        {/* Right: terminal instance list */}
        {activeTab === 'terminal' && (
          <div style={{
            width: 140, borderLeft: '1px solid var(--border-color)',
            background: 'var(--bg-primary, #181818)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
          }}>
            <div style={{
              padding: '5px 8px', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)',
              userSelect: 'none',
            }}>Terminals</div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {instances.map((inst, idx) => {
                const isActive = inst.id === activeId;
                const shortCwd = inst.cwd ? inst.cwd.replace(/\\/g, '/').split('/').pop() || inst.cwd : null;
                return (
                  <div
                    key={inst.id}
                    onClick={() => { setActiveId(inst.id); setActiveTab('terminal'); }}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2,
                      padding: '6px 8px', cursor: 'pointer',
                      background: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-color, #0078d4)' : '2px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12, userSelect: 'none', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                        <rect x="1" y="1" width="14" height="14" rx="2"/>
                        <path d="M4 5l3 3-3 3"/><path d="M9 11h3"/>
                      </svg>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        shell {idx + 1}
                      </span>
                      {instances.length > 1 && (
                        <span
                          onClick={e => { e.stopPropagation(); closeTerminal(inst.id); }}
                          title="Close terminal"
                          style={{
                            fontSize: 10, padding: '1px 3px', borderRadius: 2,
                            lineHeight: 1, flexShrink: 0, cursor: 'pointer',
                            opacity: 0, transition: 'opacity 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f85149'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = ''; }}
                        >✕</span>
                      )}
                    </div>
                    {shortCwd && (
                      <div style={{
                        fontSize: 10, opacity: 0.45,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        paddingLeft: 16,
                      }}>
                        {shortCwd}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
export { TerminalBus } from './TerminalBus';

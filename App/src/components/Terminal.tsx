import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  socket: WebSocket | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

export type PanelTab = 'terminal' | 'debug' | 'output' | 'problems' | 'ports';

interface TerminalProps {
  isVisible: boolean;
  errorCount?: number;
  warningCount?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createInstance(label?: string): TerminalInstance {
  return {
    id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: label ?? 'bash',
    xterm: null,
    fitAddon: null,
    socket: null,
    containerRef: React.createRef<HTMLDivElement>(),
  };
}

// ── TerminalPane ───────────────────────────────────────────────────────────

const TerminalPane: React.FC<{
  instance: TerminalInstance;
  isActive: boolean;
  onReady: (id: string, xterm: XTerm, fitAddon: FitAddon) => void;
}> = ({ instance, isActive, onReady }) => {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !instance.containerRef.current) return;
    initialized.current = true;

    const xterm = new XTerm({
      theme: {
        background: '#141414',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#1e1e1e',
        brightBlack: '#666666',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b0b0b0',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      windowsMode: true,
      allowTransparency: false,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    xterm.open(instance.containerRef.current);
    fitAddon.fit();

    instance.xterm = xterm;
    instance.fitAddon = fitAddon;

    const socket = new WebSocket('ws://localhost:23816/ws/terminal');
    instance.socket = socket;

    socket.onopen = () => { fitAddon.fit(); };
    socket.onmessage = (e) => { requestAnimationFrame(() => xterm.write(e.data)); };
    socket.onerror = () => {
      xterm.write('\r\n\x1b[31mFailed to connect to terminal server\x1b[0m\r\n');
    };
    xterm.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data === '\x7F' || data === '\b' ? '\x08' : data);
      }
    });

    onReady(instance.id, xterm, fitAddon);

    return () => {
      socket.close();
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    if (isActive && instance.fitAddon) {
      requestAnimationFrame(() => {
        instance.fitAddon?.fit();
        instance.xterm?.focus();
      });
    }
  }, [isActive]);

  return (
    <div
      ref={instance.containerRef}
      style={{ width: '100%', height: '100%', display: isActive ? 'block' : 'none' }}
      onClick={() => instance.xterm?.focus()}
    />
  );
};

// ── Panel tab icons ────────────────────────────────────────────────────────

const TAB_DEFS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'terminal',
    label: 'Terminal',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="14" height="14" rx="2"/>
        <path d="M4 5l3 3-3 3"/>
        <path d="M9 11h3"/>
      </svg>
    ),
  },
  {
    id: 'debug',
    label: 'Debug Console',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6 1a5 5 0 0 0-4.47 7.22L.21 9.73a.75.75 0 0 0 1.06 1.06l1.06-1.06A5 5 0 1 0 6 1zm0 1.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM5.25 5v2.19l-1.22 1.22a.75.75 0 1 0 1.06 1.06l1.5-1.5A.75.75 0 0 0 6.75 7.5V5a.75.75 0 0 0-1.5 0z"/>
      </svg>
    ),
  },
  {
    id: 'output',
    label: 'Output',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75zM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5z"/>
      </svg>
    ),
  },
  {
    id: 'problems',
    label: 'Problems',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z"/>
      </svg>
    ),
  },
  {
    id: 'ports',
    label: 'Ports',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215z"/>
      </svg>
    ),
  },
];

// ── Placeholder panels ─────────────────────────────────────────────────────

const PlaceholderPanel: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: 8, fontSize: 13 }}>
    {icon && <span style={{ opacity: 0.4, transform: 'scale(1.8)', display: 'block' }}>{icon}</span>}
    <span style={{ opacity: 0.5 }}>No {label} output</span>
  </div>
);

// ── Main Terminal component ────────────────────────────────────────────────

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
      closed?.socket?.close();
      closed?.xterm?.dispose();
      return prev.filter(i => i.id !== id);
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = instances.filter(i => i.id !== id);
      return remaining[remaining.length - 1]?.id ?? instances[0].id;
    });
  }, [instances]);

  // Resize drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      setHeight(Math.max(100, Math.min(800, startHeightRef.current + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Refit on visibility/tab change
  useEffect(() => {
    if (isVisible && activeTab === 'terminal') {
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) {
        requestAnimationFrame(() => {
          active.fitAddon?.fit();
          active.xterm?.focus();
        });
      }
    }
  }, [isVisible, activeId, activeTab]);

  if (!isVisible) return null;

  const terminalCount = instances.length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid var(--border-color)',
      background: '#141414',
      flexShrink: 0,
      height: height + 35 + 4, // content height + tabbar (35px) + resize handle (4px)
      minHeight: 0,
      position: 'relative',
    }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          cursor: 'row-resize', zIndex: 1,
        }}
      />

      {/* ── Top bar: panel tabs + actions ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-secondary, #1e1e1e)',
        borderBottom: '1px solid var(--border-color)',
        height: 35,
        flexShrink: 0,
        paddingLeft: 4,
        paddingRight: 6,
        gap: 0,
      }}>
        {/* Panel type tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%', overflow: 'hidden' }}>
          {TAB_DEFS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === 'problems' ? (errorCount + warningCount) : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '0 12px', height: '100%',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                  color: isActive ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #888)',
                  fontSize: 12, whiteSpace: 'nowrap', userSelect: 'none',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary, #e0e0e0)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary, #888)'; }}
              >
                {tab.icon}
                <span>{tab.label}</span>
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

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {activeTab === 'terminal' && (
            <button
              onClick={addTerminal}
              title="New Terminal"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
            </button>
          )}
          {/* Trash / clear */}
          {activeTab === 'terminal' && (
            <button
              onClick={() => {
                const active = instances.find(i => i.id === activeId);
                active?.xterm?.clear();
              }}
              title="Clear Terminal"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Body: terminal content + right instance list ── */}
      <div style={{ display: 'flex', height, overflow: 'hidden' }}>

        {/* Main content area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeTab === 'terminal' && instances.map(inst => (
            <TerminalPane
              key={inst.id}
              instance={inst}
              isActive={inst.id === activeId}
              onReady={(id, xterm, fitAddon) => {
                setInstances(prev => prev.map(i => i.id === id ? { ...i, xterm, fitAddon } : i));
              }}
            />
          ))}
          {activeTab === 'debug' && <PlaceholderPanel label="debug console" icon={TAB_DEFS[1].icon} />}
          {activeTab === 'output' && <PlaceholderPanel label="output" icon={TAB_DEFS[2].icon} />}
          {activeTab === 'problems' && (
            <div style={{ flex: 1, padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, overflow: 'auto' }}>
              {errorCount === 0 && warningCount === 0 ? (
                <div style={{ opacity: 0.5, marginTop: 8 }}>No problems detected in workspace.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {errorCount > 0 && (
                    <div style={{ color: '#f85149', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.78 4.22a.75.75 0 0 1 0 1.06L9.06 8l1.72 1.72a.75.75 0 1 1-1.06 1.06L8 9.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 0 1 1.06 0z"/>
                      </svg>
                      {errorCount} error{errorCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {warningCount > 0 && (
                    <div style={{ color: '#d29922', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z"/>
                      </svg>
                      {warningCount} warning{warningCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'ports' && <PlaceholderPanel label="forwarded ports" icon={TAB_DEFS[4].icon} />}
        </div>

        {/* ── Right sidebar: terminal instance list (only when on terminal tab) ── */}
        {activeTab === 'terminal' && (
          <div style={{
            width: 140,
            borderLeft: '1px solid var(--border-color)',
            background: 'var(--bg-primary, #181818)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {/* Header */}
            <div style={{
              padding: '5px 8px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-color)',
              userSelect: 'none',
            }}>
              Terminals
            </div>

            {/* Instance list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {instances.map((inst, idx) => {
                const isActive = inst.id === activeId;
                return (
                  <div
                    key={inst.id}
                    onClick={() => setActiveId(inst.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 8px',
                      cursor: 'pointer',
                      background: isActive ? 'var(--accent-color, #0078d4)22' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-color, #0078d4)' : '2px solid transparent',
                      color: isActive ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #888)',
                      fontSize: 12,
                      userSelect: 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Terminal icon */}
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                      <rect x="1" y="1" width="14" height="14" rx="2"/>
                      <path d="M4 5l3 3-3 3"/>
                      <path d="M9 11h3"/>
                    </svg>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inst.name} {idx + 1}
                    </span>
                    {instances.length > 1 && (
                      <span
                        onClick={e => { e.stopPropagation(); closeTerminal(inst.id); }}
                        title="Close"
                        style={{ opacity: 0, fontSize: 10, padding: '1px 3px', borderRadius: 2, lineHeight: 1, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f85149'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                      >✕</span>
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

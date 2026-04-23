import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  socket: WebSocket | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface TerminalProps {
  isVisible: boolean;
}

let instanceCounter = 1;

function createInstance(): TerminalInstance {
  return {
    id: `term-${Date.now()}`,
    name: `bash`,
    xterm: null,
    fitAddon: null,
    socket: null,
    containerRef: React.createRef<HTMLDivElement>(),
  };
}

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
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#1e1e1e',
        brightBlack: '#666666',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
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

    socket.onopen = () => {
      console.log('Terminal WebSocket connected');
      fitAddon.fit();
    };
    socket.onmessage = (e) => {
      requestAnimationFrame(() => xterm.write(e.data));
    };
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

const Terminal: React.FC<TerminalProps> = ({ isVisible }) => {
  const [instances, setInstances] = useState<TerminalInstance[]>(() => [createInstance()]);
  const [activeId, setActiveId] = useState<string>(() => instances[0].id);
  const [height, setHeight] = useState(260);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const addTerminal = useCallback(() => {
    const inst = createInstance();
    setInstances(prev => [...prev, inst]);
    setActiveId(inst.id);
  }, []);

  const closeTerminal = useCallback((id: string) => {
    setInstances(prev => {
      const next = prev.filter(i => i.id !== id);
      if (next.length === 0) return prev; // keep at least one
      const closed = prev.find(i => i.id === id);
      closed?.socket?.close();
      closed?.xterm?.dispose();
      return next;
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = instances.filter(i => i.id !== id);
      return remaining[remaining.length - 1]?.id ?? instances[0].id;
    });
  }, [instances]);

  const handleMouseDown = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      setHeight(Math.max(120, Math.min(800, startHeightRef.current + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (isVisible) {
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) {
        requestAnimationFrame(() => {
          active.fitAddon?.fit();
          active.xterm?.focus();
        });
      }
    }
  }, [isVisible, activeId]);

  if (!isVisible) return null;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-color)', background: '#1e1e1e' }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, cursor: 'row-resize', zIndex: 10 }}
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', height: 35, flexShrink: 0, paddingLeft: 8 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', alignItems: 'center' }}>
          {instances.map(inst => (
            <div
              key={inst.id}
              onClick={() => setActiveId(inst.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 10px', height: '100%', cursor: 'pointer',
                borderBottom: inst.id === activeId ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: inst.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12, whiteSpace: 'nowrap', userSelect: 'none',
              }}
            >
              {/* Terminal icon */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="14" height="14" rx="2"/>
                <path d="M4 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 11h3" strokeLinecap="round"/>
              </svg>
              {inst.name}
              {instances.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); closeTerminal(inst.id); }}
                  style={{ opacity: 0.5, fontSize: 11, lineHeight: 1, padding: '1px 2px', borderRadius: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >✕</span>
              )}
            </div>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 8 }}>
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
        </div>
      </div>

      {/* Terminal content */}
      <div style={{ height, overflow: 'hidden', position: 'relative' }}>
        {instances.map(inst => (
          <TerminalPane
            key={inst.id}
            instance={inst}
            isActive={inst.id === activeId}
            onReady={(id, xterm, fitAddon) => {
              setInstances(prev => prev.map(i => i.id === id ? { ...i, xterm, fitAddon } : i));
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Terminal;

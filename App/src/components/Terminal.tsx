import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface TerminalInstance {
  id: string;
  name: string;
  cwd: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  socket: WebSocket | null;
  containerRef: React.RefObject<HTMLDivElement>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

export type PanelTab = 'terminal' | 'output' | 'problems' | 'ports';

interface OutputLine { ts: number; source: string; text: string; }
interface PortEntry  { port: number; pid: string; protocol: string; state: string; }

interface TerminalProps {
  isVisible: boolean;
  errorCount?: number;
  warningCount?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createInstance(): TerminalInstance {
  return {
    id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'shell',
    cwd: '',
    xterm: null,
    fitAddon: null,
    socket: null,
    containerRef: React.createRef<HTMLDivElement>(),
    reconnectTimer: null,
  };
}

/** Extract cwd from terminal output — supports OSC 7, PowerShell prompt, bash prompt */
function parseCwd(text: string): string | null {
  // OSC 7: \x1b]7;file://host/path\x07  (bash/zsh PROMPT_COMMAND, PowerShell prompt fn)
  const osc7 = text.match(/\x1b\]7;(?:file:\/\/[^/]*)?([^\x07\x1b]+)\x07/);
  if (osc7) return decodeURIComponent(osc7[1]);
  // PowerShell fallback: "PS C:\foo\bar> "
  const ps = text.match(/PS\s+([A-Za-z]:[^\r\n>]+)>/);
  if (ps) return ps[1].trim();
  // bash/zsh fallback: user@host:/path$
  const bash = text.match(/[\w.-]+@[\w.-]+:([~/][^\r\n$#]*)[#$]\s/);
  if (bash) return bash[1].replace(/^~/, process?.env?.HOME || '~');
  return null;
}

// ── Tab definitions ────────────────────────────────────────────────────────

const TAB_DEFS: { id: PanelTab; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'output',   label: 'Output'   },
  { id: 'problems', label: 'Problems' },
  { id: 'ports',    label: 'Ports'    },
];

// ── Breadcrumb ─────────────────────────────────────────────────────────────

const TerminalBreadcrumb: React.FC<{ cwd: string }> = ({ cwd }) => {
  if (!cwd) return null;
  const normalized = cwd.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  // On Windows keep the drive letter (e.g. "C:") as first segment
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
          {(i > 0 || isWinAbs) && i > 0 && (
            <span style={{ opacity: 0.35, flexShrink: 0, padding: '0 1px' }}>/</span>
          )}
          <span
            title={parts.slice(0, i + 1).join('/')}
            style={{
              opacity: i === parts.length - 1 ? 1 : 0.45,
              fontWeight: i === parts.length - 1 ? 600 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: i === parts.length - 1 ? 180 : 72,
              cursor: 'default',
              borderRadius: 3,
              padding: '1px 3px',
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

// ── TerminalPane ───────────────────────────────────────────────────────────

const WS_URL = 'ws://localhost:23816/ws/terminal';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];

const TerminalPane: React.FC<{
  instance: TerminalInstance;
  isActive: boolean;
  onReady: (id: string, xterm: XTerm, fitAddon: FitAddon) => void;
  onCwdChange: (id: string, cwd: string) => void;
}> = ({ instance, isActive, onReady, onCwdChange }) => {
  const initialized = useRef(false);
  const retryCount = useRef(0);

  const connect = useCallback((xterm: XTerm, fitAddon: FitAddon) => {
    const socket = new WebSocket(WS_URL);
    instance.socket = socket;

    socket.onopen = () => {
      retryCount.current = 0;
      fitAddon.fit();
      // Send terminal size
      const cols = xterm.cols;
      const rows = xterm.rows;
      socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    socket.onmessage = (e) => {
      const data = e.data;
      requestAnimationFrame(() => xterm.write(data));
      const cwd = parseCwd(data);
      if (cwd) onCwdChange(instance.id, cwd);
    };

    socket.onerror = () => {
      // error will be followed by close
    };

    socket.onclose = () => {
      instance.socket = null;
      const delay = RECONNECT_DELAYS[Math.min(retryCount.current, RECONNECT_DELAYS.length - 1)];
      retryCount.current++;
      xterm.write(`\r\n\x1b[33m[Reconnecting in ${delay / 1000}s…]\x1b[0m\r\n`);
      instance.reconnectTimer = setTimeout(() => connect(xterm, fitAddon), delay);
    };

    xterm.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });

    xterm.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    });
  }, []);

  useEffect(() => {
    if (initialized.current || !instance.containerRef.current) return;
    initialized.current = true;

    const xterm = new XTerm({
      theme: {
        background: '#141414', foreground: '#cccccc', cursor: '#ffffff',
        selectionBackground: 'rgba(88,166,255,0.25)',
        black: '#1e1e1e', brightBlack: '#666666',
        red: '#f85149', brightRed: '#ff7b72',
        green: '#3fb950', brightGreen: '#56d364',
        yellow: '#d29922', brightYellow: '#e3b341',
        blue: '#58a6ff', brightBlue: '#79c0ff',
        magenta: '#bc8cff', brightMagenta: '#d2a8ff',
        cyan: '#39c5cf', brightCyan: '#56d4dd',
        white: '#b0b0b0', brightWhite: '#ffffff',
      },
      fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
      fontSize: 13, lineHeight: 1.3,
      cursorBlink: true, cursorStyle: 'block',
      convertEol: true,
      scrollback: 5000,
      allowProposedApi: true,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    xterm.open(instance.containerRef.current);
    fitAddon.fit();

    instance.xterm = xterm;
    instance.fitAddon = fitAddon;

    connect(xterm, fitAddon);
    onReady(instance.id, xterm, fitAddon);

    return () => {
      if (instance.reconnectTimer) clearTimeout(instance.reconnectTimer);
      instance.socket?.close();
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    if (isActive && instance.fitAddon) {
      requestAnimationFrame(() => { instance.fitAddon?.fit(); instance.xterm?.focus(); });
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

// ── TerminalBus ────────────────────────────────────────────────────────────
// Global event bus so the agent (ToolService) can push commands into the
// active terminal and track their output.

type BusListener = (event: TerminalBusEvent) => void;

export interface TerminalBusEvent {
  type: 'run-command';
  command: string;
  /** resolved once the shell prompt reappears (command finished) */
  resolve: (output: string) => void;
}

class TerminalBusClass {
  private listeners: BusListener[] = [];

  subscribe(fn: BusListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  emit(event: TerminalBusEvent) {
    this.listeners.forEach(l => l(event));
  }

  /** Run a command in the active terminal and wait for it to finish.
   *  Returns the captured output (stripped of ANSI codes). */
  runCommand(command: string): Promise<string> {
    return new Promise(resolve => {
      this.emit({ type: 'run-command', command, resolve });
    });
  }
}

export const TerminalBus = new TerminalBusClass();

// ── ANSI strip helper ──────────────────────────────────────────────────────
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/\x1b[()][AB012]/g, '')
            .replace(/[\x00-\x09\x0b-\x0c\x0e-\x1f\x7f]/g, '');
}

// Detect that a shell prompt has appeared (command finished)
function isPromptLine(line: string): boolean {
  const clean = stripAnsi(line);
  return /PS\s+[A-Za-z]:[^\r\n>]*>\s*$/.test(clean) ||
         /[#$%]\s*$/.test(clean) ||
         />\s*$/.test(clean);
}

// ── Output Panel ───────────────────────────────────────────────────────────

const OutputPanel: React.FC = () => {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [lastTs, setLastTs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`http://localhost:23816/api/output?since=${lastTs}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.lines?.length) {
          setLines(prev => [...prev, ...data.lines].slice(-500));
          setLastTs(data.lastTs);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [lastTs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }); }, [lines]);

  const sourceColor = (src: string) =>
    src.includes('err') ? '#f85149' : src === 'backend' ? '#58a6ff' : '#b0b0b0';

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px', fontFamily: 'Consolas, monospace', fontSize: 12 }}>
      {lines.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', opacity: 0.5, marginTop: 8 }}>No output yet.</div>
      )}
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, lineHeight: '18px', color: sourceColor(l.source) }}>
          <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 10, paddingTop: 1 }}>
            {new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span style={{ opacity: 0.55, flexShrink: 0, fontSize: 10, paddingTop: 1, minWidth: 52 }}>[{l.source}]</span>
          <span style={{ wordBreak: 'break-all' }}>{l.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

// ── Ports Panel ────────────────────────────────────────────────────────────

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

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, []);

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

// ── Main Terminal component ────────────────────────────────────────────────

const Terminal: React.FC<TerminalProps> = ({ isVisible, errorCount = 0, warningCount = 0 }) => {
  const [instances, setInstances] = useState<TerminalInstance[]>(() => [createInstance()]);
  const [activeId, setActiveId] = useState<string>(() => instances[0].id);
  const [activeTab, setActiveTab] = useState<PanelTab>('terminal');
  const [height, setHeight] = useState(260);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  // Ref to always have the latest instances for the bus handler
  const instancesRef = useRef(instances);
  const activeIdRef = useRef(activeId);
  useEffect(() => { instancesRef.current = instances; }, [instances]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

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
      if (closed?.reconnectTimer) clearTimeout(closed.reconnectTimer);
      closed?.socket?.close();
      closed?.xterm?.dispose();
      return prev.filter(i => i.id !== id);
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = instancesRef.current.filter(i => i.id !== id);
      return remaining[remaining.length - 1]?.id ?? instancesRef.current[0].id;
    });
  }, []);

  const handleCwdChange = useCallback((id: string, cwd: string) => {
    setInstances(prev => prev.map(i => i.id === id ? { ...i, cwd } : i));
  }, []);

  // ── TerminalBus integration ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = TerminalBus.subscribe((event) => {
      if (event.type !== 'run-command') return;

      const inst = instancesRef.current.find(i => i.id === activeIdRef.current)
        ?? instancesRef.current[0];
      if (!inst?.socket || inst.socket.readyState !== WebSocket.OPEN) {
        event.resolve('[Terminal not connected]');
        return;
      }

      // Switch to terminal tab so user can see it
      setActiveTab('terminal');

      const xterm = inst.xterm;
      let outputBuffer = '';
      let settled = false;
      let promptTimer: ReturnType<typeof setTimeout> | null = null;

      const settle = () => {
        if (settled) return;
        settled = true;
        if (promptTimer) clearTimeout(promptTimer);
        // Remove our temporary listener
        if (xterm) (xterm as any).__busDataHandler = null;
        event.resolve(stripAnsi(outputBuffer));
      };

      // Intercept xterm output temporarily
      if (xterm) {
        const origWrite = xterm.write.bind(xterm);
        (xterm as any).__busDataHandler = (data: string) => {
          outputBuffer += data;
          // Reset prompt-detection timer on every chunk
          if (promptTimer) clearTimeout(promptTimer);
          // Check if a prompt appeared
          const lines = stripAnsi(outputBuffer).split(/\r?\n/);
          if (lines.some(isPromptLine)) {
            // Give 200ms for any trailing output
            promptTimer = setTimeout(settle, 200);
          } else {
            // Fallback: if no prompt after 30s, resolve anyway
            promptTimer = setTimeout(settle, 30_000);
          }
        };
        // Monkey-patch write to also call our handler
        xterm.write = (data: any, callback?: () => void) => {
          if ((xterm as any).__busDataHandler) (xterm as any).__busDataHandler(typeof data === 'string' ? data : new TextDecoder().decode(data));
          origWrite(data, callback);
        };
      }

      // Send the command
      inst.socket.send(event.command + '\r');
    });
    return unsub;
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
  }, [isVisible, activeId, activeTab]);

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
    }}>
      {/* Resize handle */}
      <div onMouseDown={handleMouseDown} style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        cursor: 'row-resize', zIndex: 1,
      }} />

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-secondary, #1e1e1e)',
        borderBottom: '1px solid var(--border-color)',
        height: TABBAR_H, flexShrink: 0,
        paddingLeft: 4, paddingRight: 6,
      }}>
        {/* Panel tabs */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {TAB_DEFS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === 'problems' ? (errorCount + warningCount) : 0;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0 12px', height: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #888)',
                fontSize: 12, whiteSpace: 'nowrap', userSelect: 'none',
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

        {/* Breadcrumb for active terminal */}
        {activeTab === 'terminal' && activeInstance?.cwd && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 12, overflow: 'hidden' }}>
            <TerminalBreadcrumb cwd={activeInstance.cwd} />
          </div>
        )}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        {activeTab === 'terminal' && (<>
          <button onClick={addTerminal} title="New Terminal" style={actionBtn}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
          </button>
          <button
            onClick={() => { instances.find(i => i.id === activeId)?.xterm?.clear(); }}
            title="Clear"
            style={actionBtn}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25z"/></svg>
          </button>
        </>)}
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', height, overflow: 'hidden' }}>
        {/* Main content */}
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
          {activeTab === 'problems' && (
            <div style={{ flex: 1, padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, overflow: 'auto' }}>
              {errorCount === 0 && warningCount === 0
                ? <div style={{ opacity: 0.5, marginTop: 8 }}>No problems detected.</div>
                : <>
                  {errorCount > 0 && <div style={{ color: '#f85149', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.78 4.22a.75.75 0 0 1 0 1.06L9.06 8l1.72 1.72a.75.75 0 1 1-1.06 1.06L8 9.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 0 1 1.06 0z"/></svg>
                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                  </div>}
                  {warningCount > 0 && <div style={{ color: '#d29922', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z"/></svg>
                    {warningCount} warning{warningCount !== 1 ? 's' : ''}
                  </div>}
                </>
              }
            </div>
          )}
          {activeTab === 'ports' && <PortsPanel />}
        </div>

        {/* ── Right: terminal instance list ── */}
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
                return (
                  <div key={inst.id} onClick={() => setActiveId(inst.id)} style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '6px 8px', cursor: 'pointer',
                    background: isActive ? 'rgba(88,166,255,0.1)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent-color, #0078d4)' : '2px solid transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12, userSelect: 'none',
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                        <rect x="1" y="1" width="14" height="14" rx="2"/><path d="M4 5l3 3-3 3"/><path d="M9 11h3"/>
                      </svg>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inst.name} {idx + 1}
                      </span>
                      {instances.length > 1 && (
                        <span
                          onClick={e => { e.stopPropagation(); closeTerminal(inst.id); }}
                          style={{ opacity: 0, fontSize: 10, padding: '1px 3px', borderRadius: 2, lineHeight: 1, flexShrink: 0, cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#f85149'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                        >✕</span>
                      )}
                    </div>
                    {inst.cwd && (
                      <div style={{ fontSize: 10, opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 16 }}>
                        {inst.cwd.replace(/\\/g, '/').split('/').pop()}
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

const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--text-secondary)', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 4,
  display: 'flex', alignItems: 'center',
};

export default Terminal;

// ── Output Panel ───────────────────────────────────────────────────────────

const OutputPanel: React.FC = () => {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [lastTs, setLastTs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`http://localhost:23816/api/output?since=${lastTs}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.lines?.length) {
          setLines(prev => [...prev, ...data.lines].slice(-500));
          setLastTs(data.lastTs);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [lastTs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [lines]);

  const sourceColor = (src: string) =>
    src.includes('err') ? '#f85149' : src === 'backend' ? '#58a6ff' : '#b0b0b0';

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px', fontFamily: 'Consolas, monospace', fontSize: 12 }}>
      {lines.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', opacity: 0.5, marginTop: 8 }}>No output yet.</div>
      )}
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, lineHeight: '18px', color: sourceColor(l.source) }}>
          <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 10, paddingTop: 1 }}>
            {new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span style={{ opacity: 0.55, flexShrink: 0, fontSize: 10, paddingTop: 1, minWidth: 52 }}>[{l.source}]</span>
          <span style={{ wordBreak: 'break-all' }}>{l.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

// ── Ports Panel ────────────────────────────────────────────────────────────

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

// ── Problems Panel ─────────────────────────────────────────────────────────

const ProblemsPanel: React.FC<{ errorCount: number; warningCount: number }> = ({ errorCount, warningCount }) => (
  <div style={{ flex: 1, padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, overflow: 'auto' }}>
    {errorCount === 0 && warningCount === 0
      ? <div style={{ opacity: 0.5, marginTop: 8 }}>No problems detected.</div>
      : <>
        {errorCount > 0 && (
          <div style={{ color: '#f85149', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
      </>
    }
  </div>
);

// ── Action button style ────────────────────────────────────────────────────

const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--text-secondary)', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 4,
  display: 'flex', alignItems: 'center',
  transition: 'color 0.15s',
};

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
      // refit after resize
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) requestAnimationFrame(() => active.fitAddon?.fit());
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Refit when visibility or active tab changes
  useEffect(() => {
    if (isVisible && activeTab === 'terminal') {
      const active = instances.find(i => i.id === activeId);
      if (active?.fitAddon) {
        requestAnimationFrame(() => { active.fitAddon?.fit(); active.xterm?.focus(); });
      }
    }
  }, [isVisible, activeId, activeTab]);

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
    }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          cursor: 'row-resize', zIndex: 10,
          background: 'transparent',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      />

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-secondary, #1e1e1e)',
        borderBottom: '1px solid var(--border-color)',
        height: TABBAR_H, flexShrink: 0,
        paddingLeft: 4, paddingRight: 6,
        gap: 0,
      }}>
        {/* Panel tabs */}
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

        {/* Breadcrumb for active terminal */}
        {activeTab === 'terminal' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 10, overflow: 'hidden', minWidth: 0 }}>
            {activeInstance?.cwd
              ? <TerminalBreadcrumb cwd={activeInstance.cwd} />
              : <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.4 }}>connecting…</span>
            }
          </div>
        )}
        {activeTab !== 'terminal' && <div style={{ flex: 1 }} />}

        {/* Actions */}
        {activeTab === 'terminal' && (
          <>
            <button
              onClick={addTerminal}
              title="New Terminal (Ctrl+Shift+`)"
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

      {/* ── Body ── */}
      <div style={{ display: 'flex', height, overflow: 'hidden' }}>

        {/* Main content area */}
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

        {/* ── Right: terminal instance list ── */}
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
                const shortCwd = inst.cwd
                  ? inst.cwd.replace(/\\/g, '/').split('/').pop() || inst.cwd
                  : null;
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
                      fontSize: 12, userSelect: 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {/* Terminal icon */}
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
                    {/* Mini cwd in instance list */}
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

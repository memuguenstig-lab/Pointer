import { Terminal as XTerm, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { TerminalInstance } from './types';
import { parseCwd } from './utils';

const WS_URL = 'ws://localhost:23816/ws/terminal';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];

/** Read terminal theme from CSS variables set by the active app theme */
function getTerminalTheme(): ITheme {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    background:           v('--terminal-bg',            '#141414'),
    foreground:           v('--terminal-fg',            '#cccccc'),
    cursor:               v('--terminal-cursor',        '#ffffff'),
    cursorAccent:         v('--terminal-bg',            '#141414'),
    selectionBackground:  'rgba(88,166,255,0.25)',
    black:                v('--terminal-black',         '#1e1e1e'),
    brightBlack:          v('--terminal-bright-black',  '#666666'),
    red:                  v('--terminal-red',           '#f85149'),
    brightRed:            v('--terminal-bright-red',    '#ff7b72'),
    green:                v('--terminal-green',         '#3fb950'),
    brightGreen:          v('--terminal-bright-green',  '#56d364'),
    yellow:               v('--terminal-yellow',        '#d29922'),
    brightYellow:         v('--terminal-bright-yellow', '#e3b341'),
    blue:                 v('--terminal-blue',          '#58a6ff'),
    brightBlue:           v('--terminal-bright-blue',   '#79c0ff'),
    magenta:              v('--terminal-magenta',       '#bc8cff'),
    brightMagenta:        v('--terminal-bright-magenta','#d2a8ff'),
    cyan:                 v('--terminal-cyan',          '#39c5cf'),
    brightCyan:           v('--terminal-bright-cyan',   '#56d4dd'),
    white:                v('--terminal-white',         '#b0b0b0'),
    brightWhite:          v('--terminal-bright-white',  '#ffffff'),
  };
}

interface Props {
  instance: TerminalInstance;
  isActive: boolean;
  onReady: (id: string, xterm: XTerm, fitAddon: FitAddon) => void;
  onCwdChange: (id: string, cwd: string) => void;
}

const TerminalPane: React.FC<Props> = ({ instance, isActive, onReady, onCwdChange }) => {
  const initialized = useRef(false);
  const retryCount = useRef(0);

  const connect = useCallback((xterm: XTerm, fitAddon: FitAddon) => {
    const socket = new WebSocket(WS_URL);
    instance.socket = socket;
    let didClose = false;

    socket.onopen = () => {
      retryCount.current = 0;
      // Safe fit on open
      const el = instance.containerRef.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        try { fitAddon.fit(); } catch (_) {}
      }
      socket.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
    };

    socket.onmessage = (e) => {
      const text = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
      requestAnimationFrame(() => xterm.write(text));
      const cwd = parseCwd(text);
      if (cwd) onCwdChange(instance.id, cwd);
    };

    socket.onerror = () => {};

    socket.onclose = () => {
      if (didClose) return;
      didClose = true;
      instance.socket = null;
      const delay = RECONNECT_DELAYS[Math.min(retryCount.current, RECONNECT_DELAYS.length - 1)];
      retryCount.current++;
      xterm.write(`\r\n\x1b[33m[Reconnecting in ${delay / 1000}s…]\x1b[0m\r\n`);
      instance.reconnectTimer = setTimeout(() => connect(xterm, fitAddon), delay);
    };

    xterm.onData(data => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });

    xterm.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    });
  }, [instance, onCwdChange]);

  useEffect(() => {
    if (initialized.current || !instance.containerRef.current) return;
    initialized.current = true;

    const container = instance.containerRef.current;

    const xterm = new XTerm({
      theme: getTerminalTheme(),
      fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      scrollback: 5000,
      allowProposedApi: true,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    xterm.open(container);

    instance.xterm = xterm;
    instance.fitAddon = fitAddon;

    // Use ResizeObserver to fit as soon as the container gets real dimensions.
    // This is the only reliable way to avoid the FitAddon 'dimensions' crash
    // which happens when fit() is called while the element is hidden or zero-size.
    let connected = false;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        try { fitAddon.fit(); } catch (_) {}
        if (!connected) {
          connected = true;
          connect(xterm, fitAddon);
          onReady(instance.id, xterm, fitAddon);
        }
      }
    });
    ro.observe(container);

    const onThemeChange = () => {
      try { xterm.options.theme = getTerminalTheme(); } catch (_) {}
    };
    window.addEventListener('theme-changed', onThemeChange);

    return () => {
      ro.disconnect();
      window.removeEventListener('theme-changed', onThemeChange);
      if (instance.reconnectTimer) clearTimeout(instance.reconnectTimer);
      try { instance.socket?.close(); } catch (_) {}
      try { xterm.dispose(); } catch (_) {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When this pane becomes active, refit and focus
  useEffect(() => {
    if (!isActive || !instance.fitAddon || !instance.containerRef.current) return;
    const el = instance.containerRef.current;
    requestAnimationFrame(() => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        try { instance.fitAddon!.fit(); } catch (_) {}
      }
      instance.xterm?.focus();
    });
  }, [isActive, instance]);

  return (
    <div
      ref={instance.containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      onClick={() => instance.xterm?.focus()}
    />
  );
};

export default React.memo(TerminalPane);

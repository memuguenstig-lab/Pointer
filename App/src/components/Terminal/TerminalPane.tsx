import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import React, { useEffect, useRef, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { TerminalInstance } from './types';
import { parseCwd } from './utils';

const WS_URL = 'ws://localhost:23816/ws/terminal';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000];

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

    socket.onopen = () => {
      retryCount.current = 0;
      fitAddon.fit();
      socket.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
    };

    socket.onmessage = (e) => {
      requestAnimationFrame(() => xterm.write(e.data));
      const cwd = parseCwd(e.data);
      if (cwd) onCwdChange(instance.id, cwd);
    };

    socket.onclose = () => {
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
      convertEol: true, scrollback: 5000,
      allowProposedApi: true, allowTransparency: false,
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

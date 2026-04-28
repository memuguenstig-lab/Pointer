import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import React from 'react';

export interface TerminalInstance {
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

export interface OutputLine { ts: number; source: string; text: string; }
export interface PortEntry  { port: number; pid: string; protocol: string; state: string; }

export interface TerminalProps {
  isVisible: boolean;
  errorCount?: number;
  warningCount?: number;
}

export const TAB_DEFS: { id: PanelTab; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'output',   label: 'Output'   },
  { id: 'problems', label: 'Problems' },
  { id: 'ports',    label: 'Ports'    },
];

export const actionBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--text-secondary)', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 4,
  display: 'flex', alignItems: 'center',
  transition: 'color 0.15s',
};

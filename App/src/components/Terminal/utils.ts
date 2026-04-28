import React from 'react';
import { TerminalInstance } from './types';

export function createInstance(): TerminalInstance {
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

/** Extract cwd from terminal output — OSC 7, PowerShell, bash */
export function parseCwd(text: string): string | null {
  const osc7 = text.match(/\x1b\]7;(?:file:\/\/[^/]*)?([^\x07\x1b]+)\x07/);
  if (osc7) return decodeURIComponent(osc7[1]);
  const ps = text.match(/PS\s+([A-Za-z]:[^\r\n>]+)>/);
  if (ps) return ps[1].trim();
  const bash = text.match(/[\w.-]+@[\w.-]+:([~/][^\r\n$#]*)[#$]\s/);
  if (bash) return bash[1].replace(/^~/, '~');
  return null;
}

/** Strip ANSI escape codes */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][AB012]/g, '')
    .replace(/[\x00-\x09\x0b-\x0c\x0e-\x1f\x7f]/g, '');
}

/** Detect that a shell prompt has appeared (command finished) */
export function isPromptLine(line: string): boolean {
  const clean = stripAnsi(line);
  return /PS\s+[A-Za-z]:[^\r\n>]*>\s*$/.test(clean) ||
         /[#$%]\s*$/.test(clean) ||
         />\s*$/.test(clean);
}

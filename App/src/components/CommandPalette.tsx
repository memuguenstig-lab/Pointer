import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KeyboardShortcutsRegistry } from '../services/KeyboardShortcutsRegistry';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFile?: (fileId: string) => void;
  fileItems?: Record<string, { id: string; name: string; path: string; type: string }>;
}

type Mode = 'commands' | 'files' | 'symbols';

interface ResultItem {
  type: 'command' | 'file' | 'symbol';
  id: string;
  label: string;
  detail?: string;
  icon?: string;
  action?: () => void;
}

function fuzzyMatch(str: string, query: string): boolean {
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  let si = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = s.indexOf(q[qi], si);
    if (idx === -1) return false;
    si = idx + 1;
  }
  return true;
}

function fuzzyScore(str: string, query: string): number {
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  // Consecutive match bonus
  if (s.includes(q)) return 100 + (100 - s.indexOf(q));
  return 50;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenFile, fileItems }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('commands');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const getMode = (q: string): Mode => {
    if (q.startsWith('>')) return 'commands';
    if (q.startsWith('@')) return 'symbols';
    return q.length > 0 ? 'files' : 'commands';
  };

  const searchFiles = useCallback((q: string): ResultItem[] => {
    if (!fileItems) return [];
    const files = Object.values(fileItems).filter(f => f.type === 'file');
    return files
      .filter(f => fuzzyMatch(f.name, q) || fuzzyMatch(f.path, q))
      .sort((a, b) => fuzzyScore(a.name, q) - fuzzyScore(b.name, q))
      .slice(0, 20)
      .map(f => ({
        type: 'file' as const,
        id: f.id,
        label: f.name,
        detail: f.path,
        icon: getFileIcon(f.name),
        action: () => onOpenFile?.(f.id),
      }));
  }, [fileItems, onOpenFile]);

  const searchSymbols = useCallback(async (q: string): Promise<ResultItem[]> => {
    try {
      const term = q.startsWith('@') ? q.slice(1) : q;
      const res = await fetch(`http://localhost:23816/api/codebase/search?query=${encodeURIComponent(term)}&limit=20`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.elements || data.results || []).map((el: any) => ({
        type: 'symbol' as const,
        id: el.name + el.file,
        label: el.name,
        detail: `${el.file}:${el.line ?? ''}  ${el.type ?? ''}`,
        icon: symbolIcon(el.type),
        action: () => onOpenFile?.(el.file_id || el.file),
      }));
    } catch { return []; }
  }, [onOpenFile]);

  const searchCommands = useCallback((q: string): ResultItem[] => {
    const term = q.startsWith('>') ? q.slice(1).trim() : q;
    const cmds = term.length === 0
      ? KeyboardShortcutsRegistry.getMostUsedCommands(12)
      : KeyboardShortcutsRegistry.searchCommands(term);
    return (cmds as any[]).map(c => ({
      type: 'command' as const,
      id: c.id || c.command,
      label: c.description || c.command || c.id,
      detail: c.shortcut || '',
      icon: '⚡',
      action: () => KeyboardShortcutsRegistry.executeCommand(c.id || c.command),
    }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const newMode = getMode(query);
    setMode(newMode);

    if (newMode === 'symbols') {
      searchSymbols(query).then(r => { setResults(r); setSelectedIndex(0); });
    } else if (newMode === 'files') {
      setResults(searchFiles(query));
      setSelectedIndex(0);
    } else {
      setResults(searchCommands(query));
      setSelectedIndex(0);
    }
  }, [query, isOpen, searchFiles, searchSymbols, searchCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const execute = useCallback((item: ResultItem) => {
    item.action?.();
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[selectedIndex]) execute(results[selectedIndex]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selectedIndex, results, execute, onClose]);

  useEffect(() => {
    resultsRef.current?.children[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const placeholder =
    mode === 'files' ? 'Search files...' :
    mode === 'symbols' ? 'Search symbols... (@)' :
    'Type > for commands, @ for symbols, or filename...';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, width: '90%', maxWidth: 620, maxHeight: '60vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}
      >
        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '0 12px', gap: 0 }}>
          {(['commands', 'files', 'symbols'] as Mode[]).map(m => (
            <button key={m} onClick={() => setQuery(m === 'commands' ? '>' : m === 'symbols' ? '@' : '')}
              style={{ padding: '6px 12px', background: 'none', border: 'none', borderBottom: mode === m ? '2px solid var(--accent-color)' : '2px solid transparent', color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '10px 14px', background: 'var(--bg-primary)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        {/* Results */}
        <div ref={resultsRef} style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              No results
            </div>
          ) : results.map((r, i) => (
            <div key={r.id + i} onClick={() => execute(r)}
              style={{ padding: '9px 16px', background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent', borderLeft: `3px solid ${i === selectedIndex ? 'var(--accent-color)' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, color: 'var(--text-secondary)' }}>{r.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                {r.detail && <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</div>}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                {r.type === 'command' ? r.detail : r.type}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>↑↓ Navigate · Enter Select · Esc Close</span>
          <span>{results.length} results · type &gt; commands · @ symbols</span>
        </div>
      </div>
    </div>
  );
};

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = { ts: '🔷', tsx: '⚛', js: '🟨', jsx: '⚛', py: '🐍', json: '{}', md: '📝', css: '🎨', html: '🌐', svg: '🖼', png: '🖼', jpg: '🖼' };
  return map[ext] ?? '📄';
}

function symbolIcon(type: string): string {
  const map: Record<string, string> = { function: 'ƒ', class: '◆', interface: '◇', variable: '𝑥', component: '⚛', method: 'ƒ', type: 'T' };
  return map[type?.toLowerCase()] ?? '◉';
}

export default CommandPalette;

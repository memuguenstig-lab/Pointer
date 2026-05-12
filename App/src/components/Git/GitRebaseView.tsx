import React, { useState, useEffect, useRef } from 'react';
import { GitService } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

interface RebaseCommit {
  id: string;
  hash: string;
  message: string;
  action: RebaseAction;
}

const ACTION_COLORS: Record<RebaseAction, string> = {
  pick:   'var(--text-secondary)',
  reword: '#58a6ff',
  edit:   '#f0883e',
  squash: '#bc8cff',
  fixup:  '#d2a8ff',
  drop:   '#f85149',
};

const ACTION_LABELS: Record<RebaseAction, string> = {
  pick:   'pick',
  reword: 'reword',
  edit:   'edit',
  squash: 'squash',
  fixup:  'fixup',
  drop:   'drop',
};

const GitRebaseView: React.FC = () => {
  const [commits, setCommits] = useState<RebaseCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseBranch, setBaseBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const dir = FileSystemService.getCurrentDirectory();

  useEffect(() => {
    if (!dir) { setLoading(false); return; }
    loadBranches();
  }, [dir]);

  async function loadBranches() {
    if (!dir) return;
    try {
      const b = await GitService.getAllBranches(dir);
      setBranches(b.local);
      // Default base to main or master
      const def = b.local.find(x => x === 'main' || x === 'master') ?? b.local[0] ?? 'main';
      setBaseBranch(def);
      await loadCommits(def);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function loadCommits(base: string) {
    if (!dir) return;
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const { commits: raw } = await GitService.getPRCommits(dir, base);
      setCommits(raw.map((c: any, i: number) => ({
        id: `${i}-${c.hash}`,
        hash: c.hash?.slice(0, 7) ?? '',
        message: c.message ?? '',
        action: 'pick' as RebaseAction,
      })));
    } catch (e: any) {
      setError('Failed to load commits: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────
  function handleDragStart(id: string) { setDragging(id); }
  function handleDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOver(id); }
  function handleDrop(targetId: string) {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    setCommits(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(c => c.id === dragging);
      const toIdx = arr.findIndex(c => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragging(null);
    setDragOver(null);
  }

  function setAction(id: string, action: RebaseAction) {
    setCommits(prev => prev.map(c => c.id === id ? { ...c, action } : c));
  }

  async function handleApply() {
    if (!dir) return;
    setApplying(true);
    setError(null);
    try {
      // Build the rebase todo script
      const script = commits
        .map(c => `${c.action} ${c.hash} ${c.message}`)
        .join('\n');

      // Use git rebase -i via backend
      const res = await fetch('http://localhost:23816/git/rebase-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: dir, base: baseBranch, script }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Rebase failed');
      setApplied(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  }

  if (!dir) return <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>Open a workspace to use interactive rebase.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Rebase onto:</span>
          <select
            value={baseBranch}
            onChange={e => { setBaseBranch(e.target.value); loadCommits(e.target.value); }}
            style={{ padding: '4px 8px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)' }}
          >
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>
            Drag to reorder · Change action per commit
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(248,81,73,0.1)', color: '#f85149', fontSize: 12, flexShrink: 0 }}>
          {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f85149', marginLeft: 8 }}>✕</button>
        </div>
      )}

      {applied && (
        <div style={{ padding: '8px 12px', background: 'rgba(63,185,80,0.1)', color: '#3fb950', fontSize: 12, flexShrink: 0 }}>
          ✓ Rebase applied successfully
        </div>
      )}

      {/* Commit list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>Loading commits…</div>
        ) : commits.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>No commits to rebase.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {commits.map((c, idx) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(c.id)}
                onDragOver={e => handleDragOver(e, c.id)}
                onDrop={() => handleDrop(c.id)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 5,
                  background: dragOver === c.id ? 'rgba(88,166,255,0.1)' : 'var(--bg-secondary)',
                  border: `1px solid ${dragOver === c.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                  cursor: 'grab', opacity: dragging === c.id ? 0.4 : 1,
                  transition: 'all 0.1s',
                }}
              >
                {/* Drag handle */}
                <svg width="10" height="14" viewBox="0 0 10 14" fill="var(--text-secondary)" opacity={0.4} style={{ flexShrink: 0 }}>
                  <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
                  <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
                  <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
                </svg>

                {/* Index */}
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.5, width: 16, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>

                {/* Action selector */}
                <select
                  value={c.action}
                  onChange={e => setAction(c.id, e.target.value as RebaseAction)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    padding: '2px 6px', fontSize: 11, borderRadius: 3, flexShrink: 0,
                    background: `${ACTION_COLORS[c.action]}22`,
                    border: `1px solid ${ACTION_COLORS[c.action]}66`,
                    color: ACTION_COLORS[c.action],
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {(Object.keys(ACTION_LABELS) as RebaseAction[]).map(a => (
                    <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                  ))}
                </select>

                {/* Hash */}
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', flexShrink: 0 }}>{c.hash}</span>

                {/* Message */}
                <span style={{
                  flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: c.action === 'drop' ? 'var(--text-secondary)' : 'var(--text-primary)',
                  textDecoration: c.action === 'drop' ? 'line-through' : 'none',
                  opacity: c.action === 'drop' ? 0.5 : 1,
                }}>
                  {c.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && commits.length > 0 && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleApply}
            disabled={applying}
            style={{ padding: '6px 16px', fontSize: 12, borderRadius: 4, border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: applying ? 0.7 : 1 }}
          >
            {applying ? 'Applying…' : '⚡ Apply Rebase'}
          </button>
          <button
            onClick={() => loadCommits(baseBranch)}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Reset
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>
            {commits.filter(c => c.action !== 'drop').length} of {commits.length} commits
          </span>
        </div>
      )}
    </div>
  );
};

export default GitRebaseView;

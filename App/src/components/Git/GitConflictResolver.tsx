import React, { useState, useEffect } from 'react';
import { GitService } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface ConflictFile {
  path: string;
  resolved: boolean;
}

interface ConflictVersions {
  ours: string;
  theirs: string;
  base: string;
}

interface GitConflictResolverProps {
  onAllResolved?: () => void;
}

// ── Diff renderer ──────────────────────────────────────────────────────────
function DiffPane({ label, content, color, onAccept }: {
  label: string; content: string; color: string; onAccept?: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, border: `1px solid ${color}33`, borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: `${color}18`, borderBottom: `1px solid ${color}33`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {onAccept && (
          <button onClick={onAccept} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, border: `1px solid ${color}66`, background: `${color}22`, color, cursor: 'pointer' }}>
            Accept
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, padding: '6px 0' }}>
        {content.split('\n').map((line, i) => (
          <div key={i} style={{ padding: '0 10px', whiteSpace: 'pre' }}>{line || ' '}</div>
        ))}
      </div>
    </div>
  );
}

const GitConflictResolver: React.FC<GitConflictResolverProps> = ({ onAllResolved }) => {
  const [conflicts, setConflicts] = useState<ConflictFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [versions, setVersions] = useState<ConflictVersions | null>(null);
  const [merged, setMerged] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dir = FileSystemService.getCurrentDirectory();

  useEffect(() => {
    loadConflicts();
  }, []);

  async function loadConflicts() {
    if (!dir) return;
    setLoading(true);
    try {
      const files = await GitService.getConflicts(dir);
      setConflicts(files.map(f => ({ path: f, resolved: false })));
      if (files.length > 0) selectFile(files[0]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectFile(path: string) {
    if (!dir) return;
    setSelected(path);
    setVersions(null);
    setMerged('');
    setLoadingVersions(true);
    try {
      const v = await GitService.getConflictVersions(dir, path);
      setVersions(v);
      // Default merged = ours (user can edit)
      setMerged(v.ours || v.base || '');
    } catch (e: any) {
      setError('Failed to load versions: ' + e.message);
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleResolve() {
    if (!dir || !selected) return;
    setSaving(true);
    try {
      // Write the merged content to the file
      await fetch('http://localhost:23816/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selected, content: merged }),
      });
      // Mark as resolved (git add)
      await GitService.resolveConflict(dir, selected);
      setConflicts(prev => prev.map(c => c.path === selected ? { ...c, resolved: true } : c));
      // Move to next unresolved
      const next = conflicts.find(c => !c.resolved && c.path !== selected);
      if (next) selectFile(next.path);
      else if (conflicts.every(c => c.resolved || c.path === selected)) {
        onAllResolved?.();
      }
    } catch (e: any) {
      setError('Failed to resolve: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>Loading conflicts…</div>;
  if (!conflicts.length) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#3fb950', fontSize: 13, fontWeight: 600 }}>✓ No merge conflicts</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>All conflicts have been resolved.</span>
    </div>
  );

  const unresolvedCount = conflicts.filter(c => !c.resolved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0883e' }}>
            ⚠ {unresolvedCount} conflict{unresolvedCount !== 1 ? 's' : ''} remaining
          </span>
        </div>
      </div>

      {/* File list */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-color)', maxHeight: 120, overflowY: 'auto' }}>
        {conflicts.map(c => (
          <div
            key={c.path}
            onClick={() => !c.resolved && selectFile(c.path)}
            style={{
              padding: '6px 12px', fontSize: 12, cursor: c.resolved ? 'default' : 'pointer',
              background: selected === c.path ? 'rgba(14,99,156,0.12)' : 'transparent',
              borderLeft: `2px solid ${c.resolved ? '#3fb950' : selected === c.path ? 'var(--accent-color)' : '#f0883e'}`,
              display: 'flex', alignItems: 'center', gap: 6,
              color: c.resolved ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
          >
            <span style={{ fontSize: 10 }}>{c.resolved ? '✓' : '⚠'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.path}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '6px 12px', background: 'rgba(248,81,73,0.1)', color: '#f85149', fontSize: 12, flexShrink: 0 }}>
          {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f85149', marginLeft: 8 }}>✕</button>
        </div>
      )}

      {/* 3-way merge view */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 8, gap: 8 }}>
          {loadingVersions ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>Loading versions…</div>
          ) : versions ? (
            <>
              {/* Top: 3 panes */}
              <div style={{ display: 'flex', gap: 6, flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <DiffPane
                  label="Base"
                  content={versions.base}
                  color="#888"
                />
                <DiffPane
                  label="Ours (current)"
                  content={versions.ours}
                  color="#58a6ff"
                  onAccept={() => setMerged(versions.ours)}
                />
                <DiffPane
                  label="Theirs (incoming)"
                  content={versions.theirs}
                  color="#3fb950"
                  onAccept={() => setMerged(versions.theirs)}
                />
              </div>

              {/* Bottom: editable result */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Result (editable)
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setMerged(versions.ours + '\n' + versions.theirs)}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Accept Both
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={saving || !merged.trim()}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 4, border: 'none', background: '#3fb950', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                    >
                      {saving ? 'Saving…' : '✓ Mark Resolved'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={merged}
                  onChange={e => setMerged(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', padding: 8, fontFamily: 'monospace', fontSize: 12,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GitConflictResolver;

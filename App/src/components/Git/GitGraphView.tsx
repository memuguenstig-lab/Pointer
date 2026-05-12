import React, { useEffect, useState, useRef } from 'react';
import { GitService } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface CommitNode {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branches: string[];
  tags: string[];
  isCurrent: boolean;
  column: number;
  row: number;
}

interface GraphEdge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  color: string;
}

// Palette of branch colors
const BRANCH_COLORS = [
  '#58a6ff', '#3fb950', '#bc8cff', '#f0883e',
  '#ff7b72', '#79c0ff', '#56d364', '#d2a8ff',
  '#ffa657', '#ff9492',
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return BRANCH_COLORS[Math.abs(h) % BRANCH_COLORS.length];
}

const COL_W = 18;  // px per column
const ROW_H = 38;  // px per row
const DOT_R = 5;   // dot radius

const GitGraphView: React.FC = () => {
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ commit: CommitNode; x: number; y: number } | null>(null);
  const [maxCols, setMaxCols] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const dir = FileSystemService.getCurrentDirectory();

  useEffect(() => {
    if (!dir) { setError('No directory open'); setLoading(false); return; }
    load();
  }, [dir]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Get log with parent info via raw git
      const res = await fetch('http://localhost:23816/git/log-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: dir, limit: 80 }),
      });
      if (!res.ok) throw new Error('Failed to load graph');
      const data = await res.json();
      buildGraph(data.commits ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function buildGraph(raw: any[]) {
    if (!raw.length) { setCommits([]); setEdges([]); return; }

    // Assign columns using a lane-tracking algorithm
    const hashToRow = new Map<string, number>();
    raw.forEach((c, i) => hashToRow.set(c.hash, i));

    // lanes[col] = last hash occupying that lane
    const lanes: (string | null)[] = [];

    const nodes: CommitNode[] = [];
    const edgeList: GraphEdge[] = [];

    for (let row = 0; row < raw.length; row++) {
      const c = raw[row];
      const parents: string[] = c.parents ?? [];

      // Find or assign a lane for this commit
      let col = lanes.indexOf(c.hash);
      if (col === -1) {
        // Find first free lane
        col = lanes.indexOf(null);
        if (col === -1) { col = lanes.length; lanes.push(c.hash); }
        else lanes[col] = c.hash;
      }

      nodes.push({
        hash: c.hash,
        shortHash: c.hash.slice(0, 7),
        message: c.message ?? '',
        author: c.author ?? '',
        date: c.date ?? '',
        parents,
        branches: c.branches ?? [],
        tags: c.tags ?? [],
        isCurrent: c.isCurrent ?? false,
        column: col,
        row,
      });

      // Free this lane after use
      lanes[col] = null;

      // Assign lanes to parents
      parents.forEach((p, pi) => {
        const pRow = hashToRow.get(p);
        if (pRow === undefined) return;

        let pCol: number;
        if (pi === 0) {
          // First parent continues in same lane
          pCol = col;
          if (lanes[col] === null) lanes[col] = p;
        } else {
          // Merge parent — find or create a lane
          let existing = lanes.indexOf(p);
          if (existing !== -1) {
            pCol = existing;
          } else {
            pCol = lanes.indexOf(null);
            if (pCol === -1) { pCol = lanes.length; lanes.push(p); }
            else lanes[pCol] = p;
          }
        }

        edgeList.push({
          fromRow: row,
          fromCol: col,
          toRow: pRow,
          toCol: pCol,
          color: hashColor(p),
        });
      });
    }

    const mc = Math.max(...nodes.map(n => n.column)) + 1;
    setMaxCols(mc);
    setCommits(nodes);
    setEdges(edgeList);
  }

  if (loading) return <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>Loading graph…</div>;
  if (error) return <div style={{ padding: 16, color: '#f85149', fontSize: 12 }}>{error}</div>;
  if (!commits.length) return <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 12 }}>No commits found</div>;

  const svgW = maxCols * COL_W + 8;
  const totalH = commits.length * ROW_H;

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', minWidth: 0 }}>
        {/* SVG graph column */}
        <svg
          width={svgW}
          height={totalH}
          style={{ flexShrink: 0, display: 'block' }}
        >
          {/* Edges */}
          {edges.map((e, i) => {
            const x1 = e.fromCol * COL_W + COL_W / 2;
            const y1 = e.fromRow * ROW_H + ROW_H / 2;
            const x2 = e.toCol * COL_W + COL_W / 2;
            const y2 = e.toRow * ROW_H + ROW_H / 2;
            // Bezier curve for diagonal edges
            const mx = (x1 + x2) / 2;
            const d = x1 === x2
              ? `M${x1},${y1} L${x2},${y2}`
              : `M${x1},${y1} C${x1},${y1 + ROW_H * 0.6} ${x2},${y2 - ROW_H * 0.6} ${x2},${y2}`;
            return (
              <path key={i} d={d} stroke={e.color} strokeWidth={1.5} fill="none" opacity={0.7} />
            );
          })}

          {/* Dots */}
          {commits.map((c) => {
            const cx = c.column * COL_W + COL_W / 2;
            const cy = c.row * ROW_H + ROW_H / 2;
            const color = c.isCurrent ? '#3fb950' : hashColor(c.hash);
            return (
              <g key={c.hash}>
                <circle
                  cx={cx} cy={cy} r={DOT_R + 3}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(ev) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setTooltip({ commit: c, x: ev.clientX - (rect?.left ?? 0), y: ev.clientY - (rect?.top ?? 0) });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
                <circle cx={cx} cy={cy} r={DOT_R} fill={color} stroke="var(--bg-primary)" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                {c.isCurrent && (
                  <circle cx={cx} cy={cy} r={DOT_R + 3} fill="none" stroke={color} strokeWidth={1} opacity={0.5} style={{ pointerEvents: 'none' }} />
                )}
              </g>
            );
          })}
        </svg>

        {/* Commit info column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {commits.map((c) => (
            <div
              key={c.hash}
              style={{
                height: ROW_H,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 6,
                paddingRight: 8,
                borderBottom: '1px solid var(--border-color)',
                fontSize: 12,
                overflow: 'hidden',
              }}
            >
              {/* Branch/tag badges */}
              {c.branches.map(b => (
                <span key={b} style={{
                  padding: '1px 5px', borderRadius: 3, fontSize: 10, flexShrink: 0,
                  background: c.isCurrent && b === c.branches[0] ? 'rgba(63,185,80,0.2)' : 'rgba(88,166,255,0.15)',
                  color: c.isCurrent && b === c.branches[0] ? '#3fb950' : '#58a6ff',
                  border: `1px solid ${c.isCurrent && b === c.branches[0] ? 'rgba(63,185,80,0.4)' : 'rgba(88,166,255,0.3)'}`,
                  maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {b}
                </span>
              ))}
              {c.tags.map(t => (
                <span key={t} style={{
                  padding: '1px 5px', borderRadius: 3, fontSize: 10, flexShrink: 0,
                  background: 'rgba(240,136,62,0.15)', color: '#f0883e',
                  border: '1px solid rgba(240,136,62,0.3)',
                  maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  🏷 {t}
                </span>
              ))}

              {/* Commit message */}
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: 'var(--text-primary)', fontWeight: c.isCurrent ? 600 : 400,
              }}>
                {c.message}
              </span>

              {/* Hash + date */}
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }}>
                {c.shortHash}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, flexShrink: 0, opacity: 0.6 }}>
                {new Date(c.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top: tooltip.y + 8,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          maxWidth: 320,
          pointerEvents: 'none',
        }}>
          <div style={{ fontFamily: 'monospace', color: '#58a6ff', marginBottom: 4 }}>{tooltip.commit.hash}</div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{tooltip.commit.message}</div>
          <div style={{ color: 'var(--text-secondary)' }}>👤 {tooltip.commit.author}</div>
          <div style={{ color: 'var(--text-secondary)' }}>📅 {new Date(tooltip.commit.date).toLocaleString()}</div>
          {tooltip.commit.branches.length > 0 && (
            <div style={{ color: '#3fb950', marginTop: 4 }}>🌿 {tooltip.commit.branches.join(', ')}</div>
          )}
          {tooltip.commit.tags.length > 0 && (
            <div style={{ color: '#f0883e' }}>🏷 {tooltip.commit.tags.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default GitGraphView;

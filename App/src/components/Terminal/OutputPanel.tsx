import React, { useEffect, useRef, useState } from 'react';
import { OutputLine } from './types';

const sourceColor = (src: string) =>
  src.includes('err') ? '#f85149' : src === 'backend' ? '#58a6ff' : '#b0b0b0';

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

export default React.memo(OutputPanel);

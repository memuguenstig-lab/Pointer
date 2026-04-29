import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ThemeSettings } from '../types';
import ColorInput from './ColorInput';

// ── Mini live preview ──────────────────────────────────────────────────────

const LivePreview: React.FC<{ theme: ThemeSettings }> = ({ theme }) => {
  const c = theme.customColors;
  const kw  = theme.tokenColors?.find(t => t.token === 'keyword')?.foreground  || '#569cd6';
  const fn  = theme.tokenColors?.find(t => t.token === 'function')?.foreground || '#dcdcaa';
  const str = theme.tokenColors?.find(t => t.token === 'string')?.foreground   || '#ce9178';
  const vr  = theme.tokenColors?.find(t => t.token === 'variable')?.foreground || '#9cdcfe';
  const num = theme.tokenColors?.find(t => t.token === 'number')?.foreground   || '#b5cea8';
  const cm  = theme.tokenColors?.find(t => t.token === 'comment')?.foreground  || '#6a9955';
  const ln  = theme.editorColors['editorLineNumber.foreground'] || '#858585';
  const bg  = theme.editorColors['editor.background'] || c.bgSecondary || '#1e1e1e';
  const fg  = c.textPrimary || '#ccc';
  const acc = c.accentColor || '#0078d4';
  const neon = c.neonPulseColor || acc;
  const preset = c.animationPreset;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 8, overflow: 'hidden', border: `1px solid ${c.borderPrimary || '#333'}`, fontSize: 12 }}>
      {/* Titlebar */}
      <div style={{
        height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, flexShrink: 0,
        background: c.titlebarGradient && c.titlebarGradient !== 'none' ? c.titlebarGradient : (c.titlebarBg || c.bgPrimary || '#1e1e1e'),
        borderBottom: `1px solid ${preset === 'neon-pulse' ? neon : (c.borderPrimary || '#333')}`,
        boxShadow: preset === 'neon-pulse' ? `0 1px 12px ${neon}80` : 'none',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: fg, opacity: 0.7 }}>pointer — preview</span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Activity bar */}
        <div style={{ width: 36, background: c.activityBarBg || c.bgPrimary || '#1e1e1e', borderRight: `1px solid ${c.borderPrimary || '#333'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 8 }}>
          {[acc, c.activityBarFg || '#888', c.activityBarFg || '#888'].map((col, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: 3, background: col, opacity: i === 0 ? 1 : 0.5 }} />
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ width: 120, background: c.bgSecondary || '#252526', borderRight: `1px solid ${c.borderPrimary || '#333'}`, padding: '8px 0', overflow: 'hidden' }}>
          <div style={{ padding: '2px 8px', fontSize: 10, color: c.textSecondary || '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Explorer</div>
          {['src', 'App.tsx', 'index.css', 'package.json'].map((name, i) => (
            <div key={i} style={{
              padding: '3px 8px 3px 16px', fontSize: 11, cursor: 'default',
              color: i === 1 ? acc : (c.textPrimary || '#ccc'),
              background: i === 1 ? `${acc}22` : 'transparent',
              borderLeft: i === 1 ? `2px solid ${acc}` : '2px solid transparent',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{name}</div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, background: bg, padding: '8px 0 8px 4px', overflow: 'hidden', fontFamily: 'Consolas,monospace', fontSize: 11, lineHeight: 1.6 }}>
          {[
            [ln,'1', kw,'import ', vr,'React', fg,' from ', str,'"react"', fg,';'],
            [ln,'2', fg,''],
            [ln,'3', cm,'// Component'],
            [ln,'4', kw,'function ', fn,'App', fg,'() {'],
            [ln,'5', fg,'  ', kw,'const ', vr,'x', fg,' = ', num,'42', fg,';'],
            [ln,'6', fg,'  ', kw,'return ', fg,'('],
            [ln,'7', fg,'    <', fn,'div', fg,' style={{ color: ', str,'"red"', fg,' }}>'],
            [ln,'8', fg,'      Hello World'],
            [ln,'9', fg,'    </', fn,'div', fg,'>'],
            [ln,'10',fg,'  );'],
            [ln,'11',fg,'}'],
          ].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'baseline', paddingLeft: 4 }}>
              <span style={{ color: row[0] as string, width: 22, textAlign: 'right', marginRight: 8, opacity: 0.5, flexShrink: 0, fontSize: 10 }}>{row[1]}</span>
              {(row.slice(2) as string[]).map((seg, si) =>
                si % 2 === 0 ? <span key={si} style={{ color: seg }}>{(row.slice(2) as string[])[si + 1]}</span> : null
              )}
            </div>
          ))}
        </div>

        {/* Chat panel */}
        <div style={{ width: 140, background: c.chatBg || c.bgPrimary || '#1e1e1e', borderLeft: `1px solid ${c.borderPrimary || '#333'}`, display: 'flex', flexDirection: 'column', padding: 8, gap: 6, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: c.textSecondary || '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chat</div>
          <div style={{ background: c.chatAiBubbleBg || c.bgSecondary || '#252526', borderRadius: 6, padding: '5px 7px', fontSize: 10, color: c.chatAiBubbleFg || fg }}>How can I help?</div>
          <div style={{
            background: c.chatUserBubbleGradient && c.chatUserBubbleGradient !== 'none'
              ? c.chatUserBubbleGradient
              : (c.chatUserBubbleBg || acc),
            borderRadius: 6, padding: '5px 7px', fontSize: 10,
            color: c.chatUserBubbleFg || '#fff', alignSelf: 'flex-end',
          }}>Fix this bug</div>
          <div style={{ flex: 1 }} />
          <div style={{ background: c.chatInputBg || c.bgSecondary || '#252526', border: `1px solid ${c.chatInputBorder || c.borderPrimary || '#333'}`, borderRadius: 4, padding: '4px 6px', fontSize: 10, color: c.textSecondary || '#888' }}>Ask anything…</div>
        </div>
      </div>

      {/* Statusbar */}
      <div style={{
        height: 20, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 12, flexShrink: 0,
        background: c.statusbarGradient && c.statusbarGradient !== 'none' ? c.statusbarGradient : (c.statusbarBg || acc),
        color: c.statusbarFg || '#fff', fontSize: 10,
      }}>
        <span>main</span><span>TypeScript</span><span>Ln 5, Col 12</span>
      </div>
    </div>
  );
};

// ── Section component ──────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
      }}>
        <span>{title}</span>
        <span style={{ fontSize: 10, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>
      {open && <div style={{ padding: '4px 12px 12px' }}>{children}</div>}
    </div>
  );
};

// ── Main ThemeEditor component ─────────────────────────────────────────────

interface ThemeEditorProps {
  isVisible: boolean;
  theme: ThemeSettings;
  onClose: () => void;
  onChange: (theme: ThemeSettings) => void;
}

const ThemeEditor: React.FC<ThemeEditorProps> = ({ isVisible, theme, onClose, onChange }) => {
  const [local, setLocal] = useState<ThemeSettings>(theme);

  // Sync when parent theme changes (e.g. preset selected)
  useEffect(() => { setLocal(theme); }, [theme]);

  const setColor = useCallback((key: keyof ThemeSettings['customColors'], val: string) => {
    setLocal(prev => {
      const next = { ...prev, customColors: { ...prev.customColors, [key]: val } };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const setEditorColor = useCallback((key: string, val: string) => {
    setLocal(prev => {
      const next = { ...prev, editorColors: { ...prev.editorColors, [key]: val } };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const setTokenColor = useCallback((index: number, field: 'foreground' | 'fontStyle', val: string) => {
    setLocal(prev => {
      const tc = [...(prev.tokenColors || [])];
      tc[index] = { ...tc[index], [field]: val };
      const next = { ...prev, tokenColors: tc };
      onChange(next);
      return next;
    });
  }, [onChange]);

  if (!isVisible) return null;

  const c = local.customColors;

  // Helper: compact color row
  const C = (label: string, key: keyof ThemeSettings['customColors'], cssVar = '') => (
    <ColorInput key={key} label={label} value={(c[key] as string) || ''} onChange={v => setColor(key, v)} variable={cssVar} />
  );

  // Helper: text input row
  const T = (label: string, key: keyof ThemeSettings['customColors'], placeholder = '') => (
    <div key={key} style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={(c[key] as string) || ''}
        onChange={e => setColor(key, e.target.value)}
        style={{ width: '100%', padding: '4px 7px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }}
      />
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 3000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '92vw', maxWidth: 1300, height: '88vh',
        background: 'var(--bg-primary)',
        borderRadius: 12, border: '1px solid var(--border-primary)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Edit Theme</h3>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>Changes apply live — save via the main settings Save button</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body: controls left, preview right */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Controls ── */}
          <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border-primary)' }}>

            <Section title="Backgrounds" defaultOpen={true}>
              {C('Primary BG',   'bgPrimary',   '--bg-primary')}
              {C('Secondary BG', 'bgSecondary', '--bg-secondary')}
              {C('Tertiary BG',  'bgTertiary',  '--bg-tertiary')}
              {C('Selected BG',  'bgSelected',  '--bg-selected')}
              {C('Hover BG',     'bgHover',     '--bg-hover')}
            </Section>

            <Section title="Text & Accent">
              {C('Primary Text',   'textPrimary',   '--text-primary')}
              {C('Secondary Text', 'textSecondary', '--text-secondary')}
              {C('Accent',         'accentColor',   '--accent-color')}
              {C('Accent Hover',   'accentHover',   '--accent-hover')}
              {C('Error',          'errorColor',    '--error-color')}
              {C('Inline Code',    'inlineCodeColor','--inline-code-color')}
            </Section>

            <Section title="Bars & Borders">
              {C('Titlebar BG',       'titlebarBg',      '--titlebar-bg')}
              {C('Statusbar BG',      'statusbarBg',     '--statusbar-bg')}
              {C('Statusbar Text',    'statusbarFg',     '--statusbar-fg')}
              {C('Activity Bar BG',   'activityBarBg',   '--activity-bar-bg')}
              {C('Activity Bar Icons','activityBarFg',   '--activity-bar-fg')}
              {C('Border',            'borderColor',     '--border-color')}
            </Section>

            <Section title="Chat UI">
              {C('Chat BG',          'chatBg',            '--chat-bg')}
              {C('User Bubble BG',   'chatUserBubbleBg',  '--chat-user-bubble-bg')}
              {C('User Bubble Text', 'chatUserBubbleFg',  '--chat-user-bubble-fg')}
              {C('AI Bubble BG',     'chatAiBubbleBg',    '--chat-ai-bubble-bg')}
              {C('AI Bubble Text',   'chatAiBubbleFg',    '--chat-ai-bubble-fg')}
              {C('Input BG',         'chatInputBg',       '--chat-input-bg')}
              {C('Input Border',     'chatInputBorder',   '--chat-input-border')}
              {T('User Bubble Gradient', 'chatUserBubbleGradient', 'linear-gradient(135deg,#0078d4,#005a9e)')}
            </Section>

            <Section title="Gradients & Glow">
              {T('Titlebar Gradient',    'titlebarGradient',    'linear-gradient(180deg,#1e1e1e,#252526)')}
              {T('Statusbar Gradient',   'statusbarGradient',   'linear-gradient(90deg,#007acc22,#005a9e22)')}
              {T('Accent Gradient',      'accentGradient',      'linear-gradient(135deg,#0078d4,#005a9e)')}
              {C('Glow Color',           'glowColor')}
              {T('Accent Glow',          'accentGlow',          '0 0 8px rgba(0,120,212,0.5)')}
              {T('Neon Pulse Color',     'neonPulseColor',      '#ff00ff')}
            </Section>

            <Section title="Animation">
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Animation Preset</label>
                <select
                  value={c.animationPreset || 'none'}
                  onChange={e => setColor('animationPreset' as any, e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                >
                  {['none','neon-pulse','aurora','starfield','matrix-rain','scanlines'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {T('Transition Speed',  'transitionSpeed',  '0.15s')}
              {T('Scanlines Opacity', 'scanlinesOpacity', '0.04')}
            </Section>

            <Section title="Shape & Typography">
              {T('Border Radius',    'borderRadius',   '4px')}
              {T('Border Radius LG', 'borderRadiusLg', '8px')}
              {T('UI Font',          'fontUi',         'system-ui, sans-serif')}
              {T('Mono Font',        'fontMono',       'Consolas, monospace')}
              {T('Scrollbar Width',  'scrollbarWidth', '8px')}
              {C('Scrollbar Thumb',  'scrollbarThumb',      '--scrollbar-thumb')}
              {C('Scrollbar Hover',  'scrollbarThumbHover', '--scrollbar-thumb-hover')}
            </Section>

            <Section title="Monaco Editor Colors">
              {(['editor.background','editor.foreground','editorLineNumber.foreground','editorCursor.foreground','editor.selectionBackground','editor.lineHighlightBackground'] as const).map(k => (
                <ColorInput key={k} label={k.replace('editor.','').replace('editorLineNumber.','lineNum.').replace('editorCursor.','cursor.')} value={local.editorColors[k] || ''} onChange={v => setEditorColor(k, v)} variable="" />
              ))}
            </Section>

            <Section title="Syntax Highlighting">
              {(local.tokenColors || []).map((tc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 70, flexShrink: 0 }}>{tc.token}</span>
                  <input type="color" value={tc.foreground || '#ffffff'} onChange={e => setTokenColor(i, 'foreground', e.target.value)} style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: tc.foreground || '#fff', fontFamily: 'monospace', flex: 1 }}>{tc.foreground}</span>
                  <select value={tc.fontStyle || ''} onChange={e => setTokenColor(i, 'fontStyle', e.target.value)} style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 3, color: 'var(--text-primary)' }}>
                    <option value="">normal</option>
                    <option value="bold">bold</option>
                    <option value="italic">italic</option>
                    <option value="bold italic">bold italic</option>
                  </select>
                </div>
              ))}
            </Section>

          </div>

          {/* ── Live Preview ── */}
          <div style={{ flex: 1, padding: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-tertiary)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Preview</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <LivePreview theme={local} />
            </div>
            {/* Color swatches */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['BG',     c.bgPrimary],
                ['BG2',    c.bgSecondary],
                ['Text',   c.textPrimary],
                ['Accent', c.accentColor],
                ['Error',  c.errorColor],
                ['Border', c.borderColor],
              ].map(([label, color]) => color ? (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: color as string, border: '1px solid rgba(255,255,255,0.1)' }} />
                  {label}
                </div>
              ) : null)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeEditor;

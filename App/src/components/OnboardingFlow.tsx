import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'pointer-onboarding-done';

interface Step {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  accent: string;
}

// ── Individual step content ────────────────────────────────────────────────

const WelcomeStep = () => (
  <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
    <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>👋</div>
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
      Shadow is an AI-powered code editor that runs entirely on your machine.
      Your code never leaves your computer — the AI works locally or via your own API keys.
    </p>
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
      {[
        { icon: '🤖', label: 'Local AI' },
        { icon: '🔒', label: 'Private' },
        { icon: '⚡', label: 'Fast' },
        { icon: '🌐', label: 'OpenAI / Claude / Grok' },
      ].map(f => (
        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 13 }}>
          <span>{f.icon}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const EditorStep = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
      The editor is Monaco-based (same as VS Code). Open a folder to get started.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[
        { key: 'Ctrl+I', desc: 'Open AI chat' },
        { key: 'Ctrl+Shift+I', desc: 'AI edit selection' },
        { key: 'Ctrl+Shift+E', desc: 'Explain selected code' },
        { key: 'Ctrl+Shift+B', desc: 'Toggle git blame' },
        { key: 'Ctrl+,', desc: 'Open settings' },
        { key: 'Ctrl+Shift+P', desc: 'Command palette' },
        { key: 'Ctrl+\\', desc: 'Split editor' },
        { key: 'Ctrl+Shift+N', desc: 'New window' },
      ].map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <kbd style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 11, fontFamily: 'monospace', flexShrink: 0, color: 'var(--accent-color)' }}>
            {s.key}
          </kbd>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

const AIStep = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
      The AI chat panel (Ctrl+I) is your main interface. The agent can read files, run terminal commands, search your codebase, and make edits — all autonomously.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { icon: '📁', title: 'File access', desc: 'Reads and writes any file in your workspace' },
        { icon: '💻', title: 'Terminal', desc: 'Runs commands and sees the output in real time' },
        { icon: '🔍', title: 'Codebase search', desc: 'Searches semantically across your entire project' },
        { icon: '🌐', title: 'Web search', desc: 'Can look things up on the internet' },
      ].map(f => (
        <div key={f.title} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ModelsStep = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
      Choose how you want to run AI. You can mix and match — use a local model for privacy and a cloud model for heavy tasks.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { icon: '📦', title: 'Embedded (recommended)', desc: 'Download a model once, runs 100% offline. No API key needed.', accent: '#3fb950' },
        { icon: '🏠', title: 'Local (LM Studio / Ollama)', desc: 'Use any model running on your machine via OpenAI-compatible API.', accent: '#58a6ff' },
        { icon: '☁️', title: 'OpenAI / Claude / Grok', desc: 'Use cloud models with your own API key. Costs per token.', accent: '#bc8cff' },
      ].map(m => (
        <div key={m.title} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-secondary)', border: `1px solid ${m.accent}33` }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: m.accent }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.desc}</div>
          </div>
        </div>
      ))}
    </div>
    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, opacity: 0.7 }}>
      Configure in Settings → Models. You can set different models for chat, code completion, and agent tasks.
    </p>
  </div>
);

const GitStep = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
      The Git panel (source control icon in the sidebar) gives you a full git workflow without leaving the editor.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[
        { icon: '📋', label: 'Status & commit' },
        { icon: '📜', label: 'Commit history' },
        { icon: '🌿', label: 'Branch management' },
        { icon: '🔀', label: 'Merge & rebase' },
        { icon: '⚠️', label: 'Conflict resolver' },
        { icon: '📊', label: 'Branch graph' },
        { icon: '✨', label: 'AI commit messages' },
        { icon: '📝', label: 'AI PR descriptions' },
      ].map(f => (
        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 12 }}>
          <span>{f.icon}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const ReadyStep = () => (
  <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
    <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>🚀</div>
    <p style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
      You're all set!
    </p>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px' }}>
      Open a folder to start coding. Press <kbd style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-color)' }}>Ctrl+I</kbd> to open the AI chat anytime.
    </p>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      {[
        { icon: '📖', label: 'Docs', href: 'https://pointer.f1shy312.com' },
        { icon: '💬', label: 'Discord', href: 'https://discord.gg/vhgc8THmNk' },
        { icon: '⭐', label: 'GitHub', href: 'https://github.com/PointerIDE' },
      ].map(l => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', cursor: 'pointer' }}
          onClick={e => { e.preventDefault(); (window as any).electron?.openExternal?.(l.href); }}
        >
          <span>{l.icon}</span> {l.label}
        </a>
      ))}
    </div>
  </div>
);

// ── Steps definition ───────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 'welcome', title: 'Welcome to Shadow', subtitle: 'Your AI-powered code editor', icon: '✦', content: <WelcomeStep />, accent: '#58a6ff' },
  { id: 'editor',  title: 'The Editor',         subtitle: 'Monaco-based, keyboard-first', icon: '⌨', content: <EditorStep />, accent: '#3fb950' },
  { id: 'ai',      title: 'AI Agent',            subtitle: 'Your autonomous coding partner', icon: '🤖', content: <AIStep />, accent: '#bc8cff' },
  { id: 'models',  title: 'Choose Your AI',      subtitle: 'Local, embedded, or cloud', icon: '⚙', content: <ModelsStep />, accent: '#f0883e' },
  { id: 'git',     title: 'Git Integration',     subtitle: 'Full workflow, AI-assisted', icon: '⎇', content: <GitStep />, accent: '#58a6ff' },
  { id: 'ready',   title: "Let's Go",            subtitle: 'Start building something great', icon: '🚀', content: <ReadyStep />, accent: '#3fb950' },
];

// ── Main component ─────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onDone: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const go = (dir: 1 | -1) => {
    if (animating) return;
    const next = step + dir;
    if (next < 0 || next >= STEPS.length) return;
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 180);
  };

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onDone();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 560, maxWidth: '92vw',
        background: 'var(--bg-primary)',
        borderRadius: 12,
        border: `1px solid ${current.accent}44`,
        boxShadow: `0 0 60px ${current.accent}22, 0 24px 48px rgba(0,0,0,0.5)`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg-secondary)' }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${current.accent}, ${current.accent}aa)`,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: `${current.accent}18`, border: `1px solid ${current.accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {current.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {current.title}
            </div>
            <div style={{ fontSize: 13, color: current.accent, marginTop: 3 }}>
              {current.subtitle}
            </div>
          </div>
          {/* Step counter */}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0, paddingTop: 4 }}>
            {step + 1} / {STEPS.length}
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px 28px',
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.18s, transform 0.18s',
          minHeight: 220,
        }}>
          {current.content}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 4 }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { if (!animating) { setAnimating(true); setTimeout(() => { setStep(i); setAnimating(false); }, 180); } }}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i === step ? current.accent : 'var(--border-color)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 28px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => go(-1)}
            disabled={step === 0}
            style={{
              padding: '8px 18px', fontSize: 13, borderRadius: 6,
              border: '1px solid var(--border-color)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: step === 0 ? 'default' : 'pointer',
              opacity: step === 0 ? 0.3 : 1, transition: 'opacity 0.15s',
            }}
          >
            ← Back
          </button>

          <button
            onClick={() => go(1)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 4,
              border: 'none', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5,
            }}
            onClickCapture={() => finish()}
          >
            Skip
          </button>

          <button
            onClick={isLast ? finish : () => go(1)}
            style={{
              padding: '8px 22px', fontSize: 13, borderRadius: 6, fontWeight: 600,
              border: 'none', background: current.accent, color: '#fff',
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {isLast ? 'Get Started →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Returns true if onboarding should be shown */
export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export default OnboardingFlow;

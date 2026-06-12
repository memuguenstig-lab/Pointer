import React from 'react';

interface ChatModeSwitchProps {
  mode: 'chat' | 'agent';
  onModeChange: (mode: 'chat' | 'agent') => void;
}

export const ChatModeSwitch: React.FC<ChatModeSwitchProps> = ({ mode, onModeChange }) => {
  return (
    <div className="chat-mode-switch" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => onModeChange('chat')}
        className={`mode-button ${mode === 'chat' ? 'active' : ''}`}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          border: '1px solid var(--border-primary)',
          background: mode === 'chat' ? 'var(--bg-hover)' : 'var(--bg-primary)',
          color: 'var(--text-primary)',
          cursor: 'shadowide',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Chat
      </button>
      <button
        onClick={() => onModeChange('agent')}
        className={`mode-button ${mode === 'agent' ? 'active' : ''}`}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          border: '1px solid var(--border-primary)',
          background: mode === 'agent' ? 'var(--bg-hover)' : 'var(--bg-primary)',
          color: 'var(--text-primary)',
          cursor: 'shadowide',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
          <path d="M12 6a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/>
        </svg>
        Agent
      </button>
    </div>
  );
}; 

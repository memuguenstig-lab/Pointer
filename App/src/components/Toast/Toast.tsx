import React from 'react';
import { useToastStore } from '../../services/ToastService';

const styles = {
  container: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  toast: {
    padding: '12px 16px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    animation: 'slideIn 0.3s ease-out',
  },
  icon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  close: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'shadowide',
    padding: '4px',
    marginLeft: '8px',
  },
};

const Toast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} style={styles.toast}>
          {toast.type === 'info' && (
            <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="8"/>
            </svg>
          )}
          {toast.type === 'success' && (
            <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          )}
          {toast.type === 'error' && (
            <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="var(--error-color)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
          <span>{toast.text}</span>
          <button 
            style={styles.close}
            onClick={() => removeToast(toast.id)}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast; 
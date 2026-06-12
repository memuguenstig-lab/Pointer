import React, { ReactNode } from 'react';
import { logger } from '../services/LoggerService';

interface Props {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied?: boolean;
}

/**
 * Error Boundary Component
 * Catches React component errors and displays graceful error UI
 * Prevents entire app from crashing due to component errors
 * 
 * Improvement 11: Comprehensive error handling with logging
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React component error caught', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback?.(this.state.error!) || (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#111218',
            color: '#e2e8f0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            boxSizing: 'border-box',
            textAlign: 'center'
          }}>
            <div style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: '#1b1d28',
              borderRadius: '12px',
              border: '1px solid #ff4a4a44',
              padding: '32px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div style={{ fontSize: '48px' }}>⚡</div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: '#ff6b6b' }}>
                Application Error Occurred
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                An unexpected crash was intercepted. You can attempt to reload the application to restore your workspace.
              </p>
              
              <div style={{
                textAlign: 'left',
                backgroundColor: '#0f1015',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #2e303f',
                maxHeight: '200px',
                overflow: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#f87171',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}<br />
                {this.state.error?.stack && (
                  <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '11px' }}>
                    {this.state.error.stack}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '10px' }}>
                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                  🔄 Reload & Recover
                </button>
                <button 
                  onClick={() => {
                    const errorText = `Error: ${this.state.error?.message || 'Unknown error'}\nStack: ${this.state.error?.stack || 'No stack'}`;
                    navigator.clipboard.writeText(errorText);
                    this.setState({ copied: true });
                    setTimeout(() => this.setState({ copied: false }), 2000);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#0f1015',
                    color: '#94a3b8',
                    border: '1px solid #2e303f',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = '#2e303f'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  {this.state.copied ? '✅ Copied!' : '📋 Copy Error details'}
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

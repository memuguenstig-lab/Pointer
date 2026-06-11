import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeSnippetWidgetProps {
  code: string;
  language: string;
  filename?: string;
  onCopy?: () => void;
  onRun?: () => void;
}

const CodeSnippetWidget: React.FC<CodeSnippetWidgetProps> = ({
  code,
  language,
  filename,
  onCopy,
  onRun
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '16px',
      margin: '12px 0',
      maxWidth: '600px',
      boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.2))'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>💻</span>
          <span>{filename || 'Code Snippet'}</span>
          <span style={{
            fontSize: '11px',
            background: 'var(--accent-color)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            fontWeight: 'normal'
          }}>
            {language}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onRun && (
            <button
              onClick={onRun}
              style={{
                background: 'var(--success-color)',
                border: 'none',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'shadowide',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              ▶ Run
            </button>
          )}
          <button
            onClick={handleCopy}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'shadowide',
              fontSize: '12px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--accent-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div style={{
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          customStyle={{
            margin: '0',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeSnippetWidget;

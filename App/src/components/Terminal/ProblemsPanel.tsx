import React from 'react';

interface Props {
  errorCount: number;
  warningCount: number;
}

const ProblemsPanel: React.FC<Props> = ({ errorCount, warningCount }) => (
  <div style={{ flex: 1, padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, overflow: 'auto' }}>
    {errorCount === 0 && warningCount === 0
      ? <div style={{ opacity: 0.5, marginTop: 8 }}>No problems detected.</div>
      : <>
        {errorCount > 0 && (
          <div style={{ color: '#f85149', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.78 4.22a.75.75 0 0 1 0 1.06L9.06 8l1.72 1.72a.75.75 0 1 1-1.06 1.06L8 9.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 0 1 1.06 0z"/>
            </svg>
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ color: '#d29922', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z"/>
            </svg>
            {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </div>
        )}
      </>
    }
  </div>
);

export default React.memo(ProblemsPanel);

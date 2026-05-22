import React from 'react';

interface DiagramData {
  type: 'bar' | 'pie' | 'line' | 'flowchart' | 'mermaid';
  data?: any;
  code?: string;
  title?: string;
}

interface DiagramWidgetProps {
  diagram: DiagramData;
}

const DiagramWidget: React.FC<DiagramWidgetProps> = ({ diagram }) => {
  const renderMermaidDiagram = () => {
    if (!diagram.code) return null;

    return (
      <div style={{
        background: 'var(--bg-primary)',
        padding: '16px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
          📊 {diagram.title || 'Diagram'}
        </div>
        <code>{String(diagram.code)}</code>
      </div>
    );
  };

  const renderSimpleChart = () => {
    if (!diagram.data) return null;

    const maxValue = Math.max(...Object.values(diagram.data).map(Number));

    return (
      <div style={{
        background: 'var(--bg-primary)',
        padding: '16px',
        borderRadius: '4px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ marginBottom: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
          📊 {diagram.title || 'Chart'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(diagram.data).map(([label, value]) => {
            const percentage = (Number(value) / maxValue) * 100;
            return (
              <div key={label}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  marginBottom: '4px',
                  color: 'var(--text-primary)'
                }}>
                  <span>{label}</span>
                  <span>{String(value)}</span>
                </div>
                <div style={{
                  height: '24px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)'
                }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'var(--accent-color)',
                      transition: 'width 0.3s ease',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '16px',
      margin: '12px 0',
      maxWidth: '500px',
      boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.2))'
    }}>
      {diagram.type === 'mermaid' || diagram.type === 'flowchart' ? (
        renderMermaidDiagram()
      ) : (
        renderSimpleChart()
      )}
    </div>
  );
};

export default DiagramWidget;

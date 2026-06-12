import React, { useEffect, useRef, useState } from 'react';
import { FileSystemItem } from '../types';
import { getPreviewType } from '../utils/previewUtils';

interface PreviewPaneProps {
  file: FileSystemItem;
  content?: string;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ file, content }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [markdownHtml, setMarkdownHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const previewType = getPreviewType(file.name);

  useEffect(() => {
    if (previewType === 'html' && content) {
      renderHTMLPreview(content);
    } else if (previewType === 'markdown' && content) {
      renderMarkdownPreview(content);
    }
  }, [content, previewType]);

  const renderHTMLPreview = (htmlContent: string) => {
    if (iframeRef.current) {
      try {
        const iframe = iframeRef.current;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
        }
        setError(null);
      } catch (err) {
        setError('Failed to render HTML preview');
        console.error('HTML preview error:', err);
      }
    }
  };

  const renderMarkdownPreview = async (markdownContent: string) => {
    try {
      // Simple markdown to HTML conversion
      // For a more robust solution, you might want to use a library like marked or remark
      let html = markdownContent
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Line breaks
        .replace(/\n/gim, '<br>');

      // Add basic styling
      const styledHtml = `
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #cccccc;
                background-color: #1e1e1e;
                padding: 20px;
                margin: 0;
              }
              h1, h2, h3, h4, h5, h6 {
                color: #ffffff;
                margin-top: 24px;
                margin-bottom: 16px;
              }
              h1 { font-size: 2em; }
              h2 { font-size: 1.5em; }
              h3 { font-size: 1.25em; }
              code {
                background-color: #2d2d2d;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: 'Consolas', 'Courier New', monospace;
              }
              pre {
                background-color: #2d2d2d;
                padding: 16px;
                border-radius: 6px;
                overflow-x: auto;
              }
              pre code {
                background-color: transparent;
                padding: 0;
              }
              a {
                color: #58a6ff;
                text-decoration: none;
              }
              a:hover {
                text-decoration: underline;
              }
              strong {
                color: #ffffff;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      setMarkdownHtml(styledHtml);
      setError(null);
    } catch (err) {
      setError('Failed to render Markdown preview');
      console.error('Markdown preview error:', err);
    }
  };

  if (!previewType) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div>
          <svg width="48" height="48" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5, marginBottom: '16px' }}>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0V5zm1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="currentColor"/>
          </svg>
          <div>Preview not available for this file type</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--error-color)',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div>
          <svg width="48" height="48" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5, marginBottom: '16px' }}>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0V5zm1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="currentColor"/>
          </svg>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div>Loading preview...</div>
      </div>
    );
  }

  if (previewType === 'html') {
    return (
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#ffffff',
        }}
        title={`Preview of ${file.name}`}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  if (previewType === 'markdown') {
    return (
      <iframe
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#1e1e1e',
        }}
        title={`Preview of ${file.name}`}
        srcDoc={markdownHtml}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  return null;
};

export default PreviewPane; 

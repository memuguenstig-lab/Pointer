import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { ExtendedMessage } from '../config/chatConfig';
import LinkHoverCard from './LinkHoverCard';
import { TaskListWidget, DiagramWidget, ThreeDWidget, CodeSnippetWidget } from './widgets';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ChatMessageProps {
  message: ExtendedMessage;
  index: number;
  isAnyProcessing?: boolean;
  onEditMessage?: (index: number) => void;
  onContinue?: (messageIndex: number) => void;
}

const ChatMessage = memo(({ message, index, isAnyProcessing = false, onEditMessage, onContinue }: ChatMessageProps) => {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  
  const handleEdit = () => {
    if (onEditMessage) {
      onEditMessage(index);
    }
  };

  // Check if this is an error message
  const isErrorMessage = (content: string): boolean => {
    const errorPatterns = [
      /I apologize, but I encountered an error/,
      /I apologize, but an error occurred/,
      /I'm having trouble processing your request/,
      /encountered an error while trying to continue/,
      /Error processing your request/,
      /Failed to process/,
      /An error occurred/,
      /Operation cancelled by user/,
      /but encountered an error:/
    ];
    
    return errorPatterns.some(pattern => pattern.test(content));
  };

  const isNoModelLoadedError = (content: string): boolean => {
    return /No model loaded\. Load a model first\.|No previously loaded model found/i.test(content);
  };

  const openModelSettings = () => {
    if (typeof window.loadSettings === 'function') {
      void window.loadSettings().catch((error) => {
        console.warn('Failed to reload settings before opening model settings:', error);
      });
    }

    window.dispatchEvent(new CustomEvent('pointer-open-settings', {
      detail: {
        category: 'models',
      },
    }));
  };

  // Extract error details if available
  const extractErrorDetails = (content: string): string | null => {
    const detailPatterns = [
      /error:\s*(.+)/i,
      /failed:\s*(.+)/i,
      /exception:\s*(.+)/i,
      /details:\s*(.+)/i,
      /but encountered an error:\s*(.+)/i
    ];
    
    for (const pattern of detailPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  };

  // Parse widgets from message content
  const parseWidgets = (content: string) => {
    const widgets: any = {};
    
    // Parse task lists: ```tasklist\n- [x] Task 1\n- [ ] Task 2\n```
    const taskListMatch = content.match(/```tasklist\n([\s\S]*?)```/);
    if (taskListMatch) {
      const tasks = taskListMatch[1].split('\n')
        .filter(line => line.trim())
        .map((line, i) => {
          const completed = line.includes('[x]');
          const text = line.replace(/\[x\]|\[\]/, '').trim();
          return { id: `task-${i}`, text, completed };
        });
      widgets.taskList = { tasks };
    }
    
    // Parse diagrams: ```diagram:bar\n{"A": 10, "B": 20}\n```
    const diagramMatch = content.match(/```diagram:(\w+)\n([\s\S]*?)```/);
    if (diagramMatch) {
      const type = diagramMatch[1] as any;
      const dataContent = diagramMatch[2].trim();
      try {
        const data = JSON.parse(dataContent);
        widgets.diagram = { type, data };
      } catch {
        widgets.diagram = { type, code: dataContent };
      }
    }
    
    // Parse 3D models: ```3d:cube\ndescription...\n```
    const threeDMatch = content.match(/```3d:(\w+)\n([\s\S]*?)```/);
    if (threeDMatch) {
      const type = threeDMatch[1];
      const description = threeDMatch[2].trim();
      widgets.threeD = { type: type as any, description };
    }
    
    return widgets;
  };

  const renderMarkdown = (content: string) => {
    // Pre-process content to style function_call patterns with muted color
    const processedContent = content.replace(
      /function_call:\s*(\{[^}]*\})/g,
      (match, jsonPart) => {
        return `<span style="color: var(--text-muted, #666); opacity: 0.6; font-family: monospace; font-size: 0.9em;">${match}</span>`;
      }
    );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: CodeProps) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const code = String(children).replace(/\n$/, '');
            
            const isShortContent = code.length < 50 && !code.includes('\n');
            const isInline = props.inline === true || isShortContent;
            
            if (!isInline && language) {
              return (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: '0',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              );
            }
            
            if (isInline) {
              return (
                <code
                  style={{
                    background: 'var(--bg-code, rgba(0, 0, 0, 0.2))',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '0.9em',
                    fontFamily: 'var(--font-mono, "Fira Code", "Consolas", monospace)',
                    color: 'var(--inline-code-color, inherit)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            return (
              <pre
                style={{
                  background: 'var(--bg-code, rgba(0, 0, 0, 0.2))',
                  padding: '12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono, "Fira Code", "Consolas", monospace)',
                  overflow: 'auto',
                  margin: '8px 0',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                }}
              >
                <code>{children}</code>
              </pre>
            );
          },
          del: ({ children, ...props }) => (
            <del style={{
              textDecoration: 'line-through',
              color: 'var(--text-secondary)',
              opacity: 0.8
            }} {...props}>
              {children}
            </del>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote style={{
              borderLeft: '4px solid var(--accent-color)',
              margin: '16px 0',
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              fontStyle: 'italic',
              color: 'var(--text-secondary)'
            }} {...props}>
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                border: '1px solid var(--border-color)',
                borderRadius: '4px'
              }} {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead style={{
              background: 'var(--bg-secondary)',
              borderBottom: '2px solid var(--border-color)'
            }} {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr style={{
              borderBottom: '1px solid var(--border-color)'
            }} {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th style={{
              padding: '8px 12px',
              textAlign: 'left',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              borderRight: '1px solid var(--border-color)'
            }} {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td style={{
              padding: '8px 12px',
              borderRight: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }} {...props}>
              {children}
            </td>
          ),
          hr: ({ ...props }) => (
            <hr style={{
              border: 'none',
              height: '2px',
              background: 'var(--border-color, #444)',
              margin: '24px 0',
              borderRadius: '1px',
              opacity: 0.8
            }} {...props} />
          ),
          ul: ({ children, ...props }) => (
            <ul style={{ 
              margin: '8px 0',
              paddingLeft: '24px',
              listStyleType: 'disc'
            }} {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol style={{ 
              margin: '8px 0',
              paddingLeft: '24px',
              listStyleType: 'decimal'
            }} {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li style={{ 
              margin: '4px 0',
              lineHeight: '1.5'
            }} {...props}>
              {children}
            </li>
          ),
          a: ({ href, children, ...props }) => {
            const isExternalLink = href && (href.startsWith('http://') || href.startsWith('https://'));
            
            const handleClick = (e: React.MouseEvent) => {
              if (isExternalLink) {
                e.preventDefault();
                if (window.electronAPI && window.electronAPI.openExternal) {
                  window.electronAPI.openExternal(href);
                } else {
                  window.open(href, '_blank', 'noopener,noreferrer');
                }
              }
            };
            
            const linkElement = (
              <a
                href={href}
                target={isExternalLink ? '_blank' : undefined}
                rel={isExternalLink ? 'noopener noreferrer' : undefined}
                style={{
                  color: 'var(--accent-color)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--accent-color)',
                  transition: 'all 0.2s ease',
                  padding: '1px 2px',
                  borderRadius: '3px',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (isExternalLink) {
                    e.currentTarget.style.background = 'var(--accent-color)';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isExternalLink) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--accent-color)';
                  }
                }}
                onClick={handleClick}
                {...props}
              >
                {children}
              </a>
            );
            
            if (isExternalLink && href) {
              return (
                <LinkHoverCard url={href}>
                  {linkElement}
                </LinkHoverCard>
              );
            }
            
            return linkElement;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  const messageContent = typeof message.content === 'string' ? message.content : '';
  const isError = isErrorMessage(messageContent);
  const isNoModelLoaded = isNoModelLoadedError(messageContent);
  const errorDetails = isError ? extractErrorDetails(messageContent) : null;
  const widgets = parseWidgets(messageContent);

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: isError 
          ? 'var(--error-bg)' 
          : message.role === 'user' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        borderLeft: isError ? '4px solid var(--error-color)' : 'none',
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px' 
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: isError 
            ? 'var(--error-color)' 
            : message.role === 'user' ? 'var(--accent-color)' : 'var(--success-color)',
          textTransform: 'uppercase',
        }}>
          {isError ? 'Error' : message.role === 'user' ? 'You' : 'Assistant'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isError && onContinue && (
            <button
              onClick={() => {
                const content = typeof message.content === 'string' ? message.content : '';
                if (isNoModelLoadedError(content)) {
                  openModelSettings();
                  return;
                }
                onContinue(index);
              }}
              disabled={isAnyProcessing}
              style={{
                background: 'var(--accent-color)',
                border: '1px solid var(--accent-color)',
                color: 'white',
                cursor: isAnyProcessing ? 'not-allowed' : 'pointer',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                opacity: isAnyProcessing ? 0.6 : 1,
              }}
              title={
                isAnyProcessing
                  ? "Processing..."
                  : isNoModelLoaded
                    ? "Open model settings"
                    : "Retry this conversation"
              }
              onMouseEnter={(e) => {
                if (!isAnyProcessing) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnyProcessing) {
                  e.currentTarget.style.background = 'var(--accent-color)';
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                }
              }}
            >
              {isAnyProcessing ? 'Processing...' : isNoModelLoaded ? 'Model Settings' : 'Continue'}
            </button>
          )}
          {isError && errorDetails && (
            <button
              onClick={() => setIsErrorExpanded(!isErrorExpanded)}
              style={{
                background: 'transparent',
                border: '1px solid var(--error-color)',
                color: 'var(--error-color)',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                transition: 'all 0.2s ease',
              }}
              title={isErrorExpanded ? "Hide error details" : "Show error details"}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--error-color)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--error-color)';
              }}
            >
              {isErrorExpanded ? 'Hide Details' : 'Show Details'}
            </button>
          )}
          {message.role === 'user' && onEditMessage && (
            <button
              onClick={handleEdit}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
              }}
              title="Edit message"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ 
          flex: 1,
          color: isError ? 'var(--error-text)' : 'var(--text-primary)', 
          lineHeight: '1.5',
          fontSize: '14px',
        }}>
          {renderMarkdown(messageContent)}
        </div>
        
        {/* Widget Panel - Right Side */}
        {Object.keys(widgets).length > 0 && (
          <div style={{
            width: '350px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {widgets.taskList && (
              <TaskListWidget
                tasks={widgets.taskList.tasks}
                onTaskToggle={(taskId) => {
                  console.log('Toggle task:', taskId);
                }}
                onTaskAdd={(text) => {
                  console.log('Add task:', text);
                }}
              />
            )}
            {widgets.diagram && (
              <DiagramWidget diagram={widgets.diagram} />
            )}
            {widgets.threeD && (
              <ThreeDWidget model={widgets.threeD} />
            )}
          </div>
        )}
      </div>
      
      {/* Error details section */}
      {isError && errorDetails && isErrorExpanded && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--error-bg)',
          border: '1px solid var(--error-border)',
          borderRadius: '4px',
          fontSize: '13px',
          color: 'var(--error-text)',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Error Details:
          </div>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {errorDetails}
          </div>
        </div>
      )}
      
      {message.timestamp && (
        <div style={{
          fontSize: '11px',
          color: isError ? 'var(--error-text)' : 'var(--text-secondary)',
          marginTop: '8px',
        }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;

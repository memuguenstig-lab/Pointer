import React, { useState, useEffect } from 'react';
import { FileSystemItem } from '../types';
import { ActivityView } from './ActivityBar';
import { AIFileService } from '../services/AIFileService';

interface StatusBarProps {
  currentFileId: string | null;
  items: Record<string, FileSystemItem>;
  cursorPosition: { line: number; column: number };
  saveStatus: 'saved' | 'saving' | 'error' | null;
  activeView: ActivityView;
  onToggleGitView: () => void;
  onOpenSettings?: () => void;
  workspaceName?: string;
  errorCount?: number;
  warningCount?: number;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
    py: 'Python', rs: 'Rust', go: 'Go', rb: 'Ruby', java: 'Java', cs: 'C#',
    cpp: 'C++', c: 'C', html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON',
    md: 'Markdown', yaml: 'YAML', yml: 'YAML', sh: 'Shell', bat: 'Batch',
    sql: 'SQL', xml: 'XML', toml: 'TOML', vue: 'Vue', svelte: 'Svelte',
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : 'Plain Text');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const StatusBar: React.FC<StatusBarProps> = ({
  currentFileId,
  items,
  cursorPosition,
  saveStatus,
  activeView,
  onToggleGitView,
  onOpenSettings,
  workspaceName,
  errorCount = 0,
  warningCount = 0,
}) => {
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [time, setTime] = useState(() => new Date());
  const [activeModel, setActiveModel] = useState<{ chat: string; agent: string } | null>(null);

  // Fetch git branch + status
  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await fetch('http://localhost:23816/git/branch');
        if (res.ok) {
          const data = await res.json();
          setGitBranch(data.branch ?? null);
        }
      } catch {
        setGitBranch(null);
      }
    };
    fetchBranch();
    const id = setInterval(fetchBranch, 10000);
    return () => clearInterval(id);
  }, []);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load active model names
  useEffect(() => {
    const load = async () => {
      try {
        const [chatCfg, agentCfg] = await Promise.all([
          AIFileService.getModelConfigForPurpose('chat'),
          AIFileService.getModelConfigForPurpose('agent'),
        ]);
        const shorten = (id: string) => id.length > 24 ? id.slice(0, 22) + '…' : id;
        setActiveModel({
          chat: shorten(chatCfg.modelId || 'none'),
          agent: shorten(agentCfg.modelId || 'none'),
        });
      } catch {
        setActiveModel(null);
      }
    };
    load();
    // Refresh when settings change
    window.addEventListener('settings-saved', load);
    return () => window.removeEventListener('settings-saved', load);
  }, []);

  const currentFile = currentFileId ? items[currentFileId] : null;
  const filename = currentFile?.name ?? '';
  const language = filename ? getLanguage(filename) : '';
  const content = (currentFile as any)?.content ?? '';
  const lineCount = content ? content.split('\n').length : 0;
  const byteSize = content ? new Blob([content]).size : 0;

  // Derive workspace name from root item in items
  const rootItem = Object.values(items).find(i => i.parentId === null && i.type === 'directory');
  const resolvedWorkspaceName = workspaceName || rootItem?.name || null;

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const saveIcon = saveStatus === 'saving'
    ? '↻'
    : saveStatus === 'error'
    ? '✕'
    : saveStatus === 'saved'
    ? '✓'
    : null;

  const saveColor = saveStatus === 'error'
    ? '#f85149'
    : saveStatus === 'saved'
    ? '#3fb950'
    : 'inherit';

  return (
    <div className="status-bar">
      {/* Left section */}
      <div className="status-bar__left">
        {/* Always show git branch OR a workspace indicator */}
        <button
          className="status-bar__item status-bar__item--btn"
          onClick={onToggleGitView}
          title="Source Control"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, opacity: 0.7 }}>
            <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/>
          </svg>
          <span>{gitBranch ?? (resolvedWorkspaceName || 'No repo')}</span>
        </button>

        {saveIcon && (
          <span className="status-bar__item" style={{ color: saveColor, gap: 4 }}>
            <span style={{ fontSize: 11 }}>{saveIcon}</span>
            <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span>
          </span>
        )}

        {/* Errors & Warnings */}
        <span
          className="status-bar__item"
          style={{ color: errorCount > 0 ? '#f85149' : 'inherit', gap: 4, opacity: errorCount > 0 ? 1 : 0.55 }}
          title={`${errorCount} error${errorCount !== 1 ? 's' : ''}`}
        >
          {/* ✕ circle icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.78 4.22a.75.75 0 0 1 0 1.06L9.06 8l1.72 1.72a.75.75 0 1 1-1.06 1.06L8 9.06l-1.72 1.72a.75.75 0 0 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 0 1 1.06 0z"/>
          </svg>
          <span>{errorCount}</span>
        </span>

        <span
          className="status-bar__item"
          style={{ color: warningCount > 0 ? '#d29922' : 'inherit', gap: 4, opacity: warningCount > 0 ? 1 : 0.55 }}
          title={`${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
        >
          {/* ⚠ triangle icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z"/>
          </svg>
          <span>{warningCount}</span>
        </span>
      </div>

      {/* Right section */}
      <div className="status-bar__right">
        {currentFile && (
          <>
            <span className="status-bar__item" title="Cursor position">
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
            <span className="status-bar__divider" />
            {lineCount > 0 && (
              <>
                <span className="status-bar__item" title="Total lines">
                  {lineCount.toLocaleString()} lines
                </span>
                <span className="status-bar__divider" />
              </>
            )}
            {byteSize > 0 && (
              <>
                <span className="status-bar__item" title="File size">
                  {formatBytes(byteSize)}
                </span>
                <span className="status-bar__divider" />
              </>
            )}
            {language && (
              <span className="status-bar__item" title="Language">
                {language}
              </span>
            )}
            <span className="status-bar__divider" />
            <span className="status-bar__item" title="Encoding">
              UTF-8
            </span>
            <span className="status-bar__divider" />
          </>
        )}
        {/* Active model indicator */}
        {activeModel && (
          <>
            <button
              className="status-bar__item status-bar__item--btn"
              onClick={onOpenSettings}
              title={`Chat: ${activeModel.chat}\nAgent: ${activeModel.agent}\nClick to change models`}
              style={{ gap: 4, opacity: 0.8 }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75zM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
              </svg>
              <span style={{ fontSize: 11 }}>{activeModel.chat}</span>
            </button>
            <span className="status-bar__divider" />
          </>
        )}
        <span className="status-bar__item status-bar__item--time" title="Current time">
          {timeStr}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;

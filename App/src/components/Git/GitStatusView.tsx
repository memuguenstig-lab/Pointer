import React, { useState } from 'react';
import { GitStatus, GitService } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface GitStatusViewProps {
  gitStatus: GitStatus | null;
  refreshStatus: (newGitStatus?: GitStatus) => Promise<void>;
  onPush?: () => Promise<void>;
}

// ── Inline diff popup ──────────────────────────────────────────────────────
function FileDiffPopup({ directory, filePath, staged, onClose }: {
  directory: string; filePath: string; staged: boolean; onClose: () => void;
}) {
  const [diff, setDiff] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    GitService.diffFile(directory, filePath, staged)
      .then(d => { setDiff(d); setLoading(false); })
      .catch(() => { setDiff('Could not load diff.'); setLoading(false); });
  }, [directory, filePath, staged]);

  // Parse unified diff into colored lines
  const renderDiff = (raw: string) => {
    if (!raw.trim()) return <div style={{ color: 'var(--text-secondary)', padding: '12px', fontSize: '12px' }}>No changes</div>;
    return raw.split('\n').map((line, i) => {
      let bg = 'transparent', color = 'var(--text-primary)';
      if (line.startsWith('+') && !line.startsWith('+++')) { bg = 'rgba(63,185,80,0.12)'; color = '#3fb950'; }
      else if (line.startsWith('-') && !line.startsWith('---')) { bg = 'rgba(248,81,73,0.12)'; color = '#f85149'; }
      else if (line.startsWith('@@')) { bg = 'rgba(14,99,156,0.12)'; color = 'var(--accent-color)'; }
      else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
        color = 'var(--text-secondary)';
      }
      return (
        <div key={i} style={{ background: bg, color, fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', padding: '0 8px', whiteSpace: 'pre' }}>
          {line || ' '}
        </div>
      );
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '55vw', minWidth: '400px',
      background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.35)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{filePath}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
            {staged ? '(staged)' : '(unstaged)'}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>Loading diff…</div>
        ) : (
          renderDiff(diff ?? '')
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '0 8px',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    padding: '4px 0',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    fontSize: '13px',
    borderRadius: '4px',
    marginBottom: '4px',
    cursor: 'pointer',
  },
  staged: {
    backgroundColor: 'rgba(0, 170, 0, 0.1)',
  },
  unstaged: {
    backgroundColor: 'rgba(212, 63, 58, 0.1)',
  },
  untracked: {
    backgroundColor: 'rgba(97, 175, 239, 0.1)',
  },
  fileIcon: {
    marginRight: '8px',
    fontSize: '14px',
    width: '14px',
    display: 'inline-block',
    textAlign: 'center' as const,
  },
  button: {
    background: 'var(--bg-accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    marginRight: '8px',
  },
  commitContainer: {
    marginTop: '20px',
    padding: '12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
  },
  commitInput: {
    width: '100%',
    padding: '8px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  noChanges: {
    padding: '12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  branchInfo: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
  },
  branchName: {
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  error: {
    color: 'var(--error-color)',
    padding: '8px',
    marginTop: '8px',
    backgroundColor: 'rgba(244, 135, 113, 0.1)',
    borderRadius: '4px',
  },
};

const GitStatusView: React.FC<GitStatusViewProps> = ({ gitStatus, refreshStatus, onPush }) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const [isUnstaging, setIsUnstaging] = useState(false);
  const [diffFile, setDiffFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [showPRPanel, setShowPRPanel] = useState(false);
  const [prDescription, setPRDescription] = useState('');
  const [isGeneratingPR, setIsGeneratingPR] = useState(false);
  const [prBase, setPRBase] = useState('main');

  const handleGeneratePRDescription = async () => {
    const currentDirectory = FileSystemService.getCurrentDirectory();
    if (!currentDirectory) return;
    setIsGeneratingPR(true);
    setPRDescription('');
    try {
      const { commits, branch, base } = await GitService.getPRCommits(currentDirectory, prBase);
      if (!commits.length) { setPRDescription('No commits found between branches.'); return; }
      const commitList = commits.map((c: any) => `- ${c.message} (${c.author_name ?? c.author})`).join('\n');
      const lmStudio = (await import('../../services/LMStudioService')).default;
      let generated = '';
      await lmStudio.createStreamingChatCompletion({
        model: '', purpose: 'chat',
        messages: [
          { role: 'system', content: 'You are a PR description writer. Write a clear, professional pull request description with a summary and bullet points of changes. Use markdown.' },
          { role: 'user', content: `Branch: ${branch} → ${base}\n\nCommits:\n${commitList}\n\nWrite a PR description.` },
        ],
        temperature: 0.4,
        onUpdate: (c) => { generated = c; setPRDescription(c); },
      });
    } catch (e: any) {
      setPRDescription('Failed to generate PR description: ' + e.message);
    } finally {
      setIsGeneratingPR(false);
    }
  };

  const handleGenerateCommitMessage = async () => {
    const currentDirectory = FileSystemService.getCurrentDirectory();
    if (!currentDirectory || !gitStatus) return;
    setIsGeneratingMessage(true);
    setError(null);
    try {
      // Get staged diff, fall back to unstaged
      let diff = await GitService.diffFile(currentDirectory, '.', true).catch(() => '');
      if (!diff.trim()) diff = await GitService.diffFile(currentDirectory, '.', false).catch(() => '');
      if (!diff.trim()) { setError('No changes to generate message from'); return; }

      // Truncate very large diffs
      const truncated = diff.length > 6000 ? diff.slice(0, 6000) + '\n... (truncated)' : diff;

      const lmStudio = (await import('../../services/LMStudioService')).default;
      let generated = '';
      await lmStudio.createStreamingChatCompletion({
        model: '',
        purpose: 'chat',
        messages: [
          {
            role: 'system',
            content: 'You are a git commit message generator. Write a concise, conventional commit message (max 72 chars subject line, optional body). Use format: type(scope): description. Types: feat, fix, refactor, docs, style, test, chore. Reply with ONLY the commit message, no explanation.',
          },
          {
            role: 'user',
            content: `Generate a commit message for this diff:\n\n${truncated}`,
          },
        ],
        temperature: 0.3,
        onUpdate: (content) => { generated = content; },
      });
      if (generated.trim()) setCommitMessage(generated.trim());
    } catch (e: any) {
      setError('Failed to generate message: ' + e.message);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  if (!gitStatus) {
    return <div style={styles.noChanges}>No git repository information available.</div>;
  }

  const hasChanges = gitStatus.changes.staged.length > 0 || 
                    gitStatus.changes.unstaged.length > 0 || 
                    gitStatus.changes.untracked.length > 0 ||
                    gitStatus.changes.hasCommitsToPush;

  const currentDirectory = FileSystemService.getCurrentDirectory();

  const handleStageFile = async (file: string) => {
    if (!currentDirectory) return;
    
    setIsStaging(true);
    setError(null);
    
    try {
      const result = await GitService.addFiles(currentDirectory, [file]);
      
      if (!result.success) {
        setError(`Failed to stage file: ${result.error}`);
      } else {
        if (gitStatus) {
          const newGitStatus = {
            ...gitStatus,
            changes: {
              ...gitStatus.changes,
              staged: [...gitStatus.changes.staged, file],
              unstaged: gitStatus.changes.unstaged.filter(f => f !== file),
              untracked: gitStatus.changes.untracked.filter(f => f !== file)
            }
          };
          refreshStatus(newGitStatus);
        }
      }
    } catch (err) {
      console.error('Error staging file:', err);
      setError(`Error staging file: ${err}`);
    } finally {
      setIsStaging(false);
    }
  };

  const handleUnstageFile = async (file: string) => {
    if (!currentDirectory) return;
    
    setIsUnstaging(true);
    setError(null);
    
    try {
      const result = await GitService.resetFiles(currentDirectory, [file]);
      
      if (!result.success) {
        setError(`Failed to unstage file: ${result.error}`);
      } else {
        if (gitStatus) {
          const newGitStatus = {
            ...gitStatus,
            changes: {
              ...gitStatus.changes,
              staged: gitStatus.changes.staged.filter(f => f !== file),
              unstaged: [...gitStatus.changes.unstaged, file]
            }
          };
          refreshStatus(newGitStatus);
        }
      }
    } catch (err) {
      console.error('Error unstaging file:', err);
      setError(`Error unstaging file: ${err}`);
    } finally {
      setIsUnstaging(false);
    }
  };

  const handleStageAll = async () => {
    if (!currentDirectory) return;
    
    const allFiles = [
      ...gitStatus.changes.unstaged,
      ...gitStatus.changes.untracked
    ];
    
    if (allFiles.length === 0) return;
    
    setIsStaging(true);
    setError(null);
    
    try {
      const result = await GitService.addFiles(currentDirectory, allFiles);
      
      if (!result.success) {
        setError(`Failed to stage all files: ${result.error}`);
      } else {
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error staging all files:', err);
      setError(`Error staging all files: ${err}`);
    } finally {
      setIsStaging(false);
    }
  };

  const handleUnstageAll = async () => {
    if (!currentDirectory || gitStatus.changes.staged.length === 0) return;
    
    setIsUnstaging(true);
    setError(null);
    
    try {
      const result = await GitService.resetFiles(currentDirectory, gitStatus.changes.staged);
      
      if (!result.success) {
        setError(`Failed to unstage all files: ${result.error}`);
      } else {
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error unstaging all files:', err);
      setError(`Error unstaging all files: ${err}`);
    } finally {
      setIsUnstaging(false);
    }
  };

  const handleCommit = async () => {
    if (!currentDirectory || !commitMessage.trim() || gitStatus.changes.staged.length === 0) return;
    
    setIsCommitting(true);
    setError(null);
    
    try {
      const result = await GitService.commit(currentDirectory, commitMessage);
      
      if (!result.success) {
        setError(`Failed to commit changes: ${result.error}`);
      } else {
        setCommitMessage('');
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error committing changes:', err);
      setError(`Error committing changes: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    if (!onPush) return;
    
    setIsPushing(true);
    setError(null);
    
    try {
      await onPush();
    } catch (err) {
      console.error('Error pushing changes:', err);
      setError(`Error pushing changes: ${err}`);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.branchInfo}>
        <span>Current branch:</span>
        <span style={styles.branchName}>{gitStatus.branch}</span>
      </div>
      
      {!hasChanges ? (
        <div style={styles.noChanges}>No changes detected in the repository.</div>
      ) : (
        <>
          {/* Staged Changes Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Staged Changes ({gitStatus.changes.staged.length})
              {gitStatus.changes.staged.length > 0 && (
                <button 
                  onClick={handleUnstageAll}
                  style={{ float: 'right', fontSize: '11px', marginTop: '-2px' }}
                  disabled={isUnstaging}
                >
                  {isUnstaging ? 'Unstaging...' : 'Unstage All'}
                </button>
              )}
            </div>
            {gitStatus.changes.staged.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '12px' }}>
                No staged changes
              </div>
            ) : (
              gitStatus.changes.staged.map((file) => (
                <div
                  key={file}
                  style={{ ...styles.fileItem, ...styles.staged, justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
                    onClick={() => handleUnstageFile(file)}>
                    <span style={styles.fileIcon}>✓</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDiffFile({ path: file, staged: true }); }}
                    title="View diff"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px', padding: '0 4px', flexShrink: 0, opacity: 0.7 }}
                  >
                    ⟨/⟩
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Unstaged Changes Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Unstaged Changes ({gitStatus.changes.unstaged.length})
              {gitStatus.changes.unstaged.length > 0 && (
                <button 
                  onClick={() => handleStageAll()}
                  style={{ float: 'right', fontSize: '11px', marginTop: '-2px' }}
                  disabled={isStaging}
                >
                  {isStaging ? 'Staging...' : 'Stage All'}
                </button>
              )}
            </div>
            {gitStatus.changes.unstaged.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '12px' }}>
                No unstaged changes
              </div>
            ) : (
              gitStatus.changes.unstaged.map((file) => (
                <div
                  key={file}
                  style={{ ...styles.fileItem, ...styles.unstaged, justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
                    onClick={() => handleStageFile(file)}>
                    <span style={styles.fileIcon}>M</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDiffFile({ path: file, staged: false }); }}
                    title="View diff"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px', padding: '0 4px', flexShrink: 0, opacity: 0.7 }}
                  >
                    ⟨/⟩
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Untracked Files Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Untracked Files ({gitStatus.changes.untracked.length})
              {gitStatus.changes.untracked.length > 0 && (
                <button 
                  onClick={() => handleStageAll()}
                  style={{ float: 'right', fontSize: '11px', marginTop: '-2px' }}
                  disabled={isStaging}
                >
                  {isStaging ? 'Staging...' : 'Stage All'}
                </button>
              )}
            </div>
            {gitStatus.changes.untracked.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '12px' }}>
                No untracked files
              </div>
            ) : (
              gitStatus.changes.untracked.map((file) => (
                <div 
                  key={file} 
                  style={{ ...styles.fileItem, ...styles.untracked }}
                  onClick={() => handleStageFile(file)}
                >
                  <span style={styles.fileIcon}>+</span>
                  <span>{file}</span>
                </div>
              ))
            )}
          </div>

          {/* Commit Section */}
          <div style={styles.commitContainer}>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <textarea
                style={{ ...styles.commitInput, marginBottom: 0, paddingRight: '80px' }}
                placeholder="Enter commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isCommitting}
                rows={3}
              />
              <button
                onClick={handleGenerateCommitMessage}
                disabled={isGeneratingMessage || gitStatus.changes.staged.length === 0 && gitStatus.changes.unstaged.length === 0}
                title="Generate commit message with AI"
                style={{
                  position: 'absolute', top: '6px', right: '6px',
                  padding: '3px 8px', fontSize: '10px', borderRadius: '3px',
                  border: '1px solid var(--border-color)',
                  background: isGeneratingMessage ? 'var(--bg-accent)' : 'var(--bg-secondary)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '3px',
                  opacity: isGeneratingMessage ? 0.7 : 1,
                }}
              >
                {isGeneratingMessage ? '…' : '✨ AI'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button
                style={styles.button}
                onClick={handleCommit}
                disabled={!commitMessage.trim() || isCommitting}
              >
                {isCommitting ? 'Committing...' : 'Commit Changes'}
              </button>
              {onPush && gitStatus.changes.hasCommitsToPush && (
                <button
                  style={{
                    ...styles.button,
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                  }}
                  onClick={handlePush}
                  disabled={isPushing}
                >
                  {isPushing ? 'Pushing...' : 'Push Changes'}
                </button>
              )}
            </div>
            
            {gitStatus.changes.staged.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Stage changes before committing
              </span>
            )}
          </div>
        </>
      )}
      
      {error && (
        <div style={styles.error}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* PR Description button */}
      <div style={{ padding: '8px 0 0' }}>
        <button
          onClick={() => setShowPRPanel(v => !v)}
          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          {showPRPanel ? '✕ Close PR' : '📋 Generate PR Description'}
        </button>
      </div>

      {/* PR Description panel */}
      {showPRPanel && (
        <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Base branch:</span>
            <input
              value={prBase}
              onChange={e => setPRBase(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
              placeholder="main"
            />
            <button
              onClick={handleGeneratePRDescription}
              disabled={isGeneratingPR}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', opacity: isGeneratingPR ? 0.7 : 1 }}
            >
              {isGeneratingPR ? '…' : '✨ Generate'}
            </button>
          </div>
          {prDescription && (
            <>
              <textarea
                value={prDescription}
                onChange={e => setPRDescription(e.target.value)}
                rows={8}
                style={{ width: '100%', padding: '8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <button
                onClick={() => navigator.clipboard.writeText(prDescription)}
                style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Copy
              </button>
            </>
          )}
        </div>
      )}
      {diffFile && currentDirectory && (
        <FileDiffPopup
          directory={currentDirectory}
          filePath={diffFile.path}
          staged={diffFile.staged}
          onClose={() => setDiffFile(null)}
        />
      )}
    </div>
  );
};

export default GitStatusView;
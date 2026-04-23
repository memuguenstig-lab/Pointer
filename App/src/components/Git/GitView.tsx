import React, { useState, useEffect } from 'react';
import { GitService, GitStatus, GitLogEntry } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';
import { showToast } from '../../services/ToastService';
import GitStatusView from './GitStatusView';
import GitLogView from './GitLogView';
import GitBranchView from './GitBranchView';
import GitStashView from './GitStashView';
import GitPullRequestView from './GitPullRequestView';

// CSS styles for the GitView
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    borderRight: '1px solid var(--border-color)',
  },
  header: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-secondary, #1e1e2e)',
  },
  title: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
    letterSpacing: '1px',
    color: '#bbbbbb',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  iconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  navBar: {
    display: 'flex',
    flexDirection: 'row' as const,
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    overflowX: 'auto' as const,
  },
  navButton: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.1s',
    flexShrink: 0,
  },
  activeNavButton: {
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--accent-color)',
  },
  navButtonIcon: {
    width: '16px',
    height: '16px',
    marginRight: '8px',
    flexShrink: 0,
  },
  navButtonLabel: {
    fontSize: '13px',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
    backgroundColor: 'var(--bg-primary, #282838)',
  },
  notGitRepo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center' as const,
    padding: '20px',
  },
  initButton: {
    background: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    marginTop: '16px',
    fontSize: '13px',
  },
  dialog: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'var(--bg-primary)',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '400px',
    zIndex: 1000,
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  dialogTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    color: 'var(--text-primary)',
  },
  input: {
    width: '100%',
    padding: '8px',
    marginBottom: '12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  cancelButton: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
  },
  statusMessage: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    padding: '12px 16px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    zIndex: 1000,
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  statusClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    marginLeft: '8px',
  },
};

// Types of views in the Git panel
type GitViewType = 'status' | 'log' | 'branches' | 'stash' | 'pr';

interface GitViewProps {
  onBack?: () => void;
}

const GitView: React.FC<GitViewProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [activeView, setActiveView] = useState<GitViewType>('status');
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [identityName, setIdentityName] = useState('');
  const [identityEmail, setIdentityEmail] = useState('');
  const [isSettingIdentity, setIsSettingIdentity] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Add auto-refresh effect
  useEffect(() => {
    let refreshInterval: ReturnType<typeof setInterval>;

    if (isGitRepo && !isLoading) {
      // Check for changes every 2 seconds
      refreshInterval = setInterval(async () => {
        try {
          const status = await GitService.getStatus(currentDirectory);
          // Only refresh if there are changes
          if (status.changes.staged.length > 0 || 
              status.changes.unstaged.length > 0 || 
              status.changes.untracked.length > 0 ||
              status.changes.hasCommitsToPush) {
            setGitStatus(status);
          }
        } catch (err) {
          console.error('Error checking for changes:', err);
        }
      }, 2000);
    }

    // Cleanup interval on unmount or when dependencies change
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isGitRepo, isLoading, currentDirectory]);

  useEffect(() => {
    const initGitView = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const dir = FileSystemService.getCurrentDirectory();
        if (!dir) {
          setError('No current directory selected');
          setIsLoading(false);
          return;
        }
        
        setCurrentDirectory(dir);
        
        // Check if the current directory is a Git repository
        const isRepo = await GitService.isGitRepository(dir);
        setIsGitRepo(isRepo);
        
        if (isRepo) {
          // Get the Git status
          const status = await GitService.getStatus(dir);
          setGitStatus(status);
        }
      } catch (err) {
        console.error('Error initializing Git view:', err);
        setError(`Error initializing Git view: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    initGitView();
  }, []);

  const handleInitRepo = async () => {
    if (!currentDirectory) return;
    
    setIsLoading(true);
    try {
      const result = await GitService.initRepo(currentDirectory);
      if (result.success) {
        setIsGitRepo(true);
        const status = await GitService.getStatus(currentDirectory);
        setGitStatus(status);
      } else {
        setError(`Failed to initialize repository: ${result.error}`);
      }
    } catch (err) {
      console.error('Error initializing Git repository:', err);
      setError(`Error initializing Git repository: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async (newGitStatus?: GitStatus) => {
    if (!currentDirectory || !isGitRepo) return;
    
    if (newGitStatus) {
      setGitStatus(newGitStatus);
      return;
    }
    
    setIsLoading(true);
    showToast('Refreshing Git status...', 'info');
    
    try {
      const status = await GitService.getStatus(currentDirectory);
      setGitStatus(status);
      // Only show success message if we're not in a loading state
      if (!isLoading) {
        showToast('Git status refreshed', 'success');
      }
    } catch (err) {
      const errorMsg = `Error refreshing Git status: ${err}`;
      console.error(errorMsg);
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async (message: string) => {
    setCommitMessage(message);
    if (!message.trim()) return;
    
    showToast('Committing changes...', 'info');
    const result = await GitService.commit(currentDirectory, message);
    
    if (!result.success && result.error === 'IDENTITY_NOT_CONFIGURED') {
      showToast('Git identity not configured, opening setup...', 'info');
      setIdentityName(result.userName || '');
      setIdentityEmail(result.userEmail || '');
      setIsIdentityDialogOpen(true);
      return;
    }
    
    if (result.success) {
      showToast('Changes committed successfully', 'success');
      refreshStatus();
    } else {
      const errorMsg = `Commit failed: ${result.error}`;
      console.error(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleSetIdentity = async () => {
    if (!identityName.trim() || !identityEmail.trim()) return;
    
    setIsSettingIdentity(true);
    const result = await GitService.setIdentityConfig(currentDirectory, identityName, identityEmail);
    setIsSettingIdentity(false);
    
    if (result.success) {
      setIsIdentityDialogOpen(false);
      // Retry the commit if it was triggered by a commit attempt
      if (commitMessage) {
        handleCommit(commitMessage);
      }
    } else {
      console.error('Failed to set identity:', result.error);
    }
  };

  const handlePush = async () => {
    if (!currentDirectory || !isGitRepo) return;
    
    showToast('Pushing changes...', 'info');
    const result = await GitService.push(currentDirectory);
    
    if (result.success) {
      showToast(result.data, 'success');
      refreshStatus();
    } else {
      const errorMsg = `Push failed: ${result.error}`;
      console.error(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Git information...</div>;
    }

    if (error) {
      return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'var(--error-color)', fontSize: 13 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--bg-accent)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Dismiss
          </button>
        </div>
      );
    }

    if (!isGitRepo) {
      return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5">
            <circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/>
            <path d="M6 8.5v7"/><path d="M8.5 6.5C11 6.5 15.5 6.5 15.5 9" strokeLinecap="round"/>
          </svg>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No Git repository found</span>
          <button onClick={handleInitRepo} style={styles.initButton}>
            Initialize Repository
          </button>
        </div>
      );
    }

    switch (activeView) {
      case 'status':
        return <GitStatusView gitStatus={gitStatus} refreshStatus={refreshStatus} onPush={handlePush} />;
      case 'log':
        return <GitLogView />;
      case 'branches':
        return <GitBranchView refreshStatus={refreshStatus} />;
      case 'stash':
        return <GitStashView refreshStatus={refreshStatus} />;
      case 'pr':
        return <GitPullRequestView />;
      default:
        return <GitStatusView gitStatus={gitStatus} refreshStatus={refreshStatus} />;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header with actions only — title comes from sidebar-panel-header above */}
      <div style={{ ...styles.header, padding: '4px 8px' }}>
        <div style={styles.headerActions}>
          <button 
            onClick={() => refreshStatus()} 
            style={styles.iconButton}
            title="Refresh"
            disabled={isLoading || !isGitRepo}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/>
              <path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          {onBack && (
            <button onClick={onBack} style={styles.iconButton} title="Close Git">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {isGitRepo && !isLoading && (
        <div style={styles.navBar}>
          {(['status','log','branches','stash','pr'] as GitViewType[]).map((view) => {
            const labels: Record<GitViewType, string> = { status: 'Status', log: 'Log', branches: 'Branches', stash: 'Stash', pr: 'Pull Requests' };
            const isActive = activeView === view;
            return (
              <button
                key={view}
                style={{
                  ...styles.navButton,
                  ...(isActive ? styles.activeNavButton : {}),
                }}
                onClick={() => setActiveView(view)}
                title={labels[view]}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>
      )}
      
      <div style={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default GitView; 
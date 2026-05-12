import React, { useState, useEffect } from 'react';
import { GitService, GitLogEntry } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface GitLogViewProps {}

const styles = {
  container: {
    padding: '0 8px',
  },
  commitList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  commitItem: {
    padding: '12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  commitItemHover: {
    backgroundColor: 'var(--bg-hover)',
  },
  commitHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  commitHash: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  commitDate: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  commitMessage: {
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  commitAuthor: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--text-secondary)',
  },
  error: {
    color: 'var(--error-color)',
    padding: '12px',
    backgroundColor: 'rgba(244, 135, 113, 0.1)',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  button: {
    background: 'var(--bg-accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  select: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '13px',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    padding: '40px 0',
  },
  expandedCommit: {
    padding: '12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '4px',
    margin: '8px 0',
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: '200px',
    overflowY: 'auto' as const,
  },
};

const GitLogView: React.FC<GitLogViewProps> = () => {
  const [logs, setLogs] = useState<GitLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [limitCount, setLimitCount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ hash: string; author: string; date: string; message: string }[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const currentDirectory = FileSystemService.getCurrentDirectory();

  useEffect(() => {
    loadCommitHistory();
  }, [limitCount]);

  const loadCommitHistory = async () => {
    if (!currentDirectory) {
      setError('No current directory selected');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const logEntries = await GitService.getLog(currentDirectory, limitCount);
      setLogs(logEntries);
    } catch (err) {
      console.error('Error loading commit history:', err);
      setError(`Error loading commit history: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (err) {
      return dateStr;
    }
  };

  const handleResetHard = async (commitHash: string) => {
    if (!currentDirectory) return;
    
    if (!window.confirm(`Are you sure you want to hard reset to commit ${commitHash.substring(0, 7)}?\nThis will discard all local changes.`)) {
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await GitService.resetHard(currentDirectory, commitHash);
      
      if (!result.success) {
        setError(`Failed to reset to commit: ${result.error}`);
      } else {
        await loadCommitHistory();
      }
    } catch (err) {
      console.error('Error resetting to commit:', err);
      setError(`Error resetting to commit: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSoft = async (commitHash: string) => {
    if (!currentDirectory) return;
    
    if (!window.confirm(`Are you sure you want to soft reset to commit ${commitHash.substring(0, 7)}?\nThis will keep your changes as staged changes.`)) {
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await GitService.resetSoft(currentDirectory, commitHash);
      
      if (!result.success) {
        setError(`Failed to soft reset to commit: ${result.error}`);
      } else {
        await loadCommitHistory();
      }
    } catch (err) {
      console.error('Error soft resetting to commit:', err);
      setError(`Error soft resetting to commit: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetMixed = async (commitHash: string) => {
    if (!currentDirectory) return;
    
    if (!window.confirm(`Are you sure you want to mixed reset to commit ${commitHash.substring(0, 7)}?\nThis will keep your changes as unstaged changes.`)) {
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await GitService.resetMixed(currentDirectory, commitHash);
      
      if (!result.success) {
        setError(`Failed to mixed reset to commit: ${result.error}`);
      } else {
        await loadCommitHistory();
      }
    } catch (err) {
      console.error('Error mixed resetting to commit:', err);
      setError(`Error mixed resetting to commit: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpandCommit = (hash: string) => {
    if (expandedCommit === hash) {
      setExpandedCommit(null);
    } else {
      setExpandedCommit(hash);
    }
  };

  const handleSearch = async () => {
    if (!currentDirectory || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await GitService.searchLog(currentDirectory, searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      setError(`Search failed: ${err}`);
    } finally {
      setIsSearching(false);
    }
  };

  const displayedLogs = searchResults !== null
    ? searchResults.map(r => ({ hash: r.hash, author: r.author, date: r.date, message: r.message } as GitLogEntry))
    : logs;

  return (
    <div style={styles.container}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="Search commits…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, padding: '6px 10px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button style={styles.button} onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? '…' : 'Search'}
        </button>
        {searchResults !== null && (
          <button style={{ ...styles.button, background: 'transparent', border: '1px solid var(--border-color)' }}
            onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
            ✕
          </button>
        )}
      </div>

      <div style={styles.controls}>
        <button 
          style={styles.button}
          onClick={() => loadCommitHistory()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        
        <select 
          style={styles.select}
          value={limitCount}
          onChange={(e) => setLimitCount(Number(e.target.value))}
          disabled={isLoading}
        >
          <option value={10}>Last 10 commits</option>
          <option value={25}>Last 25 commits</option>
          <option value={50}>Last 50 commits</option>
          <option value={100}>Last 100 commits</option>
        </select>
      </div>
      
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
      
      {isLoading ? (
        <div style={styles.loading}>Loading commit history...</div>
      ) : displayedLogs.length === 0 ? (
        <div style={styles.emptyState}>{searchResults !== null ? 'No commits match your search' : 'No commit history found'}</div>
      ) : (
        <div style={styles.commitList}>
          {displayedLogs.map((commit) => {
            const isExpanded = expandedCommit === commit.hash;
            
            return (
              <div key={commit.hash}>
                <div 
                  style={{ 
                    ...styles.commitItem,
                    ...(isExpanded ? styles.commitItemHover : {})
                  }}
                  onClick={() => toggleExpandCommit(commit.hash)}
                  onMouseOver={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }
                  }}
                >
                  <div style={styles.commitHeader}>
                    <span style={styles.commitHash}>{commit.hash.substring(0, 10)}</span>
                    <span style={styles.commitDate}>{formatDate(commit.date)}</span>
                  </div>
                  <div style={styles.commitMessage}>{commit.message}</div>
                  <div style={styles.commitAuthor}>Author: {commit.author}</div>
                  
                  {isExpanded && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button 
                        style={styles.button}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetHard(commit.hash);
                        }}
                      >
                        Hard Reset
                      </button>
                      <button 
                        style={styles.button}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetSoft(commit.hash);
                        }}
                      >
                        Soft Reset
                      </button>
                      <button 
                        style={styles.button}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetMixed(commit.hash);
                        }}
                      >
                        Mixed Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GitLogView; 
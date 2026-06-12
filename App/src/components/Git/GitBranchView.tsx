import React, { useState, useEffect } from 'react';
import { GitService, GitStatus } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface GitBranchViewProps {
  refreshStatus: () => Promise<void>;
}

const styles = {
  container: {
    padding: '0 8px',
  },
  heading: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  branchList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '20px',
  },
  branchItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    cursor: 'shadowide',
    transition: 'background-color 0.2s',
  },
  currentBranch: {
    borderLeft: '3px solid var(--accent-color)',
  },
  branchName: {
    fontSize: '13px',
  },
  branchActions: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    background: 'var(--bg-accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'shadowide',
    fontSize: '13px',
  },
  input: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '8px',
    width: '100%',
    fontSize: '13px',
    marginBottom: '12px',
  },
  createBranchSection: {
    padding: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  error: {
    color: 'var(--error-color)',
    padding: '12px',
    backgroundColor: 'rgba(244, 135, 113, 0.1)',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--text-secondary)',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    padding: '40px 0',
  },
  mergeSection: {
    padding: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    marginTop: '20px',
  },
  select: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '8px',
    width: '100%',
    fontSize: '13px',
    marginBottom: '12px',
  },
};

const GitBranchView: React.FC<GitBranchViewProps> = ({ refreshStatus }) => {
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedBranchForMerge, setSelectedBranchForMerge] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  const currentDirectory = FileSystemService.getCurrentDirectory();

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    if (!currentDirectory) {
      setError('No current directory selected');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current git status to determine current branch
      const status = await GitService.getStatus(currentDirectory);
      setCurrentBranch(status.branch);
      
      // Get all branches
      const branchList = await GitService.getBranches(currentDirectory);
      setBranches(branchList);
      
      // Set the first branch as selected for merge if not the current branch
      if (branchList.length > 0) {
        const firstNonCurrentBranch = branchList.find(b => b !== status.branch);
        if (firstNonCurrentBranch) {
          setSelectedBranchForMerge(firstNonCurrentBranch);
        }
      }
    } catch (err) {
      console.error('Error loading branches:', err);
      setError(`Error loading branches: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!currentDirectory || !newBranchName.trim()) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const result = await GitService.checkout(currentDirectory, newBranchName, true);
      
      if (!result.success) {
        setError(`Failed to create branch: ${result.error}`);
      } else {
        setNewBranchName('');
        await loadBranches();
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error creating branch:', err);
      setError(`Error creating branch: ${err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCheckoutBranch = async (branch: string) => {
    if (!currentDirectory || branch === currentBranch) return;
    
    setIsCheckingOut(true);
    setError(null);
    
    try {
      const result = await GitService.checkout(currentDirectory, branch);
      
      if (!result.success) {
        setError(`Failed to checkout branch: ${result.error}`);
      } else {
        await loadBranches();
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error checking out branch:', err);
      setError(`Error checking out branch: ${err}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleMergeBranch = async () => {
    if (!currentDirectory || !selectedBranchForMerge || selectedBranchForMerge === currentBranch) return;
    
    setIsMerging(true);
    setError(null);
    
    try {
      const result = await GitService.merge(currentDirectory, selectedBranchForMerge);
      
      if (!result.success) {
        setError(`Failed to merge branch: ${result.error}`);
      } else {
        await loadBranches();
        await refreshStatus();
      }
    } catch (err) {
      console.error('Error merging branch:', err);
      setError(`Error merging branch: ${err}`);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div style={styles.container}>
      {error && (
        <div style={styles.error}>
          {error}
          <button 
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'transparent', border: 'none', cursor: 'shadowide', color: 'var(--text-primary)' }}
          >
            ✕
          </button>
        </div>
      )}
      
      <div style={styles.createBranchSection}>
        <div style={styles.heading}>Create New Branch</div>
        <input
          type="text"
          style={styles.input}
          placeholder="Branch name"
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
        />
        <button 
          style={styles.button}
          onClick={handleCreateBranch}
          disabled={isCreating || !newBranchName.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Branch'}
        </button>
      </div>
      
      <div style={styles.heading}>
        Branches
        <button 
          style={{ ...styles.button, float: 'right', fontSize: '12px', padding: '4px 8px' }}
          onClick={loadBranches}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {isLoading ? (
        <div style={styles.loading}>Loading branches...</div>
      ) : branches.length === 0 ? (
        <div style={styles.emptyState}>No branches found</div>
      ) : (
        <div style={styles.branchList}>
          {branches.map((branch) => (
            <div 
              key={branch}
              style={{ 
                ...styles.branchItem,
                ...(branch === currentBranch ? styles.currentBranch : {})
              }}
            >
              <span style={styles.branchName}>
                {branch} {branch === currentBranch && '(current)'}
              </span>
              
              {branch !== currentBranch && (
                <div style={styles.branchActions}>
                  <button 
                    style={styles.button}
                    onClick={() => handleCheckoutBranch(branch)}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? 'Checking out...' : 'Checkout'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {branches.length > 1 && (
        <div style={styles.mergeSection}>
          <div style={styles.heading}>Merge Branch</div>
          <select
            style={styles.select}
            value={selectedBranchForMerge}
            onChange={(e) => setSelectedBranchForMerge(e.target.value)}
            disabled={isMerging}
          >
            <option value="" disabled>Select a branch to merge</option>
            {branches
              .filter(branch => branch !== currentBranch)
              .map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))
            }
          </select>
          <button 
            style={styles.button}
            onClick={handleMergeBranch}
            disabled={isMerging || !selectedBranchForMerge || selectedBranchForMerge === currentBranch}
          >
            {isMerging ? 'Merging...' : 'Merge into current branch'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GitBranchView; 

import React, { useState, useEffect } from 'react';
import { GitService } from '../../services/gitService';
import { FileSystemService } from '../../services/FileSystemService';

interface GitPullRequestViewProps {}

const styles = {
  container: {
    padding: '0 8px',
  },
  heading: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  section: {
    padding: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    marginBottom: '20px',
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
  textarea: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '8px',
    width: '100%',
    fontSize: '13px',
    marginBottom: '12px',
    minHeight: '100px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
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
  error: {
    color: 'var(--error-color)',
    padding: '12px',
    backgroundColor: 'rgba(244, 135, 113, 0.1)',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  success: {
    color: '#4caf50',
    padding: '12px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--text-secondary)',
  },
  publishSection: {
    marginTop: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  checkboxWrapper: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
  },
};

const GitPullRequestView: React.FC<GitPullRequestViewProps> = () => {
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [baseBranch, setBaseBranch] = useState<string>('');
  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

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
    setSuccessMessage(null);

    try {
      // Get current git status to determine current branch
      const status = await GitService.getStatus(currentDirectory);
      setCurrentBranch(status.branch);
      
      // Get all branches
      const branchList = await GitService.getBranches(currentDirectory);
      setBranches(branchList);
      
      // Set a default base branch
      if (branchList.length > 0) {
        const mainBranch = branchList.find(b => b === 'main' || b === 'master');
        if (mainBranch && mainBranch !== status.branch) {
          setBaseBranch(mainBranch);
        } else if (branchList.length > 1) {
          const firstDifferentBranch = branchList.find(b => b !== status.branch);
          if (firstDifferentBranch) {
            setBaseBranch(firstDifferentBranch);
          }
        }
      }
      
      // Set a default PR title based on current branch
      if (status.branch && status.branch !== 'main' && status.branch !== 'master') {
        const formattedBranchName = status.branch
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .split('/')
          .pop() || '';
        
        setPrTitle(`${formattedBranchName.charAt(0).toUpperCase() + formattedBranchName.slice(1)}`);
      }
      
      // Set default repo name from directory name
      if (currentDirectory) {
        const dirParts = currentDirectory.split(/[/\\]/);
        const dirName = dirParts[dirParts.length - 1];
        if (dirName) {
          setRepoName(dirName);
        }
      }
    } catch (err) {
      console.error('Error loading branches:', err);
      setError(`Error loading branches: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePullRequest = async () => {
    if (!currentDirectory || !baseBranch || !currentBranch || !prTitle) {
      setError('Missing required fields for pull request');
      return;
    }
    
    setIsCreatingPR(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await GitService.pullRequest(currentDirectory, {
        title: prTitle,
        body: prDescription,
        baseBranch,
        headBranch: currentBranch
      });
      
      if (!result.success) {
        setError(`Failed to create pull request: ${result.error}`);
      } else {
        setSuccessMessage('Pull request created successfully! ' + result.data);
        // Keep the form data in case user wants to create another PR
      }
    } catch (err) {
      console.error('Error creating pull request:', err);
      setError(`Error creating pull request: ${err}`);
    } finally {
      setIsCreatingPR(false);
    }
  };

  const handlePull = async () => {
    if (!currentDirectory) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await GitService.pull(currentDirectory);
      
      if (!result.success) {
        setError(`Failed to pull changes: ${result.error}`);
      } else {
        setSuccessMessage('Successfully pulled changes');
        await loadBranches();
      }
    } catch (err) {
      console.error('Error pulling changes:', err);
      setError(`Error pulling changes: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    if (!currentDirectory) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await GitService.push(currentDirectory);
      
      if (!result.success) {
        setError(`Failed to push changes: ${result.error}`);
      } else {
        setSuccessMessage('Successfully pushed changes');
      }
    } catch (err) {
      console.error('Error pushing changes:', err);
      setError(`Error pushing changes: ${err}`);
    } finally {
      setIsLoading(false);
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
      
      {successMessage && (
        <div style={styles.success}>
          {successMessage}
          <button 
            onClick={() => setSuccessMessage(null)}
            style={{ float: 'right', background: 'transparent', border: 'none', cursor: 'shadowide', color: 'var(--text-primary)' }}
          >
            ✕
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div style={styles.loading}>Loading branch information...</div>
      ) : (
        <>
          <div style={styles.section}>
            <div style={styles.heading}>Pull/Push Changes</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button 
                style={styles.button}
                onClick={handlePull}
                disabled={isLoading}
              >
                Pull from Remote
              </button>
              <button 
                style={styles.button}
                onClick={handlePush}
                disabled={isLoading}
              >
                Push to Remote
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Current branch: {currentBranch || 'Unknown'}
            </div>
          </div>
          
          <div style={styles.section}>
            <div style={styles.heading}>Create Pull Request</div>
            
            <label style={styles.label}>Source Branch (Your changes)</label>
            <select
              style={styles.select}
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              disabled={isCreatingPR}
            >
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            
            <label style={styles.label}>Target Branch (Where to merge)</label>
            <select
              style={styles.select}
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              disabled={isCreatingPR}
            >
              <option value="" disabled>Select target branch</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            
            <label style={styles.label}>Pull Request Title</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Title for your pull request"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              disabled={isCreatingPR}
            />
            
            <label style={styles.label}>Pull Request Description</label>
            <textarea
              style={styles.textarea}
              placeholder="Describe your changes"
              value={prDescription}
              onChange={(e) => setPrDescription(e.target.value)}
              disabled={isCreatingPR}
            />
            
            <button 
              style={styles.button}
              onClick={handleCreatePullRequest}
              disabled={isCreatingPR || !baseBranch || !currentBranch || !prTitle || baseBranch === currentBranch}
            >
              {isCreatingPR ? 'Creating...' : 'Create Pull Request'}
            </button>
            
            {baseBranch === currentBranch && baseBranch && (
              <div style={{ color: 'var(--error-color)', fontSize: '12px', marginTop: '8px' }}>
                Source and target branches must be different.
              </div>
            )}
          </div>          
        </>
      )}
    </div>
  );
};

export default GitPullRequestView; 

import { spawn } from 'node:child_process';

interface GitCommandResult {
  success: boolean;
  data: string;
  error?: string;
  userName?: string;
  userEmail?: string;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string;
  changes: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    hasCommitsToPush: boolean;
  };
}

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export class GitService {
  private static readonly API_URL = 'http://localhost:23816';

  /**
   * Checks if the current directory is a Git repository
   */
  static async isGitRepository(directory: string): Promise<boolean> {
    try {
      // Try using git command directly instead of checking for .git folder (which might be hidden)
      const response = await fetch(`${this.API_URL}/git/is-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          directory,
          includeHidden: true  // Add flag to include hidden files/folders
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isGitRepo;
    } catch (error) {
      console.error('Error checking if directory is a git repository:', error);
      return false;
    }
  }

  /**
   * Gets the status of the Git repository
   */
  static async getStatus(directory: string): Promise<GitStatus> {
    try {
      const response = await fetch(`${this.API_URL}/git/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to get git status: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting git status:', error);
      return {
        isGitRepo: false,
        branch: '',
        changes: {
          staged: [],
          unstaged: [],
          untracked: [],
          hasCommitsToPush: false
        }
      };
    }
  }

  /**
   * Initializes a new Git repository
   */
  static async initRepo(directory: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize git repository: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error initializing git repository:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Clones a Git repository
   */
  static async cloneRepository(url: string, directory: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to clone git repository: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error cloning git repository:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Checks if Git user identity is configured
   */
  static async checkIdentityConfig(directory: string): Promise<{ configured: boolean; userName?: string; userEmail?: string }> {
    try {
      const response = await fetch(`${this.API_URL}/git/check-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to check git identity: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking git identity:', error);
      return { configured: false };
    }
  }

  /**
   * Sets Git user identity configuration
   */
  static async setIdentityConfig(directory: string, name: string, email: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/set-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, name, email })
      });

      if (!response.ok) {
        throw new Error(`Failed to set git identity: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error setting git identity:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Commits changes to the repository
   */
  static async commit(directory: string, message: string): Promise<GitCommandResult> {
    try {
      // First check if identity is configured
      const identityCheck = await this.checkIdentityConfig(directory);
      if (!identityCheck.configured) {
        return {
          success: false,
          data: '',
          error: 'IDENTITY_NOT_CONFIGURED',
          userName: identityCheck.userName,
          userEmail: identityCheck.userEmail
        };
      }

      const response = await fetch(`${this.API_URL}/git/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, message })
      });

      if (!response.ok) {
        throw new Error(`Failed to commit changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error committing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Stages files to be committed
   */
  static async addFiles(directory: string, files: string[]): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, files })
      });

      if (!response.ok) {
        throw new Error(`Failed to stage files: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error staging files:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Unstages files
   */
  static async resetFiles(directory: string, files: string[]): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, files })
      });

      if (!response.ok) {
        throw new Error(`Failed to unstage files: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error unstaging files:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a hard reset to a specific commit
   */
  static async resetHard(directory: string, commit: string = 'HEAD'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-hard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform hard reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing hard reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a soft reset to a specific commit
   */
  static async resetSoft(directory: string, commit: string = 'HEAD~1'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-soft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform soft reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing soft reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Performs a mixed reset to a specific commit
   */
  static async resetMixed(directory: string, commit: string = 'HEAD~1'): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/reset-mixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, commit })
      });

      if (!response.ok) {
        throw new Error(`Failed to perform mixed reset: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing mixed reset:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Pulls changes from a remote repository
   */
  static async pull(directory: string, remote: string = 'origin', branch: string = ''): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, remote, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error pulling changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Push commits to remote repository
   */
  static async push(directory: string, remote: string = 'origin', branch: string = ''): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, remote, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to push changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error pushing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Gets commit history
   */
  static async getLog(directory: string, limit: number = 50): Promise<GitLogEntry[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, limit })
      });

      if (!response.ok) {
        throw new Error(`Failed to get commit history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  /**
   * Creates and checks out a new branch
   */
  static async checkout(directory: string, branch: string, create: boolean = false): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, branch, create })
      });

      if (!response.ok) {
        throw new Error(`Failed to checkout branch: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking out branch:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Stashes changes
   */
  static async stash(directory: string, message?: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, message })
      });

      if (!response.ok) {
        throw new Error(`Failed to stash changes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error stashing changes:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Applies the most recent stash
   */
  static async stashPop(directory: string, index: number = 0): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash-pop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, stash_index: index })
      });

      if (!response.ok) {
        throw new Error(`Failed to apply stash: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error applying stash:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Lists all stashes
   */
  static async listStashes(directory: string): Promise<{ index: string; message: string }[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/stash-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to list stashes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.stashes || [];
    } catch (error) {
      console.error('Error listing stashes:', error);
      return [];
    }
  }

  /**
   * Creates or fetches a pull request
   */
  static async pullRequest(directory: string, options: { 
    title?: string, 
    body?: string, 
    baseBranch?: string, 
    headBranch?: string 
  }): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/pull-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          directory,
          ...options 
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create pull request: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating pull request:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Publishes the repository to GitHub
   */
  static async publishToGitHub(directory: string, options: {
    repoName: string,
    description?: string,
    isPrivate?: boolean
  }): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/publish-to-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directory,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to publish to GitHub: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error publishing to GitHub:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  /**
   * Gets a list of branches
   */
  static async getBranches(directory: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_URL}/git/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory })
      });

      if (!response.ok) {
        throw new Error(`Failed to get branches: ${response.statusText}`);
      }

      const data = await response.json();
      return data.branches || [];
    } catch (error) {
      console.error('Error getting branches:', error);
      return [];
    }
  }

  /**
   * Merges a branch into the current branch
   */
  static async merge(directory: string, branch: string): Promise<GitCommandResult> {
    try {
      const response = await fetch(`${this.API_URL}/git/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory, branch })
      });

      if (!response.ok) {
        throw new Error(`Failed to merge branch: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error merging branch:', error);
      return {
        success: false,
        data: '',
        error: String(error)
      };
    }
  }

  // ── File diff ──────────────────────────────────────────────────────────

  static async diffFile(directory: string, filePath: string, staged = false): Promise<string> {
    const res = await fetch(`${this.API_URL}/git/diff-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, filePath, staged }),
    });
    const data = await res.json();
    return data.diff ?? '';
  }

  static async diffCommits(directory: string, from: string, to: string, filePath?: string): Promise<string> {
    const res = await fetch(`${this.API_URL}/git/diff-commits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, from, to, filePath }),
    });
    const data = await res.json();
    return data.diff ?? '';
  }

  static async showFile(directory: string, commit: string, filePath: string): Promise<string> {
    const res = await fetch(`${this.API_URL}/git/show-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, commit, filePath }),
    });
    const data = await res.json();
    return data.content ?? '';
  }

  // ── Remotes ────────────────────────────────────────────────────────────

  static async getRemotes(directory: string): Promise<{ name: string; refs: { fetch: string; push: string } }[]> {
    const res = await fetch(`${this.API_URL}/git/remotes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    const data = await res.json();
    return data.remotes ?? [];
  }

  static async addRemote(directory: string, name: string, url: string): Promise<void> {
    await fetch(`${this.API_URL}/git/remote-add`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name, url }),
    });
  }

  static async removeRemote(directory: string, name: string): Promise<void> {
    await fetch(`${this.API_URL}/git/remote-remove`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name }),
    });
  }

  static async fetch(directory: string, remote = 'origin'): Promise<void> {
    await fetch(`${this.API_URL}/git/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, remote }),
    });
  }

  // ── Branches (extended) ────────────────────────────────────────────────

  static async getAllBranches(directory: string): Promise<{ local: string[]; current: string; all: string[] }> {
    const res = await fetch(`${this.API_URL}/git/branches-all`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    const data = await res.json();
    return { local: data.local ?? [], current: data.current ?? '', all: data.all ?? [] };
  }

  static async createBranch(directory: string, name: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/branch-create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name }),
    });
    return res.json();
  }

  static async checkoutBranch(directory: string, name: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/branch-checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name }),
    });
    return res.json();
  }

  static async deleteBranch(directory: string, name: string, force = false): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/branch-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name, force }),
    });
    return res.json();
  }

  static async renameBranch(directory: string, oldName: string, newName: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/branch-rename`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, oldName, newName }),
    });
    return res.json();
  }

  static async mergeBranch(directory: string, branch: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/branch-merge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, branch }),
    });
    return res.json();
  }

  // ── Tags ───────────────────────────────────────────────────────────────

  static async getTags(directory: string): Promise<string[]> {
    const res = await fetch(`${this.API_URL}/git/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    const data = await res.json();
    return data.tags ?? [];
  }

  static async createTag(directory: string, name: string, message?: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/tag-create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name, message }),
    });
    return res.json();
  }

  static async deleteTag(directory: string, name: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/tag-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, name }),
    });
    return res.json();
  }

  // ── Conflicts ──────────────────────────────────────────────────────────

  static async getConflicts(directory: string): Promise<string[]> {
    const res = await fetch(`${this.API_URL}/git/conflicts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    const data = await res.json();
    return data.conflicted ?? [];
  }

  static async getConflictVersions(directory: string, filePath: string): Promise<{ ours: string; theirs: string; base: string }> {
    const res = await fetch(`${this.API_URL}/git/conflict-versions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, filePath }),
    });
    return res.json();
  }

  static async resolveConflict(directory: string, filePath: string): Promise<void> {
    await fetch(`${this.API_URL}/git/conflict-resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, filePath }),
    });
  }

  // ── Cherry-pick ────────────────────────────────────────────────────────

  static async cherryPick(directory: string, commit: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/cherry-pick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, commit }),
    });
    return res.json();
  }

  // ── Blame ──────────────────────────────────────────────────────────────

  static async blame(directory: string, filePath: string): Promise<{ hash: string; lineNum: number; author: string; date: string; summary: string; content: string }[]> {
    const res = await fetch(`${this.API_URL}/git/blame`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, filePath }),
    });
    const data = await res.json();
    return data.lines ?? [];
  }

  // ── Amend ──────────────────────────────────────────────────────────────

  static async amendCommit(directory: string, message?: string): Promise<GitCommandResult> {
    const res = await fetch(`${this.API_URL}/git/commit-amend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, message }),
    });
    return res.json();
  }

  static async getStashDiff(directory: string, stashIndex = 0): Promise<string> {
    const res = await fetch(`${this.API_URL}/git/stash-diff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, stash_index: stashIndex }),
    });
    const data = await res.json();
    return data.diff ?? '';
  }

  static async searchLog(directory: string, query: string, limit = 50): Promise<{ hash: string; author: string; date: string; message: string }[]> {
    const res = await fetch(`${this.API_URL}/git/log-search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, query, limit }),
    });
    const data = await res.json();
    return data.results ?? [];
  }

  static async getPRCommits(directory: string, base = 'main', head?: string): Promise<{ commits: any[]; branch: string; base: string }> {
    const res = await fetch(`${this.API_URL}/git/pr-commits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, base, head }),
    });
    return res.json();
  }
}

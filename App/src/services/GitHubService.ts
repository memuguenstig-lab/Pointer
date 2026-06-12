/**
 * Service for interacting with GitHub API
 */

interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  clone_url: string;
  updated_at: string;
  stargazers_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface UserRepository {
  name: string;
  url: string;
  description: string | null;
  lastUpdated: string;
  isPrivate: boolean;
  owner: string;
  ownerAvatar: string;
}

export interface PopularRepository {
  name: string;
  url: string;
  description: string | null;
  stars: number;
  owner: string;
  ownerAvatar: string;
}

export class GitHubService {
  private static readonly API_URL = 'https://api.github.com';
  private static readonly LOCAL_API_URL = 'http://localhost:23816';

  /**
   * Get user's repositories from GitHub
   * Uses GitHub API token if available in settings
   */
  static async getUserRepositories(): Promise<UserRepository[]> {
    try {
      // For security, we'll use backend proxy instead of calling GitHub directly
      const response = await fetch(`${this.LOCAL_API_URL}/github/user-repos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user repositories');
      }

      const data = await response.json();
      
      // If backend is not set up with this endpoint, return demo data
      if (data.demo) {
        return this.getDemoUserRepositories();
      }
      
      // Map GitHub API response to our interface
      return (data.repositories as GitHubRepository[]).map(repo => ({
        name: repo.name,
        url: repo.clone_url,
        description: repo.description,
        lastUpdated: new Date(repo.updated_at).toLocaleDateString(),
        isPrivate: repo.private,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      
      // Return demo data if API fails
      return this.getDemoUserRepositories();
    }
  }

  /**
   * Get popular repositories from GitHub
   */
  static async getPopularRepositories(): Promise<PopularRepository[]> {
    try {
      // For security, we'll use backend proxy instead of calling GitHub directly
      const response = await fetch(`${this.LOCAL_API_URL}/github/popular-repos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch popular repositories');
      }

      const data = await response.json();
      
      // If backend is not set up with this endpoint, return demo data
      if (data.demo) {
        return this.getDemoPopularRepositories();
      }
      
      // Map GitHub API response to our interface
      return (data.repositories as GitHubRepository[]).map(repo => ({
        name: repo.name,
        url: repo.clone_url,
        description: repo.description,
        stars: repo.stargazers_count,
        owner: repo.owner.login,
        ownerAvatar: repo.owner.avatar_url
      }));
    } catch (error) {
      console.error('Error fetching popular repositories:', error);
      
      // Return demo data if API fails
      return this.getDemoPopularRepositories();
    }
  }

  /**
   * Demo data for user repositories when API is not available
   */
  private static getDemoUserRepositories(): UserRepository[] {
    return [
      {
        name: 'my-project',
        url: 'https://github.com/username/my-project.git',
        description: 'A personal project',
        lastUpdated: '2023-12-25',
        isPrivate: false,
        owner: 'username',
        ownerAvatar: 'https://github.com/github.png'
      },
      {
        name: 'notes-app',
        url: 'https://github.com/username/notes-app.git',
        description: 'Simple note-taking application',
        lastUpdated: '2023-11-10',
        isPrivate: true,
        owner: 'username',
        ownerAvatar: 'https://github.com/github.png'
      },
      {
        name: 'website',
        url: 'https://github.com/username/website.git',
        description: 'Personal website',
        lastUpdated: '2023-10-05',
        isPrivate: false,
        owner: 'username',
        ownerAvatar: 'https://github.com/github.png'
      }
    ];
  }

  /**
   * Demo data for popular repositories when API is not available
   */
  private static getDemoPopularRepositories(): PopularRepository[] {
    return [
      {
        name: 'vscode',
        url: 'https://github.com/microsoft/vscode.git',
        description: 'Visual Studio Code',
        stars: 150000,
        owner: 'microsoft',
        ownerAvatar: 'https://github.com/microsoft.png'
      },
      {
        name: 'react',
        url: 'https://github.com/facebook/react.git',
        description: 'A JavaScript library for building user interfaces',
        stars: 200000,
        owner: 'facebook',
        ownerAvatar: 'https://github.com/facebook.png'
      },
      {
        name: 'electron',
        url: 'https://github.com/electron/electron.git',
        description: 'Build cross-platform desktop apps with JavaScript, HTML, and CSS',
        stars: 105000,
        owner: 'electron',
        ownerAvatar: 'https://github.com/electron.png'
      },
      {
        name: 'typescript',
        url: 'https://github.com/microsoft/TypeScript.git',
        description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
        stars: 85000,
        owner: 'microsoft',
        ownerAvatar: 'https://github.com/microsoft.png'
      }
    ];
  }
} 

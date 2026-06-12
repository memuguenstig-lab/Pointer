interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export class RecentProjectsService {
  private static readonly STORAGE_KEY = 'recentProjects';
  private static readonly LAST_DIRECTORY_KEY = 'lastOpenedDirectory';
  private static readonly MAX_PROJECTS = 10;

  static getRecentProjects(): RecentProject[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading recent projects:', error);
      return [];
    }
  }

  static addProject(path: string) {
    try {
      const projects = this.getRecentProjects();
      const name = path.split(/[\\/]/).pop() || path;

      // Remove if already exists
      const filtered = projects.filter(p => p.path !== path);

      // Add to beginning of array
      filtered.unshift({
        path,
        name,
        lastOpened: Date.now()
      });

      // Keep only the most recent MAX_PROJECTS
      const trimmed = filtered.slice(0, this.MAX_PROJECTS);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
      
      // Also store as the last opened directory
      this.setLastDirectory(path);
    } catch (error) {
      console.error('Error saving recent project:', error);
    }
  }

  static getLastProject(): RecentProject | null {
    try {
      const lastPath = localStorage.getItem(this.LAST_DIRECTORY_KEY);
      if (!lastPath) return null;

      const name = lastPath.split(/[\\/]/).pop() || lastPath;
      return {
        path: lastPath,
        name,
        lastOpened: Date.now()
      };
    } catch (error) {
      console.error('Error getting last project:', error);
      return null;
    }
  }

  static setLastDirectory(path: string) {
    try {
      localStorage.setItem(this.LAST_DIRECTORY_KEY, path);
    } catch (error) {
      console.error('Error saving last directory:', error);
    }
  }

  static removeProject(path: string) {
    try {
      const projects = this.getRecentProjects();
      const filtered = projects.filter(p => p.path !== path);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));

      // If this was the last directory, remove it
      if (localStorage.getItem(this.LAST_DIRECTORY_KEY) === path) {
        localStorage.removeItem(this.LAST_DIRECTORY_KEY);
      }
    } catch (error) {
      console.error('Error removing recent project:', error);
    }
  }
} 

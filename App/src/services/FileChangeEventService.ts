export type FileChangeListener = (filePath: string, oldContent: string, newContent: string) => void;

interface DiffChange {
  filePath: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
}

export class FileChangeEventService {
  private static listeners: FileChangeListener[] = [];
  private static diffs: DiffChange[] = [];

  public static subscribe(listener: FileChangeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public static emitChange(filePath: string, oldContent: string, newContent: string) {
    // Store the diff
    this.diffs.push({
      filePath,
      oldContent,
      newContent,
      timestamp: Date.now()
    });

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(filePath, oldContent, newContent);
      } catch (error) {
        console.error('Error in file change listener:', error);
      }
    });

    this.refreshFileExplorer(filePath, oldContent, newContent);
  }

  // Get all pending diffs
  public static getAllDiffs(): DiffChange[] {
    return this.diffs;
  }

  // Clear all diffs
  public static clearDiffs() {
    this.diffs = [];
  }

  // Helper method to refresh the file explorer
  private static refreshFileExplorer(filePath?: string, oldContent?: string, newContent?: string) {
    try {
      // Dispatch a custom event that can be listened to by the file explorer
      const refreshEvent = new CustomEvent('file-explorer-refresh', {
        detail: { filePath, oldContent, newContent }
      });
      window.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Error refreshing file explorer:', error);
    }
  }

  // Accept and save a specific diff
  public static async acceptDiff(filePath: string) {
    const diff = this.diffs.find(d => d.filePath === filePath);
    if (!diff) return false;

    try {
      // Get directory path for the file
      const directoryPath = filePath.substring(0, filePath.lastIndexOf('/'));
      
      // If the file is in a subdirectory, make sure the directory exists
      if (directoryPath) {
        try {
          // Try to create the directory structure
          const createDirResponse = await fetch(`http://localhost:23816/create-dir?path=${encodeURIComponent(directoryPath)}`, {
            method: 'POST',
          });
          
          if (createDirResponse.ok) {
            console.log(`Created directory structure: ${directoryPath}`);
          }
        } catch (error) {
          console.error('Error creating directory:', error);
          // Continue anyway to try to save the file
        }
      }

      // Save the file with new content
      const response = await fetch(`http://localhost:23816/save-file?path=${encodeURIComponent(filePath)}`, {
        method: 'POST',
        body: diff.newContent
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      // Remove the accepted diff
      this.diffs = this.diffs.filter(d => d.filePath !== filePath);
      
      // Refresh the file explorer to show any new files
      this.refreshFileExplorer(filePath, diff.oldContent, diff.newContent);
      
      return true;
    } catch (error) {
      console.error('Error accepting diff:', error);
      return false;
    }
  }

  // Accept all pending diffs
  public static async acceptAllDiffs() {
    const results = [];
    for (const diff of this.diffs) {
      results.push(await this.acceptDiff(diff.filePath));
    }
    
    // Refresh the file explorer to show any new files
    this.refreshFileExplorer();
    
    return results.every(result => result === true);
  }
  
  // Reject a specific diff (discard changes)
  public static rejectDiff(filePath: string) {
    // Just remove the diff from the collection
    this.diffs = this.diffs.filter(d => d.filePath !== filePath);
    return true;
  }
  
  // Reject all pending diffs (discard all changes)
  public static rejectAllDiffs() {
    this.diffs = [];
    return true;
  }
} 

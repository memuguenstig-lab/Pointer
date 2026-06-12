import { FileSystemService } from './FileSystemService';

const API_URL = 'http://localhost:23816';

export class FileReaderService {
  static async readFile(filePath: string): Promise<string | null> {
    try {
      console.log('Reading file:', filePath);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('path', filePath);
      
      // Only append currentDir if the path is not absolute
      const currentDir = FileSystemService.getCurrentDirectory();
      if (currentDir && !filePath.startsWith('/') && !filePath.startsWith('\\')) {
        params.append('currentDir', currentDir);
      }
      
      const response = await fetch(`${API_URL}/read-file?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error('Server error:', {
          status: response.status,
          statusText: response.statusText,
          filePath,
          currentDir
        });
        return null;
      }

      const content = await response.text();
      if (!content) {
        console.error('Empty file content received');
        return '';
      }

      return content;
      
    } catch (error) {
      console.error(`Error reading file:`, error);
      return null;
    }
  }
} 

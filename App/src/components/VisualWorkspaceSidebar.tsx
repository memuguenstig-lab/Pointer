import React, { useState } from 'react';
import { FileSystemService } from '../services/FileSystemService';

interface VisualWorkspaceSidebarProps {
  onFileSelect?: (fileId: string) => void;
  rootId?: string;
  onFileCreated?: (id: string, file: any) => void;
}

export const VisualWorkspaceSidebar: React.FC<VisualWorkspaceSidebarProps> = ({ onFileSelect, rootId = 'root', onFileCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateWorkspace = async () => {
    const nameInput = prompt('Enter a name for your visual workspace:');
    if (!nameInput) return;

    const cleanName = nameInput.trim();
    if (!cleanName) return;

    const filename = cleanName.endsWith('.workspace') ? cleanName : `${cleanName}.workspace`;
    setLoading(true);
    setError(null);

    try {
      // Create the file at the root parent directory
      const result = await FileSystemService.createFile(rootId, filename);
      if (!result) {
        throw new Error('Could not create workspace file');
      }

      // Initialize with empty canvas JSON structure
      const initialJson = {
        nodes: [
          {
            id: 'welcome',
            x: 100,
            y: 100,
            label: 'Welcome to your Visual Workspace!',
            color: '#0e639c'
          }
        ],
        edges: [] as any[],
        bgImages: [] as string[]
      };

      await FileSystemService.saveFile(result.file.path, JSON.stringify(initialJson, null, 2));

      if (onFileCreated) {
        onFileCreated(result.id, result.file);
      }

      // Auto-open the file
      if (onFileSelect) {
        onFileSelect(result.id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)', height: '100%' }}>
      <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>Visual Workspace</h3>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        Create an interactive canvas board to map out your project architecture, database models, or visual task notes.
      </p>

      {error && (
        <div style={{ color: 'var(--error-color)', fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px' }}>
          ⚠️ {error}
        </div>
      )}

      <button
        disabled={loading}
        onClick={handleCreateWorkspace}
        style={{
          padding: '8px 12px',
          background: 'var(--accent-color)',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.15s'
        }}
      >
        {loading ? 'Creating...' : 'Create Visual Workspace (.workspace)'}
      </button>
    </div>
  );
};

export default VisualWorkspaceSidebar;

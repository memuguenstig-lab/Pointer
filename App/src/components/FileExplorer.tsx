import React, { useState, useCallback, useEffect } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';
import { ExplorerService } from '../services/ExplorerService';
import { getIconForFile, FolderIcon, ChevronIcon } from './FileIcons';
import { isDatabaseFile } from './FileViewer';

declare global {
  interface Window {
    applyCustomTheme?: () => void;
    loadSettings?: () => Promise<void>;
    appSettings?: {
      theme?: {
        customColors?: {
          customFileExtensions?: Record<string, string>;
        };
      };
    };
  }
}

interface FileExplorerProps {
  items: Record<string, FileSystemItem>;
  rootId: string;
  currentFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onFolderContentsLoaded: (newItems: Record<string, FileSystemItem>) => void;
  onDeleteItem: (item: FileSystemItem) => void;
  onRenameItem: (item: FileSystemItem, newName: string) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetItem: FileSystemItem | null;
}

const activeFileStyle = {
  backgroundColor: 'var(--bg-selected)',
  borderLeft: '2px solid var(--accent-color)',
  fontWeight: 500,
};

const hoverFileStyle = {
  backgroundColor: 'var(--bg-hover)',
  boxShadow: 'inset 3px 0 0 var(--accent-color)',
};

const FileExplorerItem: React.FC<{
  item: FileSystemItem;
  items: { [key: string]: FileSystemItem };
  level: number;
  currentFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onDeleteItem: (item: FileSystemItem) => void;
}> = React.memo(({ item, items, level, currentFileId, onFileSelect, onCreateFile, onCreateFolder, onDeleteItem }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetItem: null,
  });
  const childIds = Object.values(items).filter(i => i.parentId === item.id).map(i => i.id);

  const handleFolderClick = async () => {
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      await loadFolderContents(item.path);
    }
  };

  const handleFolderHover = useCallback(async () => {
    setIsHovered(true);
    // Disable automatic loading on hover to prevent the editor reload issue
    // We'll only load folders when they're explicitly clicked
    /*
    if (item.type === 'directory' && !isExpanded && !FileSystemService.isFolderLoaded(item.path)) {
      await loadFolderContents(item.path);
    }
    */
  }, [item.type, isExpanded]);

  const loadFolderContents = async (path: string) => {
    if (FileSystemService.isFolderLoaded(path)) return;

    setIsLoading(true);
    const result = await FileSystemService.fetchFolderContents(path);
    setIsLoading(false);

    if (result) {
      const newItems = { ...items };
      Object.entries(result.items).forEach(([id, item]) => {
        if (id !== result.rootId) {
          newItems[id] = item;
        }
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetItem: item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      targetItem: null,
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      handleCloseContextMenu();
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  return (
    <div style={{ marginLeft: level === 0 ? 0 : '8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '22px',
          cursor: 'pointer',
          backgroundColor: item.id === currentFileId
            ? 'color-mix(in srgb, var(--accent-color) 25%, transparent)'
            : isHovered ? 'var(--bg-hover)' : 'transparent',
          color: 'var(--text-primary)',
          fontSize: '13px',
          paddingRight: '8px',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          borderRadius: '3px',
          boxShadow: item.id === currentFileId
            ? 'inset 3px 0 0 var(--accent-color)'
            : isHovered ? 'inset 3px 0 0 var(--accent-color)' : 'none',
        }}
        onClick={() => {
          if (item.type === 'file') {
            onFileSelect(item.id);
            // Ensure theme is applied after file selection
            setTimeout(() => window.applyCustomTheme?.(), 100);
          } else {
            handleFolderClick();
          }
        }}
        onMouseEnter={handleFolderHover}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div style={{ 
          width: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginLeft: level === 0 ? '12px' : '4px',
          flexShrink: 0,
        }}>
          {item.type === 'directory' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleFolderClick();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              <ChevronIcon isExpanded={isExpanded} />
            </span>
          )}
        </div>
        <div style={{
          marginLeft: '4px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          color: item.id === currentFileId ? 'var(--accent-color)' : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}>
          {item.type === 'directory' ? (
            <FolderIcon isOpen={isExpanded} />
          ) : (
            getIconForFile(item.name)
          )}
        </div>
        <span style={{
          marginLeft: '4px',
          color: item.id === currentFileId ? 'var(--text-primary)' : item.type === 'directory' ? 'var(--text-primary)' : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: 1,
        }}>
          {item.name}
        </span>
        {isHovered && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '2px',
            flexShrink: 0,
          }}>
            {item.type === 'directory' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFile(item.id);
                  }}
                  style={buttonStyle}
                  title="New File"
                >
                  +
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(item.id);
                  }}
                  style={buttonStyle}
                  title="New Folder"
                >
                  📁
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                  onDeleteItem(item);
                }
              }}
              style={buttonStyle}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
        {isLoading && <span style={{ marginLeft: '4px', opacity: 0.5 }}>...</span>}
      </div>
      {item.type === 'directory' && isExpanded && childIds.map((childId) => (
        <FileExplorerItem
          key={childId}
          item={items[childId]}
          items={items}
          level={level + 1}
          currentFileId={currentFileId}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onDeleteItem={onDeleteItem}
        />
      ))}

      {contextMenu.isOpen && contextMenu.targetItem?.id === item.id && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: '160px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        >
          {item.type === 'directory' && (
            <>
              <div
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFile(item.id);
                  handleCloseContextMenu();
                }}
                style={contextMenuItemStyle}
              >
                New File
              </div>
              <div
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder(item.id);
                  handleCloseContextMenu();
                }}
                style={contextMenuItemStyle}
              >
                New Folder
              </div>
              <div style={contextMenuSeparatorStyle} />
            </>
          )}
          <div
            className="context-menu-item"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                // Get the current directory from FileSystemService
                const currentDir = FileSystemService.getCurrentDirectory();
                
                const result = await ExplorerService.openInExplorer(item.path, currentDir || undefined);
                if (!result.success) {
                  console.error('Failed to open in explorer:', result.error);
                }
              } catch (error) {
                console.error('Error opening in explorer:', error);
              }
              handleCloseContextMenu();
            }}
            style={contextMenuItemStyle}
          >
            Open in Explorer
          </div>
          <div style={contextMenuSeparatorStyle} />
          <div
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                onDeleteItem(item);
              }
              handleCloseContextMenu();
            }}
            style={{
              ...contextMenuItemStyle,
              color: 'var(--error-color)',
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if relevant props changed
  return (
    prevProps.item === nextProps.item &&
    prevProps.currentFileId === nextProps.currentFileId &&
    prevProps.level === nextProps.level &&
    prevProps.items === nextProps.items
  );
});

const buttonStyle = {
  padding: '0 4px',
  height: '16px',
  fontSize: '12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.8,
  ':hover': {
    opacity: 1,
    background: 'var(--bg-hover)',
  }
};

const contextMenuItemStyle = {
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--text-primary)',
  ':hover': {
    backgroundColor: 'var(--bg-hover)',
  },
};

const contextMenuSeparatorStyle = {
  height: '1px',
  backgroundColor: 'var(--border-color)',
  margin: '4px 0',
};

const getAllChildIds = (items: Record<string, FileSystemItem>, parentId: string): string[] => {
  const children: string[] = [];
  Object.entries(items).forEach(([id, item]) => {
    if (item.parentId === parentId) {
      children.push(id);
      if (item.type === 'directory') {
        children.push(...getAllChildIds(items, id));
      }
    }
  });
  return children;
};

const handleDelete = (item: FileSystemItem, onDeleteItem: (item: FileSystemItem) => void, items: Record<string, FileSystemItem>) => {
  onDeleteItem(item);

  if (item.type === 'directory') {
    const childIds = getAllChildIds(items, item.id);
    childIds.forEach(childId => {
      if (items[childId]) {
        onDeleteItem(items[childId]);
      }
    });
  }
};

const getFileColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const base = filename.toLowerCase();

  // Custom theme extensions take priority
  const customExtensions = window.appSettings?.theme?.customColors?.customFileExtensions || {};
  if (ext && customExtensions[ext]) return customExtensions[ext];

  // Built-in color map
  const colors: Record<string, string> = {
    // JavaScript / TypeScript
    js: '#f1c40f', jsx: '#f1c40f', mjs: '#f1c40f', cjs: '#f1c40f',
    ts: '#3178c6', tsx: '#3178c6', dts: '#3178c6',
    // Web
    html: '#e34c26', htm: '#e34c26',
    css: '#1572b6', scss: '#c6538c', sass: '#c6538c', less: '#1d365d',
    // Data
    json: '#f1c40f', jsonc: '#f1c40f', json5: '#f1c40f',
    yaml: '#cb171e', yml: '#cb171e',
    toml: '#9c4221', ini: '#6d8086', env: '#ecd53f',
    xml: '#e34c26', svg: '#ff9900',
    csv: '#89e051', tsv: '#89e051',
    // Docs
    md: '#519aba', mdx: '#519aba', markdown: '#519aba',
    txt: '#bbbbbb', rst: '#bbbbbb',
    pdf: '#ff0000',
    // Config
    dockerfile: '#384d54', docker: '#384d54',
    gitignore: '#f1502f', gitattributes: '#f1502f',
    editorconfig: '#fff2a7', prettierrc: '#56b3b4', eslintrc: '#4b32c3',
    babelrc: '#f5da55', nvmrc: '#89e051',
    // Build
    makefile: '#427819', cmake: '#064f8c',
    gradle: '#02303a', 'build.gradle': '#02303a',
    lock: '#bbbbbb', 'package.json': '#cb3837', 'package-lock.json': '#cb3837',
    // Languages
    py: '#3776ab', pyw: '#3776ab', ipynb: '#f37626',
    rb: '#cc342d', rake: '#cc342d',
    php: '#777bb4',
    java: '#ed8b00', kt: '#7f52ff', kts: '#7f52ff',
    cs: '#239120', vb: '#945db7',
    c: '#a8b9cc', h: '#a8b9cc',
    cpp: '#00599c', cc: '#00599c', cxx: '#00599c', hpp: '#00599c',
    go: '#00add8',
    rs: '#dea584',
    swift: '#fa7343',
    dart: '#0175c2',
    lua: '#000080',
    r: '#198ce7',
    jl: '#9558b2',
    ex: '#6e4a7e', exs: '#6e4a7e',
    elm: '#60b5cc',
    hs: '#5e5086', lhs: '#5e5086',
    clj: '#5881d8', cljs: '#5881d8',
    scala: '#dc322f',
    groovy: '#4298b8',
    pl: '#0298c3', pm: '#0298c3',
    sh: '#89e051', bash: '#89e051', zsh: '#89e051', fish: '#89e051',
    ps1: '#012456', psm1: '#012456', psd1: '#012456',
    bat: '#c1f12e', cmd: '#c1f12e',
    // Vue / Svelte / Astro
    vue: '#4fc08d', svelte: '#ff3e00', astro: '#ff5a03',
    // Images
    png: '#a074c4', jpg: '#a074c4', jpeg: '#a074c4',
    gif: '#a074c4', webp: '#a074c4', ico: '#a074c4',
    bmp: '#a074c4', tiff: '#a074c4', tif: '#a074c4',
    psd: '#31a8ff', ai: '#ff9a00', sketch: '#f7b500',
    // Fonts
    ttf: '#d0bf91', otf: '#d0bf91', woff: '#d0bf91', woff2: '#d0bf91',
    // Archives
    zip: '#ffe066', rar: '#ffe066', '7z': '#ffe066',
    tar: '#ffe066', gz: '#ffe066', bz2: '#ffe066', xz: '#ffe066',
    // Office
    doc: '#2b579a', docx: '#2b579a',
    xls: '#217346', xlsx: '#217346',
    ppt: '#d24726', pptx: '#d24726',
    // DB
    sql: '#e38c00', db: '#e38c00', sqlite: '#e38c00', sqlite3: '#e38c00',
    // Video / Audio
    mp4: '#ff6b6b', mov: '#ff6b6b', avi: '#ff6b6b', mkv: '#ff6b6b',
    mp3: '#ff6b6b', wav: '#ff6b6b', ogg: '#ff6b6b', flac: '#ff6b6b',
    // Misc
    log: '#bbbbbb', diff: '#f8c555', patch: '#f8c555',
    cert: '#ecd53f', pem: '#ecd53f', key: '#ecd53f',
    wasm: '#654ff0',
  };

  // Special filenames
  const specialNames: Record<string, string> = {
    'readme.md': '#519aba', 'readme': '#519aba',
    'license': '#d0bf91', 'licence': '#d0bf91',
    'changelog': '#87ceeb', 'changelog.md': '#87ceeb',
    'dockerfile': '#384d54',
    'makefile': '#427819',
    '.gitignore': '#f1502f', '.gitattributes': '#f1502f',
    '.env': '#ecd53f', '.env.local': '#ecd53f', '.env.example': '#ecd53f',
  };

  if (specialNames[base]) return specialNames[base];
  if (ext && colors[ext]) return colors[ext];
  return 'var(--explorer-file-fg, #CCCCCC)';
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  items,
  rootId,
  currentFileId,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onFolderContentsLoaded,
  onDeleteItem,
  onRenameItem,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [themeVersion, setThemeVersion] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    itemId: string | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    itemId: null,
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeVersion(prev => prev + 1);
    };

    window.addEventListener('theme-changed', handleThemeChange);

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const handleFolderClick = async (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      const folder = items[folderId];
      if (folder) {
        await loadFolderContents(folder.path, folderId);
      }
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderHover = useCallback(async (folderId: string | null) => {
    setHoveredFolder(folderId);
    // Disable automatic loading on hover to prevent the editor reload issue
    // We'll only load folders when they're explicitly clicked
    /*
    if (folderId && !expandedFolders.has(folderId)) {
      const folder = items[folderId];
      if (folder && folder.type === 'directory' && !FileSystemService.isFolderLoaded(folder.path)) {
        console.log('Pre-loading folder:', {
          id: folderId,
          path: folder.path,
          name: folder.name
        });
        await loadFolderContents(folder.path, folderId);
      }
    }
    */
  }, [items, expandedFolders]);

  const loadFolderContents = async (path: string, folderId: string) => {
    if (FileSystemService.isFolderLoaded(path)) {
      console.log('Folder already loaded:', path);
      return;
    }

    console.log('Loading folder contents:', {
      path,
      folderId,
      folderName: items[folderId]?.name
    });

    setLoadingFolders(prev => new Set(prev).add(path));
    const result = await FileSystemService.fetchFolderContents(path);
    setLoadingFolders(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });

    if (result) {
      console.log('Folder contents loaded:', {
        path,
        itemCount: Object.keys(result.items).length
      });
      
      const newItems = { ...items };
      Object.entries(result.items).forEach(([id, item]) => {
        if (id !== result.rootId) {
          if (item.parentId === result.rootId) {
            item.parentId = folderId;
          }
          newItems[id] = item;
        }
      });
      onFolderContentsLoaded(newItems);
    } else {
      console.error('Failed to load folder contents:', path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      itemId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      itemId: null,
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  const handleRename = (item: FileSystemItem) => {
    const newName = prompt('Enter new name:', item.name);
    if (newName && newName !== item.name) {
      onRenameItem(item, newName);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F2' && currentFileId) {
      e.preventDefault();
      const currentItem = items[currentFileId];
      if (currentItem) {
        handleRename(currentItem);
      }
    }
  }, [currentFileId, items]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const renderContextMenu = (item: FileSystemItem) => {
    if (!contextMenu.isOpen || contextMenu.itemId !== item.id) return null;

    return (
      <div
        style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '4px 0',
          zIndex: 1000,
          minWidth: '160px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            handleRename(item);
            closeContextMenu();
          }}
          style={contextMenuItemStyle}
        >
          Rename
        </div>
        {item.type === 'directory' && (
          <>
            <div style={contextMenuSeparatorStyle} />
            <div
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFile(item.id);
                closeContextMenu();
              }}
              style={contextMenuItemStyle}
            >
              New File
            </div>
            <div
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(item.id);
                closeContextMenu();
              }}
              style={contextMenuItemStyle}
            >
              New Folder
            </div>
          </>
        )}
        <div style={contextMenuSeparatorStyle} />
        <div
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              handleDelete(item, onDeleteItem, items);
            }
            closeContextMenu();
          }}
          style={{
            ...contextMenuItemStyle,
            color: 'var(--error-color)',
          }}
        >
          Delete
        </div>
      </div>
    );
  };

  const renderItem = (id: string, depth: number = 0) => {
    const item = items[id];
    if (!item) return null;

    const isExpanded = expandedFolders.has(id);
    const isHovered = hoveredFolder === id;
    const isLoading = loadingFolders.has(item.path);
    const isSelected = id === currentFileId;

    const childItems = Object.values(items).filter(i => i.parentId === id);

    return (
      <div key={id}>
        <div
          onClick={() => {
            if (item.type === 'file') {
              onFileSelect(id);
              setTimeout(() => window.applyCustomTheme?.(), 100);
            } else {
              handleFolderClick(id);
            }
          }}
          onMouseEnter={() => handleFolderHover(id)}
          onMouseLeave={() => handleFolderHover(null)}
          onContextMenu={(e) => handleContextMenu(e, id)}
          className={item.type === 'file' ? `file-type-${item.name.split('.').pop()?.toLowerCase() ?? 'default'}${isSelected ? ' file-selected' : ''}` : ''}
          style={{
            paddingLeft: isHovered && !isSelected ? `${depth * 20 + 6}px` : `${depth * 20}px`,
            paddingRight: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            height: '24px',
            color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)',
            userSelect: 'none',
            fontSize: '13px',
            position: 'relative',
            borderBottom: '1px solid var(--border-subtle)',
            transition: 'background 0.15s ease, padding-left 0.15s ease, box-shadow 0.15s ease',
            ...(isSelected ? {
              backgroundColor: 'color-mix(in srgb, var(--accent-color) 25%, transparent)',
              boxShadow: 'inset 3px 0 0 var(--accent-color)',
              borderRadius: '3px',
            } : {}),
            ...(isHovered && !isSelected ? hoverFileStyle : {}),
          }}
        >
          <div style={{ 
            width: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginLeft: depth === 0 ? '12px' : '4px',
            flexShrink: 0,
          }}>
            {item.type === 'directory' && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleFolderClick(id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8,
                }}
              >
                <ChevronIcon isExpanded={isExpanded} />
              </span>
            )}
          </div>
          <div style={{
            marginLeft: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            color: isSelected 
              ? 'var(--accent-color)' 
              : item.type === 'directory' 
                ? isExpanded
                  ? 'var(--explorer-folder-expanded-fg, #C8C8C8)'
                  : 'var(--explorer-folder-fg, #C8C8C8)'
                : getFileColor(item.name),
          }}>
            {item.type === 'directory' ? (
              <FolderIcon isOpen={isExpanded} />
            ) : (
              getIconForFile(item.name)
            )}
          </div>
          <span style={{
            marginLeft: '4px',
            color: isSelected 
              ? 'var(--text-primary)' 
              : item.type === 'directory' 
                ? isExpanded
                  ? 'var(--explorer-folder-expanded-fg, #C8C8C8)'
                  : 'var(--explorer-folder-fg, #C8C8C8)'
                : getFileColor(item.name),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
            fontWeight: isSelected ? 500 : 'normal',
          }}>
            {item.name}
          </span>
          {isLoading && <span style={{ marginLeft: '4px', opacity: 0.5 }}>...</span>}
          {isHovered && (
            <div style={{
              display: 'flex',
              gap: '2px',
              flexShrink: 0,
              marginLeft: 4,
            }}>
              {item.type === 'directory' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFile(id);
                    }}
                    style={buttonStyle}
                    title="New File"
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateFolder(id);
                    }}
                    style={buttonStyle}
                    title="New Folder"
                  >
                    📁
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                    handleDelete(item, onDeleteItem, items);
                  }
                }}
                style={buttonStyle}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
        {item.type === 'directory' && isExpanded && (
          <div>
            {childItems.map(child => renderItem(child.id, depth + 1))}
          </div>
        )}

        {renderContextMenu(item)}
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--bg-secondary)',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRight: '1px solid var(--border-color)',
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={async (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;

        const currentDir = FileSystemService.getCurrentDirectory();

        for (const file of files) {
          const filePath = (file as any).path as string | undefined;
          if (!filePath) continue;

          const isDir = (await fetch('http://localhost:23816/stat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath }),
          }).then(r => r.json()).catch(() => ({ isDirectory: false }))).isDirectory;

          if (isDir) {
            // Open as new project
            const result = await FileSystemService.openSpecificDirectory(filePath);
            if (result) onFolderContentsLoaded(result.items);
          } else {
            // Copy file into current workspace
            if (!currentDir) continue;
            try {
              await fetch('http://localhost:23816/copy-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src: filePath, destDir: currentDir }),
              });
              // Refresh
              const result = await FileSystemService.openSpecificDirectory(currentDir);
              if (result) onFolderContentsLoaded(result.items);
            } catch (err) {
              console.error('Drop copy failed:', err);
            }
          }
        }
      }}
    >
      <div style={{
        padding: '8px 0 4px 20px',
        fontSize: '11px',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: '#bbbbbb',
        letterSpacing: '1px',
        userSelect: 'none',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ marginBottom: '4px' }}>{items[rootId]?.name || 'Explorer'}</span>
      </div>
      <div style={{ padding: '4px 0 0 12px' }}>
        {renderItem(rootId)}
      </div>
    </div>
  );
};

export default FileExplorer; 
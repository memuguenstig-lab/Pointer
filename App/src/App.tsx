import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import FileExplorer from './components/FileExplorer';
import Tabs from './components/Tabs';
import Resizable from './components/Resizable';
import { FileSystemItem, FileSystemState, TabInfo } from './types';
import { FileSystemService } from './services/FileSystemService';
import EditorGrid from './components/EditorGrid';
import { initializeLanguageSupport, getLanguageFromFileName } from './utils/languageUtils';
import { LLMChat, MemoizedLLMChat } from './components/LLMChat';
import { OnboardingFlow, shouldShowOnboarding } from './components/OnboardingFlow';
import './styles/App.css';
import { ChatService, ChatSession } from './services/ChatService';
import { v4 as uuidv4 } from 'uuid';
import Terminal from './components/Terminal';
import { DiffViewer } from './components/DiffViewer';
import LoadingScreen from './components/LoadingScreen';
import { Settings } from './components/Settings';
import ToastContainer from './components/ToastContainer';
import Titlebar from './components/Titlebar';
import MobileHeader from './components/MobileHeader';
import GitView from './components/Git/GitView';
import { GitService } from './services/gitService';
import CloneRepositoryModal from './components/CloneRepositoryModal';
import ExtensionsView from './components/ExtensionsView';
import VisualWorkspaceSidebar from './components/VisualWorkspaceSidebar';
import WelcomeDashboard from './components/WelcomeDashboard';
import { RecentProjectsService } from './services/RecentProjectsService';
import { PathConfig } from './config/paths';
import { IS_MOBILE } from './platform/usePlatform';
import { isPreviewableFile, getPreviewType } from './utils/previewUtils';
import PreviewPane from './components/PreviewPane';
import PanelLayout from './components/PanelLayout';
import WebPreviewPane from './components/WebPreviewPane';
import ActivityBar, { ActivityView } from './components/ActivityBar';
import CommandPalette from './components/CommandPalette';
import SplitEditor, { EditorGroup } from './components/SplitEditor';
import StatusBar from './components/StatusBar';
import { InlineDiffService } from './services/InlineDiffService';
import { isImageFile, isPdfFile, isDatabaseFile, isWorkspaceFile, isSchemaFile, isApiFile, isFlowFile, isBinaryFile } from './components/FileViewer';
import { FileChangeEventService } from './services/FileChangeEventService';

// Initialize language support
initializeLanguageSupport();

// Simple debounce implementation to replace lodash
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as any;
  };
}

interface IEditor extends monaco.editor.IStandaloneCodeEditor {}

// Update the top bar styles
const topBarStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '2px 4px',
  borderBottom: '1px solid var(--border-color)',
  background: 'var(--titlebar-bg)',
  gap: '4px',
  height: '28px',
  transition: 'height 0.2s ease',
  overflow: 'hidden',
} as const;

const topBarCollapsedStyle = {
  ...topBarStyle,
  height: '0px',
  padding: '0px 4px',
  border: 'none',
} as const;

const topBarButtonStyle = {
  padding: '2px 6px',
  fontSize: '12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  cursor: 'shadowide',
  display: 'flex',
  alignItems: 'center',
  height: '22px',
  borderRadius: '3px',
} as const;

// Add this near the top of App.tsx, after the importsdeclare global {  interface Window {    getCurrentFile: () => { path: string; } | null;    editor?: monaco.editor.IStandaloneCodeEditor;    reloadFileContent?: (fileId: string) => Promise<void>;    fileSystem?: Record<string, FileSystemItem>;    applyCustomTheme?: () => void;    loadSettings?: () => Promise<void>;    loadAllSettings?: () => Promise<void>;    cursorUpdateTimeout?: number;    appSettings?: {      theme?: {        customColors?: {          customFileExtensions?: Record<string, string>;        };      };    };    editorSettings?: {      autoAcceptGhostText: boolean;    };  }}

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editor = useRef<IEditor | null>(null);
  const currentThemeRef = useRef<{
    name: string;
    editorColors: Record<string, string>;
    tokenColors: Array<any>;
  }>({
    name: 'vs-dark',
    editorColors: {},
    tokenColors: []
  });
  const [fileSystem, setFileSystem] = useState<FileSystemState>(() => {
    const rootId = 'root';
    return {
      items: {
        [rootId]: {
          id: rootId,
          name: 'workspace',
          type: 'directory',
          parentId: null,
          path: '',
        },
        'welcome': {
          id: 'welcome',
          name: 'notes.js',
          type: 'file',
          content: "// Welcome to your new code editor!\n// Start typing here...\n\n// By the way you can't delete or save this file. (future updates (maybe (if i have motivation)))",
          parentId: rootId,
          path: 'notes.js',
        },
      },
      currentFileId: null,
      rootId,
      terminalOpen: false,
    };
  });

  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'file' | 'folder' | null;
    parentId: string | null;
    name: string;
  }>({
    isOpen: false,
    type: null,
    parentId: null,
    name: '',
  });

  // Add loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  // Add connection loading state
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');

  // Add save status state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);

  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false);
  const [isWebPreviewOpen, setIsWebPreviewOpen] = useState(false);

  // Add state for cursor position
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Diagnostics (errors/warnings) from Monaco markers
  const [diagnostics, setDiagnostics] = useState({ errors: 0, warnings: 0 });

  // Subscribe to Monaco marker changes to count errors/warnings
  useEffect(() => {
    const disposable = monaco.editor.onDidChangeMarkers(() => {
      const allMarkers = monaco.editor.getModelMarkers({});
      let errors = 0;
      let warnings = 0;
      for (const m of allMarkers) {
        if (m.severity === monaco.MarkerSeverity.Error) errors++;
        else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
      }
      setDiagnostics({ errors, warnings });
    });
    return () => disposable.dispose();
  }, []);
  
  // Add debounced function to update cursor position on the server
  const updateCursorPositionOnServer = useCallback(
    debounce(async (filePath: string, line: number, column: number) => {
      try {
        // Only update if we have a valid file path
        if (filePath) {
          const response = await fetch('http://localhost:23816/ide-state/update-cursor', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file_path: filePath,
              line,
              column
            })
          });
          
          if (!response.ok) {
            console.warn('Failed to update cursor position on server');
          }
        }
      } catch (error) {
        console.error('Error updating cursor position:', error);
      }
    }, 500), // Debounce for 500ms to avoid too many requests
    []
  );

  // Add state for grid layout
  const [isGridLayout, setIsGridLayout] = useState(false);

  // Command palette
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());

  // Split editor groups
  const [editorGroups, setEditorGroups] = useState<EditorGroup[]>([{ id: 'group-1', openFiles: [], currentFileId: null }]);
  const [activeGroupId, setActiveGroupId] = useState('group-1');

  // Sync openFiles + currentFileId with active editor group
  useEffect(() => {
    const activeGroup = editorGroups.find(g => g.id === activeGroupId);
    if (!activeGroup) return;
    setOpenFiles(activeGroup.openFiles);
    setFileSystem(prev => ({ ...prev, currentFileId: activeGroup.currentFileId }));
  }, [editorGroups, activeGroupId]);

  // Bridge FileChangeEventService → InlineDiffService
  useEffect(() => {
    return FileChangeEventService.subscribe((filePath, oldContent, newContent) => {
      InlineDiffService.setDiff(filePath, oldContent, newContent);
    });
  }, []);



  // Add state for chat visibility
  const [isLLMChatVisible, setIsLLMChatVisible] = useState(true);
  // Activity bar view state — replaces isGitViewActive / isExplorerViewActive
  const [activeView, setActiveView] = useState<ActivityView>('explorer');
  // Add state for chat width
  const [width, setWidth] = useState(() => {
    const savedWidth = localStorage.getItem('chatWidth');
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10);
      if (parsedWidth >= 250 && parsedWidth <= 1200) {
        return parsedWidth;
      }
    }
    return 380; // Default width — slim agent panel
  });

  // Preview tab state management
  const [previewTabs, setPreviewTabs] = useState<TabInfo[]>([]);
  const [currentPreviewTabId, setCurrentPreviewTabId] = useState<string | null>(null);

  // Add this inside the App component, near other state declarations
  const [isChatListVisible, setIsChatListVisible] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);

  // Add state for dynamic title format
  const [dynamicTitleFormat, setDynamicTitleFormat] = useState<string | undefined>(undefined);

  // Add this for settings modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsData, setSettingsData] = useState<Record<string, any>>({});
  
  // Save editor session files on changes
  useEffect(() => {
    const lastDir = localStorage.getItem('lastDirectory');
    if (!lastDir) return;

    const restoreEnabled = settingsData.advanced?.restoreLastSession ?? true;
    if (!restoreEnabled) return;

    if (openFiles && openFiles.length > 0) {
      localStorage.setItem(`session-open-files-${lastDir}`, JSON.stringify(openFiles));
    } else {
      localStorage.removeItem(`session-open-files-${lastDir}`);
    }

    if (fileSystem.currentFileId) {
      localStorage.setItem(`session-current-file-${lastDir}`, fileSystem.currentFileId);
    } else {
      localStorage.removeItem(`session-current-file-${lastDir}`);
    }
  }, [openFiles, fileSystem.currentFileId, settingsData.advanced?.restoreLastSession]);

  const [settingsInitialCategory, setSettingsInitialCategory] = useState<string | undefined>(undefined);
  const [settingsInitialModelId, setSettingsInitialModelId] = useState<string | undefined>(undefined);

  // Add this inside the App component
  const loadChats = async () => {
    const loadedChats = await ChatService.listChats();
    setChats(loadedChats);
  };

  const openSettingsModal = useCallback((category?: string, modelId?: string) => {
    setSettingsInitialCategory(category);
    setSettingsInitialModelId(modelId);
    setIsSettingsModalOpen(true);
  }, []);

  useEffect(() => {
    const handleOpenSettingsEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ category?: string; modelId?: string }>;
      openSettingsModal(customEvent.detail?.category, customEvent.detail?.modelId);
    };

    window.addEventListener('shadowide-open-settings', handleOpenSettingsEvent as EventListener);
    return () => {
      window.removeEventListener('shadowide-open-settings', handleOpenSettingsEvent as EventListener);
    };
  }, [openSettingsModal]);

  // Add this for Discord RPC settings
  const [discordRpcSettings, setDiscordRpcSettings] = useState({
    enabled: true,
    details: "Editing {file} | Line {line}:{column}",
    state: "Workspace: {workspace}",
    largeImageKey: "shadowide_logo",
    largeImageText: "Shadow - Code Editor",
    smallImageKey: "code",
    smallImageText: "{languageId} | Line {line}:{column}",
    button1Label: "Website",
    button1Url: "https://shadowide.f1shy312.com",
    button2Label: "Join the Discord 🚀",
    button2Url: "https://discord.gg/vhgc8THmNk"
  });

  // Load settings, including Discord settings
  const loadSettings = async () => {
    try {
      const result = await FileSystemService.readSettingsFiles(PathConfig.getActiveSettingsPath());
      if (result && result.success) {
        setSettingsData(result.settings);
        
        if (result.settings.advanced?.onboardingDone) {
          setShowOnboarding(false);
        }
        
        // Apply editor settings if they exist
        if (result.settings.editor && editor.current) {
          // Add a small delay to ensure editor is ready
          setTimeout(() => {
            const editorSettings = result.settings.editor;
            
            // Apply editor settings to Monaco
            editor.current?.updateOptions({
              fontFamily: editorSettings.fontFamily,
              fontSize: editorSettings.fontSize,
              lineHeight: editorSettings.lineHeight,
              tabSize: editorSettings.tabSize,
              insertSpaces: editorSettings.insertSpaces,
              wordWrap: editorSettings.wordWrap ? 'on' : 'off',
              formatOnPaste: editorSettings.formatOnPaste,
              formatOnType: editorSettings.formatOnSave,
            });

            // Pass editor settings to window object for ghost text functionality
            window.editorSettings = {
              autoAcceptGhostText: editorSettings.autoAcceptGhostText
            };
          }, 100);
        }
        
        // Apply theme settings if they exist
        if (result.settings.theme) {
          const themeSettings = result.settings.theme;
          
          // Validate the base theme
          const validBaseThemes = ['vs', 'vs-dark', 'hc-black', 'hc-light'];
          const baseTheme = validBaseThemes.includes(themeSettings.name) 
            ? themeSettings.name as monaco.editor.BuiltinTheme
            : 'vs-dark';
          
          // Process colors to ensure they're in a valid format
          const processedEditorColors: Record<string, string> = {};
          Object.entries(themeSettings.editorColors || {}).forEach(([key, value]) => {
            if (value && typeof value === 'string') {
              // Remove alpha component if present (e.g., #rrggbbaa → #rrggbb)
              const processedValue = value.length > 7 ? value.substring(0, 7) : value;
              processedEditorColors[key] = processedValue;
            }
          });

          // Store the current theme in the ref for persistence
          currentThemeRef.current = {
            name: baseTheme,
            editorColors: processedEditorColors,
            tokenColors: themeSettings.tokenColors || []
          };
          
          // Add a small delay before applying theme
          setTimeout(() => {
            // Create and apply custom Monaco theme
            applyCustomTheme();

            // Apply custom UI colors
            Object.entries(themeSettings.customColors).forEach(([key, value]) => {
              if (value && typeof value === 'string') {
                const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                document.documentElement.style.setProperty(cssVarName, value);
              }
            });

            // Apply terminal colors from advanced settings
            const advancedSettings = result.settings.advanced || {};
            const terminalVars: Record<string, string> = {
              '--terminal-bg':             advancedSettings.terminalBg      || '#141414',
              '--terminal-fg':             advancedSettings.terminalFg      || '#cccccc',
              '--terminal-cursor':         advancedSettings.terminalCursor  || '#ffffff',
              '--terminal-red':            advancedSettings.terminalRed     || '#f85149',
              '--terminal-green':          advancedSettings.terminalGreen   || '#3fb950',
              '--terminal-yellow':         advancedSettings.terminalYellow  || '#d29922',
              '--terminal-blue':           advancedSettings.terminalBlue    || '#58a6ff',
              '--terminal-magenta':        advancedSettings.terminalMagenta || '#bc8cff',
              '--terminal-cyan':           advancedSettings.terminalCyan    || '#39c5cf',
            };
            Object.entries(terminalVars).forEach(([k, v]) =>
              document.documentElement.style.setProperty(k, v)
            );
            // Dispatch so TerminalPane picks up the new theme
            window.dispatchEvent(new Event('theme-changed'));
            
            // Store customFileExtensions for file explorer to access
            if (themeSettings.customColors.customFileExtensions) {
              window.appSettings = window.appSettings || {};
              window.appSettings.theme = window.appSettings.theme || {};
              window.appSettings.theme.customColors = window.appSettings.theme.customColors || {};
              window.appSettings.theme.customColors.customFileExtensions = 
                { ...themeSettings.customColors.customFileExtensions };
            }
          }, 100);
        }

        // Process Discord RPC settings
        if (result.settings.discordRpc) {
          setDiscordRpcSettings(prev => ({
            ...prev,
            ...result.settings.discordRpc
          }));
          
          // Send settings to main process
          if (window.electron && window.electron.discord) {
            window.electron.discord.updateSettings(result.settings.discordRpc);
          }
        }
      } else {
        console.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Create a function to apply the custom theme
  const applyCustomTheme = () => {
    const { name, editorColors, tokenColors } = currentThemeRef.current;
    
    monaco.editor.defineTheme('custom-theme', {
      base: name as monaco.editor.BuiltinTheme,
      inherit: true,
      rules: tokenColors.map(item => ({
        token: item.token,
        foreground: item.foreground?.replace('#', ''),
        background: item.background?.replace('#', ''),
        fontStyle: item.fontStyle
      })),
      colors: editorColors
    });
    
    // Apply the custom theme
    monaco.editor.setTheme('custom-theme');
    
    // Apply custom UI colors from the current settings
    const themeSettings = window.appSettings?.theme;
    if (themeSettings?.customColors) {
      // Make custom extension colors available to the FileExplorer component
      window.appSettings = window.appSettings || {};
      window.appSettings.theme = window.appSettings.theme || {};
      window.appSettings.theme.customColors = window.appSettings.theme.customColors || {};
      
      // Make a copy of the custom file extensions for the FileExplorer to access
      if (themeSettings.customColors.customFileExtensions) {
        window.appSettings.theme.customColors.customFileExtensions = 
          { ...themeSettings.customColors.customFileExtensions };
      }
      
      // Notify components that the theme has changed
      window.dispatchEvent(new Event('theme-changed'));
    }
  };

  // Expose the custom theme function to the window object for use by other components
  useEffect(() => {
    window.applyCustomTheme = applyCustomTheme;
    
    return () => {
      // Clean up when the component unmounts
      delete window.applyCustomTheme;
    };
  }, []);

  // Load settings immediately on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Add a dedicated effect to ensure theme is applied on app start and whenever editor changes
  useEffect(() => {
    // Only apply if editor exists
    if (editor.current) {
      // Use a small timeout to ensure Monaco editor is fully initialized
      const timeoutId = setTimeout(() => {
        applyCustomTheme();
        console.log('Applied theme on startup/editor change');
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [editor.current]);

  // Add this effect to load chats
  useEffect(() => {
    loadChats();
  }, []);

    // Add effect to track cursor position and update the server  useEffect(() => {    if (editor.current) {      const disposable = editor.current.onDidChangeCursorPosition((e) => {        const position = e.position;        setCursorPosition({          line: position.lineNumber,          column: position.column,        });                // Update the server with cursor position        if (fileSystem.currentFileId && fileSystem.items[fileSystem.currentFileId]) {          const currentFile = fileSystem.items[fileSystem.currentFileId];          // Only update for actual files (not welcome screen)          if (currentFile.type === 'file' && currentFile.path) {            try {              // Debounce this operation by using setTimeout              const filePath = currentFile.path;              const line = position.lineNumber;              const column = position.column;                            // Use a simple debounce to avoid too many requests              if (window.cursorUpdateTimeout) {                clearTimeout(window.cursorUpdateTimeout);              }                            window.cursorUpdateTimeout = setTimeout(async () => {                try {                  const response = await fetch('http://localhost:23816/ide-state/update-cursor', {                    method: 'POST',                    headers: {                      'Content-Type': 'application/json',                    },                    body: JSON.stringify({                      file_path: filePath,                      line,                      column                    })                  });                                    if (!response.ok) {                    console.warn('Failed to update cursor position on server');                  }                } catch (error) {                  console.error('Error updating cursor position:', error);                }              }, 500); // 500ms debounce            } catch (error) {              console.error('Error preparing cursor position update:', error);            }          }        }      });      return () => disposable.dispose();    }  }, [editor.current, fileSystem.currentFileId, fileSystem.items]);

  useEffect(() => {
    if (editorRef.current) {
      // Ensure the container is properly sized before creating the editor
      const container = editorRef.current;
      if (container.offsetHeight === 0 || container.offsetWidth === 0) {
        console.warn('Editor container has zero dimensions');
        return;
      }

      // Create editor with explicit dimensions
      editor.current = monaco.editor.create(container, {
        value: fileSystem.currentFileId 
          ? fileSystem.items[fileSystem.currentFileId].content || ''
          : '',
        language: 'javascript',
        theme: 'vs-dark', // Initial theme, will be replaced
        automaticLayout: false, // We'll handle layout updates manually
        dimension: {
          width: container.offsetWidth,
          height: container.offsetHeight
        },
        minimap: {
          enabled: true,
          scale: 0.8,
          renderCharacters: false,
          maxColumn: 60,
          showSlider: 'mouseover',
        },
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        lineHeight: 20,
        letterSpacing: 0.5,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        cursorStyle: 'line',
        cursorWidth: 2,
        wordWrap: 'on',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'line',
        renderWhitespace: 'selection',
        padding: { top: 4, bottom: 4 },
        suggest: {
          showWords: true,
          preview: true,
          showIcons: true,
          snippetsPreventQuickSuggestions: false, // Allow quick suggestions even when snippets are active
          localityBonus: true, // Favor nearby words in suggestions
          shareSuggestSelections: true, // Remember selections across widgets
        },
        // Add more robust trigger suggestion settings
        quickSuggestions: {
          other: true,
          comments: false, 
          strings: false
        },
        acceptSuggestionOnCommitCharacter: true,
        acceptSuggestionOnEnter: 'on',
        suggestOnTriggerCharacters: true,
        tabCompletion: 'on',
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          vertical: 'visible',
          horizontal: 'visible',
          verticalHasArrows: false,
          horizontalHasArrows: false,
          useShadows: false,
        }
      });

      // Set up a proper resize observer
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && editor.current) {
          // Debounce layout updates
          window.requestAnimationFrame(() => {
            try {
              editor.current?.layout({
                width: entry.contentRect.width,
                height: entry.contentRect.height
              });
            } catch (error) {
              console.error('Error updating editor layout:', error);
            }
          });
        }
      });

      resizeObserver.observe(container);

      // Set VSCode's exact theme colors
      monaco.editor.defineTheme('vscode-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editor.lineHighlightBackground': '#2d2d2d50',
          'editorCursor.foreground': '#d4d4d4',
          'editorLineNumber.foreground': '#858585',
          'editorLineNumber.activeForeground': '#c6c6c6',
        }
      });

      // Apply our custom theme if it exists, otherwise use the default
      if (currentThemeRef.current.name !== 'vs-dark' || 
          Object.keys(currentThemeRef.current.editorColors).length > 0 || 
          currentThemeRef.current.tokenColors.length > 0) {
        applyCustomTheme();
      } else {
        monaco.editor.setTheme('vscode-dark');
      }

      const updateContent = () => {
        if (fileSystem.currentFileId && editor.current) {
          setFileSystem(prev => ({
            ...prev,
            items: {
              ...prev.items,
              [prev.currentFileId!]: {
                ...prev.items[prev.currentFileId!],
                content: editor.current?.getValue() || '',
              },
            },
          }));
        }
      };

      editor.current.onDidChangeModelContent(() => {
        updateContent();
      });

      // Set up editor global settings for suggestions to be automatic
      try {
        // Configure Monaco's global settings to ensure suggestions are shown automatically 
        monaco.languages.registerCompletionItemProvider('*', {
          provideCompletionItems: () => {
            return { suggestions: [] };
          },
          // Remove trigger characters since we're using timeout-based autocompletion instead
          triggerCharacters: [],
        });
        
        // Remove the onKeyUp handler that was triggering on specific characters
        // We'll rely solely on the timeout-based triggering in EditorGrid.tsx
      } catch (err) {
        console.error("Error setting up auto-suggestions:", err);
      }

      // Make editor globally available
      window.editor = editor.current;

      return () => {
        resizeObserver.disconnect();
        window.editor = undefined;
        editor.current?.dispose();
      };
    }
  }, [fileSystem.currentFileId]);

  const handleFileSelect = async (fileId: string) => {
    // Apply custom theme at the beginning to ensure it's set
    applyCustomTheme();
    
    // Check if file exists in the current file system state
    if (!fileSystem.items[fileId]) {
      console.error(`Attempted to select non-existent file with id: ${fileId}`);
      return;
    }

    const file = fileSystem.items[fileId];
    if (file.type === 'file') {
      if (!openFiles.includes(fileId)) {
        setOpenFiles(prev => [...prev, fileId]);
        // Also update active editor group
        setEditorGroups(prev => prev.map(g => g.id === activeGroupId
          ? { ...g, openFiles: g.openFiles.includes(fileId) ? g.openFiles : [...g.openFiles, fileId], currentFileId: fileId }
          : g));
      } else {
        setEditorGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, currentFileId: fileId } : g));
      }
      
      try {
        // Refresh structure before loading file
        await FileSystemService.refreshStructure();
        
        // Then load the file
        const content = await FileSystemService.readFile(fileId);
        if (content !== null) {
          setFileSystem(prev => ({
            ...prev,
            currentFileId: fileId,
            items: {
              ...prev.items,
              [fileId]: {
                ...prev.items[fileId],
                content: content,
              },
            },
          }));
          const isText = !isImageFile(file.name) && 
                         !isPdfFile(file.name) && 
                         !isDatabaseFile(file.name) && 
                         !isWorkspaceFile(file.name) && 
                         !isSchemaFile(file.name) && 
                         !isApiFile(file.name) && 
                         !isFlowFile(file.name) && 
                         !isBinaryFile(file.name);
          if (isText && editor.current) {
            editor.current.setValue(content);
            // Reapply the custom theme after setting editor content
            applyCustomTheme();
          }
        }
      } catch (error) {
        console.error('Error loading file content:', error);
      }
    }
  };

  const handleTabSelect = async (tabId: string) => {
    console.log('handleTabSelect called with:', tabId);
    
    // Apply custom theme at the beginning of tab select to ensure it's set
    applyCustomTheme();
    
    // Special handling for welcome tab
    if (tabId === 'welcome') {
      // Make sure welcome file exists in the state
      if (!fileSystem.items['welcome']) {
        // If welcome file doesn't exist, recreate it
        setFileSystem(prev => ({
          ...prev,
          currentFileId: 'welcome',
          items: {
            ...prev.items,
            'welcome': {
              id: 'welcome',
              name: 'notes.js',
              type: 'file',
              content: "// Welcome to your new code editor!\n// Start typing here...\n\n// By the way you can't delete or save this file. (future updates (maybe (if i have motivation)))",
              parentId: prev.rootId,
              path: 'notes.js',
            }
          }
        }));
        
        if (editor.current) {
          editor.current.setValue((fileSystem.items['welcome'] as FileSystemItem)?.content || '');
          // Reapply the custom theme after setting editor content
          applyCustomTheme();
        }
        return;
      }
      
      setFileSystem(prev => ({ ...prev, currentFileId: 'welcome' }));
      if (editor.current) {
        editor.current.setValue((fileSystem.items['welcome'] as FileSystemItem)?.content || '');
        // Reapply the custom theme after setting editor content
        applyCustomTheme();
      }
      return;
    }

    // Check if regular file exists
    if (!fileSystem.items[tabId]) {
      console.error(`Attempted to select non-existent tab with id: ${tabId}`);
      // Fall back to welcome file
      handleTabSelect('welcome');
      return;
    }

    // First update the UI to show the selected tab
    setFileSystem(prev => ({ ...prev, currentFileId: tabId }));
    
    // Then load the file content
    try {
      const content = await FileSystemService.readFile(tabId);
      console.log('File content loaded:', content ? 'success' : 'null');
      
      if (content !== null) {
        // Update file system with new content
        setFileSystem(prev => ({
          ...prev,
          items: {
            ...prev.items,
            [tabId]: {
              ...prev.items[tabId],
              content: content,
            },
          },
        }));
        
        if (editor.current) {
          editor.current.setValue(content);
          // Reapply the custom theme after setting editor content
          applyCustomTheme();
        }
      }
    } catch (error) {
      console.error('Error loading file content:', error);
    }
  };

  const handleTabClose = async (tabId: string) => {
    // First save the file if it exists and is not the welcome file
    if (tabId !== 'welcome' && tabId && fileSystem.items[tabId]) {
      try {
        // Get the file content from the editor if it's the current file,
        // otherwise use the content from fileSystem state
        const content = tabId === fileSystem.currentFileId && editor.current 
          ? editor.current.getValue() 
          : fileSystem.items[tabId].content || '';

        // Only save if there's actual content and a valid path
        if (content && fileSystem.items[tabId].path) {
          await FileSystemService.saveFile(tabId, content);
        }
      } catch (error) {
        console.error(`Error saving file before closing tab: ${tabId}`, error);
      }
    }

    setOpenFiles(prev => {
      const newOpenFiles = prev.filter(id => id !== tabId);
      
      // If we're closing the current file, switch to the last open file
      if (tabId === fileSystem.currentFileId) {
        const lastFileId = newOpenFiles[newOpenFiles.length - 1];
        if (lastFileId) {
          // Use setTimeout to ensure state updates don't conflict
          setTimeout(() => handleTabSelect(lastFileId), 0);
        } else {
          // No files left open, show welcome screen
          setFileSystem(prev => ({ 
            ...prev, 
            currentFileId: 'welcome'  // Set to welcome instead of null
          }));
          
          // Don't clear the editor if we still have the content in fileSystem
          if (editor.current && fileSystem.items['welcome']) {
            // Set to welcome message instead of empty string
            const welcomeContent = (fileSystem.items['welcome'] as FileSystemItem).content ||
              "// Welcome to your new code editor!\n// Start typing here...\n\n// By the way you can't delete or save this file.";
            editor.current.setValue(welcomeContent);
            
            // Apply theme when switching to welcome screen
            applyCustomTheme();
          }
        }
      }
      
      return newOpenFiles;
    });
  };

  const handleOpenFolder = async () => {
    try {
      setIsLoading(true);
      setLoadingError(null);

      // Clear loaded folders when opening a new directory
      FileSystemService.clearLoadedFolders();

      const result = await FileSystemService.openDirectory();
      
      if (result) {
        // Update editor content
        if (editor.current) {
          editor.current.setValue('');
        }

        // Update file system state
        setFileSystem({
          items: result.items,
          rootId: result.rootId,
          currentFileId: null,
          terminalOpen: false,
        });

        // Clear open files
        setOpenFiles([]);
        
        // Show sidebar
        setIsSidebarCollapsed(false);

        // Save the directory path
        localStorage.setItem('lastDirectory', result.path);
        RecentProjectsService.addProject(result.path);

        if (result.errors?.length > 0) {
          console.warn('Some files could not be accessed:', result.errors);
          setLoadingError('Some files could not be accessed');
        }
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to open folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseProject = () => {
    FileSystemService.clearLoadedFolders();
    setFileSystem({
      items: {},
      rootId: 'root',
      currentFileId: null,
      terminalOpen: false,
    });
    setOpenFiles([]);
    localStorage.removeItem('lastDirectory');
  };

  const handleOpenSpecificFolder = async (path: string) => {
    try {
      setIsLoading(true);
      setLoadingError(null);

      FileSystemService.clearLoadedFolders();

      const result = await FileSystemService.openSpecificDirectory(path);
      
      if (result) {
        if (editor.current) {
          editor.current.setValue('');
        }

        setFileSystem({
          items: result.items,
          rootId: result.rootId,
          currentFileId: null,
          terminalOpen: false,
        });

        setOpenFiles([]);
        setIsSidebarCollapsed(false);

        localStorage.setItem('lastDirectory', path);
        RecentProjectsService.addProject(path);

        // Restore session for this folder if enabled
        const restoreEnabled = settingsData.advanced?.restoreLastSession ?? true;
        if (restoreEnabled) {
          const savedOpenFilesStr = localStorage.getItem(`session-open-files-${path}`);
          const savedCurrentFileId = localStorage.getItem(`session-current-file-${path}`);
          if (savedOpenFilesStr) {
            try {
              const savedOpenFiles = JSON.parse(savedOpenFilesStr) as string[];
              const validOpenFiles = savedOpenFiles.filter(id => result.items[id]);
              if (validOpenFiles.length > 0) {
                setOpenFiles(validOpenFiles);
                const currentId = (savedCurrentFileId && result.items[savedCurrentFileId]) ? savedCurrentFileId : validOpenFiles[validOpenFiles.length - 1];
                setEditorGroups([{ id: 'group-1', openFiles: validOpenFiles, currentFileId: currentId }]);
                setFileSystem(prev => ({
                  ...prev,
                  currentFileId: currentId
                }));
                
                try {
                  const content = await FileSystemService.readFile(currentId);
                  if (content !== null) {
                    setFileSystem(prev => ({
                      ...prev,
                      items: {
                        ...prev.items,
                        [currentId]: {
                          ...prev.items[currentId],
                          content: content
                        }
                      }
                    }));
                    const isText = !isImageFile(result.items[currentId].name) && 
                                   !isPdfFile(result.items[currentId].name) && 
                                   !isDatabaseFile(result.items[currentId].name) && 
                                   !isWorkspaceFile(result.items[currentId].name) && 
                                   !isSchemaFile(result.items[currentId].name) && 
                                   !isApiFile(result.items[currentId].name) && 
                                   !isFlowFile(result.items[currentId].name) && 
                                   !isBinaryFile(result.items[currentId].name);
                    if (isText && editor.current) {
                      editor.current.setValue(content);
                    }
                  }
                } catch (err) {
                  console.error('Error loading file on folder switch restore:', err);
                }
              }
            } catch (e) {
              console.error('Error parsing folder switch session:', e);
            }
          }
        }

        if (result.errors?.length > 0) {
          console.warn('Some files could not be accessed:', result.errors);
          setLoadingError('Some files could not be accessed');
        }
      }
    } catch (error) {
      console.error('Failed to open specific folder:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to open folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneRepository = async () => {
    // Open the clone repository modal
    setIsCloneModalOpen(true);
  };

  const handleOpenFile = async () => {
    // Apply custom theme at the beginning to ensure it's set
    applyCustomTheme();
    
    try {
      const result = await FileSystemService.openFile();
      if (!result) {
        console.error('Failed to open file: No result returned');
        return;
      }

      // Update the file system state
      setFileSystem(prev => {
        const newItems = { ...prev.items };
        
        // Create a special "Opened Files" directory if it doesn't exist
        const openedFilesDirId = 'opened_files_dir';
        if (!newItems[openedFilesDirId]) {
          newItems[openedFilesDirId] = {
            id: openedFilesDirId,
            name: 'Opened Files',
            type: 'directory',
            parentId: prev.rootId,
            path: 'opened_files',
          };
        }
        
        // Add the file under the "Opened Files" directory
        newItems[result.id] = {
          id: result.id,
          name: result.filename,
          type: 'file',
          content: result.content,
          parentId: openedFilesDirId,
          path: result.fullPath, // Store the full path for saving
        };

        // Update the content in the file system state
        const updatedItems = {
          ...newItems,
          [result.id]: {
            ...newItems[result.id],
            content: result.content,
          },
        };

        return {
          ...prev,
          items: updatedItems,
          currentFileId: result.id,
        };
      });

      // Add to open files
      setOpenFiles(prev => [...prev, result.id]);

      // Set the editor content
      if (editor.current) {
        editor.current.setValue(result.content);
        // Apply custom theme after setting content
        applyCustomTheme();
      } else {
        console.error('Editor not initialized');
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const handleModalSubmit = async () => {
    if (!modalState.parentId || !modalState.type || !modalState.name) return;

    if (modalState.type === 'file') {
      const result = await FileSystemService.createFile(modalState.parentId, modalState.name);
      if (result) {
        setFileSystem(prev => ({
          ...prev,
          items: {
            ...prev.items,
            [result.id]: result.file,
          },
        }));
      }
    } else {
      const result = await FileSystemService.createDirectory(modalState.parentId, modalState.name);
      if (result) {
        setFileSystem(prev => ({
          ...prev,
          items: {
            ...prev.items,
            [result.id]: result.directory,
          },
        }));
      }
    }
    setModalState({ isOpen: false, type: null, parentId: null, name: '' });
  };

  const createFile = useCallback(async (parentId: string) => {
    setModalState({
      isOpen: true,
      type: 'file',
      parentId,
      name: '',
    });
  }, []);

  const createFolder = useCallback(async (parentId: string) => {
    setModalState({
      isOpen: true,
      type: 'folder',
      parentId,
      name: '',
    });
  }, []);

  const getCurrentFileName = () => {
    if (!fileSystem.currentFileId) return 'No file open';
    if (fileSystem.currentFileId === 'welcome') return 'Welcome';
    
    const currentFile = fileSystem.items[fileSystem.currentFileId];
    return currentFile?.name || 'No file open';
  };

  // Add save handler
  const handleSave = useCallback(async () => {
    if (!fileSystem.currentFileId || !editor.current) return;

    setSaveStatus('saving');
    const content = editor.current.getValue();
    
    try {
      const result = await FileSystemService.saveFile(fileSystem.currentFileId, content);
      
      if (result.success) {
        // Update the file system state with the saved content
        setFileSystem(prev => ({
          ...prev,
          items: {
            ...prev.items,
            [prev.currentFileId!]: {
              ...prev.items[prev.currentFileId!],
              content: result.content,
            },
          },
        }));

        // Update editor content if needed
        if (editor.current && editor.current.getValue() !== result.content) {
          editor.current.setValue(result.content);
        }

        setSaveStatus('saved');
        window.dispatchEvent(new CustomEvent('editor-file-saved', { detail: { filePath: fileSystem.currentFileId } }));
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
    }
  }, [fileSystem.currentFileId]);

  // Find the keyboard shortcut handler and add the LLMChat toggle
  useEffect(() => {
    const keybindings = settingsData.advanced?.keybindings || {};
    
    const getBinding = (commandId: string, defaultVal: string): string => {
      return keybindings[commandId] || defaultVal;
    };

    const matches = (e: KeyboardEvent, binding: string) => {
      const parts = binding.toLowerCase().split('+');
      const hasCtrl = parts.includes('ctrl');
      const hasShift = parts.includes('shift');
      const hasAlt = parts.includes('alt');
      const key = parts.find(p => p !== 'ctrl' && p !== 'shift' && p !== 'alt');

      if (!key) return false;

      const ctrlMatch = hasCtrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
      const shiftMatch = hasShift ? e.shiftKey : !e.shiftKey;
      const altMatch = hasAlt ? e.altKey : !e.altKey;

      let keyMatch = false;
      if (key === 'space') keyMatch = e.key === ' ';
      else if (key === ',') keyMatch = e.key === ',';
      else if (key === '\\') keyMatch = e.key === '\\';
      else keyMatch = e.key.toLowerCase() === key;

      return ctrlMatch && shiftMatch && altMatch && keyMatch;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matches(e, getBinding('saveFile', 'Ctrl+S'))) {
        e.preventDefault();
        handleSave();
      } else if (matches(e, getBinding('toggleSidebar', 'Ctrl+B'))) {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      } else if (matches(e, getBinding('closeTab', 'Ctrl+W'))) {
        e.preventDefault();
        if (fileSystem.currentFileId) {
          handleTabClose(fileSystem.currentFileId);
        }
      } else if (matches(e, getBinding('toggleLlmChat', 'Ctrl+I'))) {
        e.preventDefault();
        setIsLLMChatVisible(!isLLMChatVisible);
      } else if (matches(e, getBinding('splitEditor', 'Ctrl+\\'))) {
        e.preventDefault();
        const activeGroup = editorGroups.find(g => g.id === activeGroupId);
        if (activeGroup?.currentFileId) {
          const newGroup: EditorGroup = { id: `group-${Date.now()}`, openFiles: [activeGroup.currentFileId], currentFileId: activeGroup.currentFileId };
          setEditorGroups(prev => [...prev, newGroup]);
          setActiveGroupId(newGroup.id);
        }
      } else if (matches(e, getBinding('openSettings', 'Ctrl+,'))) {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      } else if (matches(e, getBinding('previewWeb', 'Ctrl+Shift+P'))) {
        e.preventDefault();
        setIsWebPreviewOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        window.electron?.window?.newWindow?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, isSidebarCollapsed, fileSystem.currentFileId, handleTabClose, isLLMChatVisible, settingsData, editorGroups, activeGroupId]);

  // Modify the auto-save functionality
  useEffect(() => {
    let saveTimeout: number;

    const handleContentChange = () => {
      if (fileSystem.currentFileId && editor.current) {
        const content = editor.current.getValue();
        
        // Clear previous timeout
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // Set new timeout for auto-save
        saveTimeout = window.setTimeout(async () => {
          setSaveStatus('saving');
          try {
            const result = await FileSystemService.saveFile(fileSystem.currentFileId!, content);
            if (result.success) {
              // Update the file system state with the saved content
              setFileSystem(prev => ({
                ...prev,
                items: {
                  ...prev.items,
                  [prev.currentFileId!]: {
                    ...prev.items[prev.currentFileId!],
                    content: result.content,
                  },
                },
              }));

              setSaveStatus('saved');
              setTimeout(() => setSaveStatus(null), 2000);
            } else {
              setSaveStatus('error');
            }
          } catch (error) {
            console.error('Auto-save error:', error);
            setSaveStatus('error');
          }
        }, 1000); // Auto-save after 1 second of no changes
      }
    };

    if (editor.current) {
      editor.current.onDidChangeModelContent(() => {
        handleContentChange();
      });
    }

    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [fileSystem.currentFileId]);

  const handleProjectSelected = () => {
    // Refresh the file tree or handle any other necessary updates
    // This will depend on your existing code structure
  };

  // Add a function to update file system items
  const handleFolderContentsLoaded = (newItems: Record<string, FileSystemItem>) => {
    setFileSystem(prev => {
      // Don't update file system if it would affect currently open files
      const currentlyOpenFile = prev.currentFileId ? prev.items[prev.currentFileId] : null;
      
      // Get the root item from the new items if it exists
      const rootItem = Object.values(newItems).find(item => item.parentId === null);
      
      // Make sure we're preserving all existing open files without modifications
      const updatedItems = { ...prev.items };
      
      // Only add new items that don't replace existing items with the same ID
      Object.entries(newItems).forEach(([id, item]) => {
        if (!updatedItems[id]) {
          updatedItems[id] = item;
        }
      });
      
      // Always ensure the 'welcome' file is preserved
      if (!updatedItems['welcome'] && prev.items['welcome']) {
        updatedItems['welcome'] = prev.items['welcome'];
      }
      
      // Make sure currentFileId is pointing to an existing file
      let currentFileId = prev.currentFileId;
      if (currentFileId && !updatedItems[currentFileId]) {
        // If current file no longer exists, default to welcome file
        currentFileId = 'welcome';
      }
      
      return {
        ...prev,
        items: updatedItems,
        currentFileId,
        // Update root item name if we found one
        rootId: prev.rootId
      };
    });
  };

  const normalizeWorkspacePath = (filePath: string) => filePath.replace(/\\/g, '/').replace(/^\/+/, '');

  const upsertWorkspacePath = useCallback((filePath: string, newContent: string) => {
    const normalizedPath = normalizeWorkspacePath(filePath);
    if (!normalizedPath) return;

    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length === 0) return;

    setFileSystem(prev => {
      const items = { ...prev.items };
      const currentDirectory = FileSystemService.getCurrentDirectory();
      const rootPath = prev.items[prev.rootId]?.path || currentDirectory || '';
      const rootName = prev.items[prev.rootId]?.name || rootPath.split(/[\\/]/).filter(Boolean).pop() || 'workspace';

      let parentId = prev.rootId;
      let builtPath = '';

      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        builtPath = builtPath ? `${builtPath}/${segment}` : segment;
        const dirId = `dir_${builtPath}`;

        if (!items[dirId]) {
          items[dirId] = {
            id: dirId,
            name: segment,
            type: 'directory',
            parentId,
            path: builtPath,
          };
        }

        parentId = dirId;
      }

      const fileName = segments[segments.length - 1];
      const fileId = `file_${normalizedPath}`;
      const existing = items[fileId];

      items[fileId] = {
        id: fileId,
        name: fileName,
        type: 'file',
        parentId,
        path: normalizedPath,
        content: newContent,
        ...(existing && 'language' in existing ? { language: (existing as any).language } : {}),
      } as FileSystemItem;

      return {
        ...prev,
        rootId: prev.rootId,
        items: {
          ...items,
          [prev.rootId]: prev.items[prev.rootId] || {
            id: prev.rootId,
            name: rootName,
            type: 'directory',
            parentId: null,
            path: rootPath,
          },
        },
      };
    });
  }, []);

  useEffect(() => {
    const handleFileExplorerRefresh = async (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; newContent?: string }>).detail;
      if (detail?.filePath) {
        upsertWorkspacePath(detail.filePath, detail.newContent ?? '');
        return;
      }

      const currentDir = FileSystemService.getCurrentDirectory();
      if (!currentDir) return;

      try {
        const result = await FileSystemService.openSpecificDirectory(currentDir);
        if (result) {
          setFileSystem(prev => ({
            ...prev,
            items: {
              ...prev.items,
              ...result.items,
            },
            rootId: result.rootId || prev.rootId,
          }));
        }
      } catch (error) {
        console.error('Failed to refresh file explorer:', error);
      }
    };

    window.addEventListener('file-explorer-refresh', handleFileExplorerRefresh as EventListener);
    return () => window.removeEventListener('file-explorer-refresh', handleFileExplorerRefresh as EventListener);
  }, [upsertWorkspacePath]);

  const handleDeleteItem = useCallback(async (item: FileSystemItem) => {
    const success = await FileSystemService.deleteItem(item.path);
    if (success) {
      // If the deleted item was a file and it was open, close its tab
      if (item.type === 'file' && openFiles.includes(item.id)) {
        handleTabClose(item.id);
      }

      // Remove the item and its children from the file system
      const newItems = { ...fileSystem.items };
      const itemsToDelete = new Set<string>();

      // Helper function to collect all child items
      const collectChildren = (parentId: string) => {
        Object.entries(newItems).forEach(([id, item]) => {
          if (item.parentId === parentId) {
            itemsToDelete.add(id);
            if (item.type === 'directory') {
              collectChildren(id);
            }
          }
        });
      };

      // Add the item itself and collect all its children if it's a directory
      itemsToDelete.add(item.id);
      if (item.type === 'directory') {
        collectChildren(item.id);
      }

      // Remove all collected items
      itemsToDelete.forEach(id => {
        delete newItems[id];
      });

      setFileSystem(prev => ({
        ...prev,
        items: newItems,
      }));
    }
  }, [openFiles, fileSystem.items, handleTabClose]);

  const handleRenameItem = async (item: FileSystemItem, newName: string) => {
    try {
      const result = await FileSystemService.renameItem(item.path, newName);
      if (result.success && result.newPath) {
        // Update the item in the file system state
        setFileSystem(prev => {
          const updatedItems = { ...prev.items };
          updatedItems[item.id] = {
            ...item,
            name: newName,
            path: result.newPath as string, // Use type assertion to fix TypeScript error
          };
          return {
            ...prev,
            items: updatedItems,
          };
        });
      }
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };

  // Move reloadFileContent before the useEffect
  const reloadFileContent = async (fileId: string) => {
    try {
      const file = fileSystem.items[fileId];
      if (!file || file.type !== 'file') return;

      // Re-fetch the file content
      const content = await FileSystemService.readFile(fileId);
      if (content !== null) {
        // Update file system state
        setFileSystem(prev => ({
          ...prev,
          items: {
            ...prev.items,
            [fileId]: {
              ...prev.items[fileId],
              content: content,
            },
          },
        }));

        // Update editor content if this is the current file
        if (fileId === fileSystem.currentFileId && editor.current) {
          editor.current.setValue(content);
        }
      }
    } catch (err) {
      console.error('Failed to reload file content:', err);
    }
  };

  // Combine both useEffects into one
  useEffect(() => {
    // Expose the current file information and file system globally
    window.getCurrentFile = () => {
      if (fileSystem.currentFileId) {
        const currentFile = fileSystem.items[fileSystem.currentFileId];
        return currentFile ? { path: currentFile.path } : null;
      }
      return null;
    };
    
    // Expose the file system
    window.fileSystem = fileSystem.items;

    // Expose reloadFileContent
    window.reloadFileContent = reloadFileContent;

    // Expose applyCustomTheme
    window.applyCustomTheme = applyCustomTheme;

      // Expose loadSettings
  window.loadSettings = loadSettings;

  // Add event listener for opening files from chat
  const handleOpenFileEvent = (event: CustomEvent) => {
    const { fileId, content, filename, path } = event.detail;
    
    // Add the file to the file system
    setFileSystem(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [fileId]: {
          id: fileId,
          name: filename,
          type: 'file',
          content: content,
          parentId: prev.rootId,
          path: path,
        },
      },
      currentFileId: fileId,
    }));

    // Add to open files
    setOpenFiles(prev => [...prev, fileId]);

    // Set the editor content
    if (editor.current) {
      editor.current.setValue(content);
      applyCustomTheme();
    }
  };

  window.addEventListener('openFile', handleOpenFileEvent as EventListener);

  return () => {
    window.fileSystem = undefined;
    window.getCurrentFile = null;
    window.reloadFileContent = undefined;
    window.applyCustomTheme = undefined;
    window.loadSettings = undefined;
    window.removeEventListener('openFile', handleOpenFileEvent as EventListener);
  };
  }, [fileSystem, reloadFileContent, applyCustomTheme, loadSettings]);

  // Add to the App component state declarations
  const [currentChatId, setCurrentChatId] = useState<string>(uuidv4());

  // Parallel chat slots — each slot is an independent chat session
  const [chatSlots, setChatSlots] = useState<{ id: string; chatId: string }[]>(() => [{ id: 'slot-1', chatId: uuidv4() }]);
  const [activeChatSlot, setActiveChatSlot] = useState('slot-1');
  const maxParallelChats = 4; // configurable via settings later

  const addChatSlot = useCallback(() => {
    if (chatSlots.length >= maxParallelChats) return;
    const newSlot = { id: `slot-${Date.now()}`, chatId: uuidv4() };
    setChatSlots(prev => [...prev, newSlot]);
    setActiveChatSlot(newSlot.id);
  }, [chatSlots.length, maxParallelChats]);

  const removeChatSlot = useCallback((slotId: string) => {
    setChatSlots(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(s => s.id !== slotId);
      if (activeChatSlot === slotId) setActiveChatSlot(next[next.length - 1].id);
      return next;
    });
  }, [activeChatSlot]);

  // Add this state for Explorer and Git view toggle (derived from activeView)
  const isGitViewActive = activeView === 'git';
  const isExplorerViewActive = activeView === 'explorer';
  const isExtensionsViewActive = activeView === 'extensions';
  const isWorkspaceViewActive = activeView === 'workspace';

  useEffect(() => {
    let mounted = true;
    
    const initializeApp = async () => {
      try {
        // Set connecting state
        setIsConnecting(true);
        setConnectionMessage('');
        
        // Only try to open directory if we're mounted
        if (!mounted) return;

        // Load settings using loadAllSettings
        if (window.loadSettings) {
          await window.loadSettings();
        } else {
          // Fallback to local loadSettings if window.loadSettings is not available
          await loadSettings();
        }

        // Try to open directory only if we have a saved path
        const lastDir = localStorage.getItem('lastDirectory');
        if (lastDir) {
          setConnectionMessage('');
          const result = await FileSystemService.openSpecificDirectory(lastDir);
          if (result) {
            setFileSystem(prevState => ({
              ...prevState,
              items: result.items,
              rootId: result.rootId,
              currentFileId: null, // Don't open the welcome tab
              terminalOpen: false,
            }));
            RecentProjectsService.addProject(lastDir);

            // Restore last session if enabled
            const restoreEnabled = settingsData.advanced?.restoreLastSession ?? true;
            if (restoreEnabled) {
              const savedOpenFilesStr = localStorage.getItem(`session-open-files-${lastDir}`);
              const savedCurrentFileId = localStorage.getItem(`session-current-file-${lastDir}`);
              if (savedOpenFilesStr) {
                try {
                  const savedOpenFiles = JSON.parse(savedOpenFilesStr) as string[];
                  const validOpenFiles = savedOpenFiles.filter(id => result.items[id]);
                  if (validOpenFiles.length > 0) {
                    setOpenFiles(validOpenFiles);
                    const currentId = (savedCurrentFileId && result.items[savedCurrentFileId]) ? savedCurrentFileId : validOpenFiles[validOpenFiles.length - 1];
                    setEditorGroups([{ id: 'group-1', openFiles: validOpenFiles, currentFileId: currentId }]);
                    setFileSystem(prevState => ({
                      ...prevState,
                      items: result.items,
                      rootId: result.rootId,
                      currentFileId: currentId,
                      terminalOpen: false,
                    }));
                    
                    try {
                      const content = await FileSystemService.readFile(currentId);
                      if (content !== null) {
                        setFileSystem(prev => ({
                          ...prev,
                          items: {
                            ...prev.items,
                            [currentId]: {
                              ...prev.items[currentId],
                              content: content,
                            },
                          },
                        }));
                        const isText = !isImageFile(result.items[currentId].name) && 
                                       !isPdfFile(result.items[currentId].name) && 
                                       !isDatabaseFile(result.items[currentId].name) && 
                                       !isWorkspaceFile(result.items[currentId].name) && 
                                       !isSchemaFile(result.items[currentId].name) && 
                                       !isApiFile(result.items[currentId].name) && 
                                       !isFlowFile(result.items[currentId].name) && 
                                       !isBinaryFile(result.items[currentId].name);
                        if (isText && editor.current) {
                          editor.current.setValue(content);
                        }
                      }
                    } catch (err) {
                      console.error('Error restoring active file content:', err);
                    }
                  }
                } catch (e) {
                  console.error('Error parsing restored session files:', e);
                }
              }
            }
          }
        }
        
        // Connection is established — no delay needed
        if (mounted) {
          setIsConnecting(false);
          // Signal Electron that React is ready — closes splash and shows window
          (window as any).electron?.signalReady?.();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setLoadingError('Failed to initialize app');
        setConnectionMessage('Failed to initialize application. Please try again.');
        setTimeout(() => {
          if (mounted) setIsConnecting(false);
        }, 2000);
      }
    };

    initializeApp();

    // Cleanup function to prevent state updates after unmount
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array

  // Add a function to handle terminal toggle
  const toggleTerminal = useCallback(() => {
    setFileSystem(prev => ({
      ...prev,
      terminalOpen: !prev.terminalOpen
    }));
  }, []);

  // Update Discord RPC when editor state changes
  useEffect(() => {
    if (!editor.current || !discordRpcSettings.enabled) return;
    
    const updateDiscordRPC = () => {
      if (!window.electron || !window.electron.discord) return;
      
      const position = editor.current?.getPosition();
      const model = editor.current?.getModel();
      const fileName = getCurrentFileName();
      const workspaceName = fileSystem.items[fileSystem.rootId]?.name || 'Shadow';
      const languageId = model?.getLanguageId() || 'plaintext';
      const content = model?.getValue() || '';
      const fileSize = `${Math.round(content.length / 1024)} KB`;
      
      window.electron.discord.updateEditorInfo({
        file: fileName || 'Untitled',
        workspace: workspaceName,
        line: position?.lineNumber || 1,
        column: position?.column || 1,
        languageId,
        fileSize,
      });
    };
    
    // Update initially
    updateDiscordRPC();
    
    // Set up event listeners for cursor position changes
    const disposable = editor.current.onDidChangeCursorPosition(() => {
      updateDiscordRPC();
    });
    
    // Set up event listener for model changes (file changes)
    const modelDisposable = editor.current.onDidChangeModel(() => {
      updateDiscordRPC();
    });
    
    return () => {
      disposable.dispose();
      modelDisposable.dispose();
    };
  }, [editor.current, discordRpcSettings.enabled, fileSystem.currentFileId]);
  
  // Update Discord settings in main process when they change
  useEffect(() => {
    if (!window.electron || !window.electron.discord) return;
    window.electron.discord.updateSettings(discordRpcSettings);
  }, [discordRpcSettings]);

  // Ensure theme is applied whenever file system state changes
  useEffect(() => {
    if (fileSystem.currentFileId && editor.current) {
      setTimeout(() => {
        applyCustomTheme();
      }, 50);
    }
  }, [fileSystem.currentFileId]);

  // Activity bar view handler
  const handleActivityViewChange = useCallback((view: ActivityView) => {
    if (activeView === view) {
      setActiveView(null);
      setIsSidebarCollapsed(true);
    } else {
      setActiveView(view);
      setIsSidebarCollapsed(view === null);
    }
  }, [activeView]);

  // Keep legacy handlers for any remaining references
  const handleToggleGitView = useCallback(() => handleActivityViewChange('git'), [handleActivityViewChange]);
  const handleToggleExplorerView = useCallback(() => handleActivityViewChange('explorer'), [handleActivityViewChange]);

  // Stable callbacks for MemoizedLLMChat
  const handleLLMClose = useCallback(() => setIsLLMChatVisible(false), []);
  const handleLLMResize = useCallback((newWidth: number) => {
    setWidth(newWidth);
    localStorage.setItem('chatWidth', String(newWidth));
    if (editor.current) {
      setTimeout(() => requestAnimationFrame(() => {
        try { editor.current?.layout(); window.dispatchEvent(new Event('resize')); } catch {}
      }), 0);
    }
  }, []);

  // Memoize file system items to prevent FileExplorer/SplitEditor re-renders
  // when unrelated state (chat visibility, modal state, etc.) changes
  const memoizedItems = useMemo(() => fileSystem.items, [fileSystem.items]);
  const memoizedCurrentFileId = useMemo(() => fileSystem.currentFileId, [fileSystem.currentFileId]);

  // Corrected useEffect for loadAllSettings
  useEffect(() => {
    if (typeof loadSettings === 'function') {
      window.loadSettings = loadSettings;
    }
    return () => {
      delete window.loadSettings;
    };
  }, []);

  // Listen for title format changes
  useEffect(() => {
    const handleTitleFormatChange = (event: Event) => {
      const customEvent = event as CustomEvent<{titleFormat: string}>;
      setDynamicTitleFormat(customEvent.detail?.titleFormat);
    };

    window.addEventListener('title-format-changed', handleTitleFormatChange);

    return () => {
      window.removeEventListener('title-format-changed', handleTitleFormatChange);
    };
  }, []);

  const saveAllSettings = async () => {
    // Implementation of saveAllSettings function
  };

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  const handleToggleGrid = () => {
    setIsGridLayout(prev => !prev);
  };

  // Preview handlers
  const handlePreviewToggle = (fileId: string) => {
    const file = fileSystem.items[fileId];
    if (!file || !isPreviewableFile(file.name)) return;

    const previewType = getPreviewType(file.name);
    if (!previewType) return;

    // Check if preview tab already exists for this file
    const existingPreviewTab = previewTabs.find(tab => tab.fileId === fileId);
    
    if (existingPreviewTab) {
      // Switch to existing preview tab
      setCurrentPreviewTabId(existingPreviewTab.id);
    } else {
      // Create new preview tab
      const newPreviewTab: TabInfo = {
        id: `preview-${fileId}-${Date.now()}`,
        fileId,
        type: 'preview',
        previewType,
      };
      
      setPreviewTabs(prev => [...prev, newPreviewTab]);
      setCurrentPreviewTabId(newPreviewTab.id);
    }
  };

  const handlePreviewTabSelect = (tabId: string) => {
    setCurrentPreviewTabId(tabId);
    // Clear current file selection when switching to preview
    setFileSystem(prev => ({ ...prev, currentFileId: null }));
  };

  const handlePreviewTabClose = (tabId: string) => {
    setPreviewTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    // If closing the current preview tab, switch to another tab or clear selection
    if (tabId === currentPreviewTabId) {
      const remainingPreviewTabs = previewTabs.filter(tab => tab.id !== tabId);
      if (remainingPreviewTabs.length > 0) {
        setCurrentPreviewTabId(remainingPreviewTabs[remainingPreviewTabs.length - 1].id);
      } else {
        setCurrentPreviewTabId(null);
        // Switch back to the last open editor file if available
        if (openFiles.length > 0) {
          const lastFileId = openFiles[openFiles.length - 1];
          setFileSystem(prev => ({ ...prev, currentFileId: lastFileId }));
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!IS_MOBILE) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!IS_MOBILE || !touchStart) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;
    const screenWidth = window.innerWidth;
    
    // Check if primarily a horizontal swipe and meets threshold
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (diffX > 0) {
        // Swipe Right (Left to Right)
        if (isLLMChatVisible && screenWidth - touchStart.x < 120) {
          setIsLLMChatVisible(false);
        } else if (touchStart.x < 50 && isSidebarCollapsed) {
          setIsSidebarCollapsed(false);
        }
      } else {
        // Swipe Left (Right to Left)
        if (!isSidebarCollapsed && touchStart.x < 320) {
          setIsSidebarCollapsed(true);
        } else if (screenWidth - touchStart.x < 50 && !isLLMChatVisible) {
          setIsLLMChatVisible(true);
        }
      }
    }
    setTouchStart(null);
  };

  return (
    <div className="app-container">
      {isConnecting && (
        <LoadingScreen message={connectionMessage} />
      )}
      
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh', 
          overflow: 'hidden',
          background: 'var(--bg-primary)',
        }}
      >
        {IS_MOBILE ? (
          <MobileHeader
            currentFileName={getCurrentFileName()}
            workspaceName={fileSystem.items[fileSystem.rootId]?.name || ''}
            onOpenFolder={handleOpenFolder}
            onToggleSidebar={() => handleActivityViewChange(activeView ?? 'explorer')}
            onToggleAgent={() => setIsLLMChatVisible(v => !v)}
            isAgentVisible={isLLMChatVisible}
            isSidebarVisible={!isSidebarCollapsed}
          />
        ) : (
          <Titlebar
            onOpenFolder={handleOpenFolder}
            onOpenFile={handleOpenFile}
            onCloneRepository={handleCloneRepository}
            onCloseProject={handleCloseProject}
            recentProjects={RecentProjectsService.getRecentProjects()}
            onOpenSpecificFolder={handleOpenSpecificFolder}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onToggleSidebar={() => handleActivityViewChange(activeView ?? 'explorer')}
            onToggleAgent={() => setIsLLMChatVisible(v => !v)}
            onTogglePanel={toggleTerminal}
            onToggleWebPreview={() => setIsWebPreviewOpen(prev => !prev)}
            isSidebarVisible={!isSidebarCollapsed}
            isAgentVisible={isLLMChatVisible}
            isPanelVisible={fileSystem.terminalOpen}
            isWebPreviewVisible={isWebPreviewOpen}
            currentFileName={getCurrentFileName()}
            workspaceName={fileSystem.items[fileSystem.rootId]?.name || ''}
            titleFormat={dynamicTitleFormat || settingsData.advanced?.titleFormat || '{filename} - {workspace} - Shadow'}
          />
        )}
        {/* VSCode-style layout: ActivityBar + Sidebar + Editor + Chat */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <ActivityBar
            activeView={activeView}
            onViewChange={handleActivityViewChange}
            onToggleTerminal={toggleTerminal}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            terminalOpen={fileSystem.terminalOpen}
          />
          <PanelLayout
            showSidebar={!isSidebarCollapsed}
            showChat={isLLMChatVisible}
            sidebar={
              <Resizable
                defaultWidth={300}
                minWidth={180}
                maxWidth={850}
                isCollapsed={isSidebarCollapsed}
                onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                shortcutKey="sidebar"
                storageKey="sidebarWidth"
              >
                {/* VSCode-style panel header */}
                <div className="sidebar-panel-header">
                  {isGitViewActive ? 'Source Control' : isExplorerViewActive ? 'Explorer' : isExtensionsViewActive ? 'Extensions' : isWorkspaceViewActive ? 'Workspace' : 'Sidebar'}
                </div>
                {isLoading ? (
                  <div style={{ padding: '16px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>Loading folder contents...</div>
                    {loadingError && <div style={{ color: 'var(--error-color)' }}>{loadingError}</div>}
                  </div>
                ) : isGitViewActive ? (
                  <GitView onBack={handleToggleExplorerView} />
                ) : isExplorerViewActive ? (
                  fileSystem.rootId === 'root' ? (
                    <div style={{
                      padding: '24px 16px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      height: '100%',
                      background: 'var(--bg-secondary)',
                    }}>
                      <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                        You have not opened a folder yet.
                      </div>
                      <button
                        onClick={handleOpenFolder}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--accent-color)',
                          color: 'var(--bg-primary)',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '13px',
                          textAlign: 'center',
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        Open Folder
                      </button>
                      <button
                        onClick={handleCloneRepository}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--bg-hover)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '4px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontSize: '13px',
                          textAlign: 'center',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-selected)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      >
                        Clone Repository
                      </button>
                    </div>
                  ) : (
                    <FileExplorer
                      items={memoizedItems}
                      rootId={fileSystem.rootId}
                      currentFileId={memoizedCurrentFileId}
                      onFileSelect={handleFileSelect}
                      onCreateFile={createFile}
                      onCreateFolder={createFolder}
                      onFolderContentsLoaded={handleFolderContentsLoaded}
                      onDeleteItem={handleDeleteItem}
                      onRenameItem={handleRenameItem}
                    />
                  )
                ) : isExtensionsViewActive ? (
                  <ExtensionsView />
                ) : isWorkspaceViewActive ? (
                  <VisualWorkspaceSidebar
                    rootId={fileSystem.rootId}
                    onFileSelect={handleFileSelect}
                    onFileCreated={(id, file) => {
                      setFileSystem(prev => ({
                        ...prev,
                        items: {
                          ...prev.items,
                          [id]: file,
                        },
                      }));
                    }}
                  />
                ) : (
                  <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No view selected
                  </div>
                )}
              </Resizable>
            }
            editor={
              <div className="editor-area" style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  {(!fileSystem.items || Object.keys(fileSystem.items).length <= 1 || fileSystem.rootId === 'root') ? (
                    <WelcomeDashboard
                      onOpenFolder={handleOpenFolder}
                      onCloneRepository={handleCloneRepository}
                      onOpenSpecificFolder={handleOpenSpecificFolder}
                      onOpenSettings={() => openSettingsModal('models')}
                    />
                  ) : (
                    <SplitEditor
                      items={memoizedItems}
                      groups={editorGroups}
                      activeGroupId={activeGroupId}
                      onGroupsChange={setEditorGroups}
                      onActiveGroupChange={setActiveGroupId}
                      onEditorChange={(newEditor) => {
                        editor.current = newEditor;
                      }}
                      setSaveStatus={setSaveStatus}
                      previewTabs={previewTabs}
                      currentPreviewTabId={currentPreviewTabId}
                      onPreviewToggle={handlePreviewToggle}
                      onPreviewTabSelect={handlePreviewTabSelect}
                      onPreviewTabClose={handlePreviewTabClose}
                      isGridLayout={isGridLayout}
                      onToggleGrid={handleToggleGrid}
                    />
                  )}
                  {/* Terminal sits inside the editor column — between sidebar and chat */}
                  {fileSystem.terminalOpen && !IS_MOBILE && (
                    <Terminal
                      isVisible={fileSystem.terminalOpen}
                      errorCount={diagnostics.errors}
                      warningCount={diagnostics.warnings}
                    />
                  )}
                </div>
                {isWebPreviewOpen && (
                  <div style={{ width: '45%', minWidth: 320, height: '100%' }}>
                    <WebPreviewPane />
                  </div>
                )}
              </div>
            }
            chat={
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Chat slot tabs — shown when more than 1 slot */}
                {chatSlots.length > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 0,
                    background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)',
                    flexShrink: 0, height: 28, paddingLeft: 4,
                  }}>
                    {chatSlots.map((slot, idx) => (
                      <div
                        key={slot.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '0 8px', height: '100%', cursor: 'shadowide',
                          borderBottom: activeChatSlot === slot.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                          color: activeChatSlot === slot.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: 11, userSelect: 'none',
                        }}
                        onClick={() => setActiveChatSlot(slot.id)}
                      >
                        <span>Chat {idx + 1}</span>
                        <button
                          onClick={e => { e.stopPropagation(); removeChatSlot(slot.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'shadowide', color: 'var(--text-secondary)', fontSize: 12, padding: '0 2px', lineHeight: 1, opacity: 0.6 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Render all slots, show only active */}
                {chatSlots.map(slot => (
                  <div key={slot.id} style={{ flex: 1, display: activeChatSlot === slot.id ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
                    <MemoizedLLMChat
                      isVisible={isLLMChatVisible}
                      onClose={handleLLMClose}
                      onResize={handleLLMResize}
                      currentChatId={slot.chatId}
                      onSelectChat={(id) => {
                        setChatSlots(prev => prev.map(s => s.id === slot.id ? { ...s, chatId: id } : s));
                      }}
                    />
                  </div>
                ))}
              </div>
            }
          />
        </div>{/* end ActivityBar + PanelLayout row */}

        {/* Status Bar — VSCode style */}
        <StatusBar
          currentFileId={fileSystem.currentFileId}
          items={fileSystem.items}
          cursorPosition={cursorPosition}
          saveStatus={saveStatus}
          activeView={activeView}
          onToggleGitView={() => handleActivityViewChange('git')}
          errorCount={diagnostics.errors}
          warningCount={diagnostics.warnings}
        />

        {modalState.isOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}>
            <div style={{
              background: 'var(--bg-primary)',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '320px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '14px' }}>
                Create New {modalState.type === 'file' ? 'File' : 'Folder'}
              </h3>
              <input
                type="text"
                value={modalState.name}
                onChange={(e) => setModalState(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleModalSubmit();
                  if (e.key === 'Escape') setModalState({ isOpen: false, type: null, parentId: null, name: '' });
                }}
                placeholder={`Enter ${modalState.type} name`}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  marginBottom: '16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--accent-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModalState({ isOpen: false, type: null, parentId: null, name: '' })}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    cursor: 'shadowide',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={!modalState.name.trim()}
                  style={{
                    padding: '6px 14px',
                    background: modalState.name.trim() ? 'var(--accent-color)' : 'var(--bg-accent)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: modalState.name.trim() ? 'shadowide' : 'not-allowed',
                    fontSize: '13px',
                    opacity: modalState.name.trim() ? 1 : 0.6,
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        <DiffViewer />

        {/* Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          fileItems={fileSystem.items}
          onOpenFile={(fileId) => {
            handleFileSelect(fileId);
            setIsCommandPaletteOpen(false);
          }}
        />

        {/* Toast notifications */}
        <ToastContainer />

        {/* Settings Modal */}
        <Settings 
          isVisible={isSettingsModalOpen} 
          onClose={() => {
            setIsSettingsModalOpen(false);
            setDynamicTitleFormat(undefined); // Reset dynamic title format on close
            setSettingsInitialCategory(undefined);
            setSettingsInitialModelId(undefined);
            loadSettings();
          }}
          initialSettings={{
            discordRpc: discordRpcSettings,
            onDiscordSettingsChange: (settings) => {
              setDiscordRpcSettings(prev => ({...prev, ...settings}));
            }
          }}
          initialCategory={settingsInitialCategory}
          initialModelId={settingsInitialModelId}
        />

        {/* Clone Repository Modal */}
        <CloneRepositoryModal
          isOpen={isCloneModalOpen}
          onClose={() => setIsCloneModalOpen(false)}
          onClone={async (url, directory) => {
            setIsLoading(true);
            setLoadingError(null);
            
            try {
              const cloneResult = await GitService.cloneRepository(url, directory);
              
              if (!cloneResult.success) {
                throw new Error(cloneResult.error || 'Failed to clone repository');
              }
              
              // If successful, open the folder
              await handleOpenFolder();
            } catch (error: any) {
              console.error('Error cloning repository:', error);
              setLoadingError(`Error cloning repository: ${error.message}`);
              throw error; // Rethrow to be caught by the modal
            } finally {
              setIsLoading(false);
            }
          }}
        />

        {/* Onboarding Flow */}
        {showOnboarding && (
          <OnboardingFlow onDone={async () => {
            setShowOnboarding(false);
            try {
              const currentSettings = await FileSystemService.readSettingsFiles(PathConfig.getActiveSettingsPath());
              const settings = currentSettings?.success ? currentSettings.settings : {};
              const updated = {
                ...settings,
                advanced: {
                  ...(settings.advanced || {}),
                  onboardingDone: true
                }
              };
              await FileSystemService.saveSettingsFiles(PathConfig.getActiveSettingsPath(), updated);
            } catch (err) {
              console.error('Failed to save onboarding done status in settings:', err);
            }
          }} />
        )}
      </div>
    </div>
  );
};

const activityBarButtonStyle = {
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--activity-bar-fg)',
  cursor: 'shadowide',
  opacity: 0.7,
  transition: 'opacity 0.1s ease',
  ':hover': {
    opacity: 1,
  }
};

const titleBarButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  padding: '4px 8px',
  cursor: 'shadowide',
  fontSize: '12px',
  ':hover': {
    background: 'var(--bg-hover)',
  },
  // @ts-ignore
  WebkitAppRegion: 'no-drag',
};

// Add this near the other button styles
const chatSwitcherButtonStyle = {
  ...activityBarButtonStyle,
  position: 'relative' as const,
};

export default App; 

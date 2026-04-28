if ((process.platform === 'win32') && process.argv.includes('--interactive')) require('windows-debugger')({
  title: 'Pointer Debugger',
  eval: (code) => eval(code)
});

const { app, BrowserWindow, dialog, ipcMain, shell, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';
const DiscordRPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { spawn } = require('child_process');
const { runSetup, isSetupNeeded } = require('./setup');

// ── Performance flags (before app ready) ──────────────────────────────────
app.commandLine.appendSwitch('enable-features', 'VizDisplayCompositor,UseSkiaRenderer');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-http-cache', 'false');
// Reduce IPC overhead
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');

// Get dev server port from environment variable or default to 3000
const DEV_SERVER_PORT = process.env.VITE_DEV_SERVER_PORT || '3000';
// Check if connection checks should be skipped
const SKIP_CONNECTION_CHECKS = process.env.SKIP_CONNECTION_CHECKS === 'true';

console.log('Electron app is starting...');
if (SKIP_CONNECTION_CHECKS) {
  console.log('Skip connection checks mode enabled');
}

// Discord RPC client
let rpc = null;
const DISCORD_CLIENT_ID = '1350617401724768328';
let startTimestamp = null;
let discordRpcSettings = {
  enabled: true,
  details: "Editing {file} | Line {line}:{column}",
  state: "Workspace: {workspace}",
  largeImageKey: "pointer_logo",
  largeImageText: "Pointer - Code Editor",
  smallImageKey: "code",
  smallImageText: "{languageId} | Line {line}:{column}",
  button1Label: "Website",
  button1Url: "https://pointr.sh",
  button2Label: "Join the Discord 🚀",
  button2Url: "https://discord.gg/vhgc8THmNk"
};

// Function to load settings from storage
let settingsLoaded = false;
async function loadSettings() {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      if (settings && typeof settings === 'object') {
        discordRpcSettings = { ...discordRpcSettings, ...settings };
        if (!settingsLoaded) console.log('[Discord RPC] Settings loaded.');
      }
    } else {
      const settingsDir = path.dirname(settingsPath);
      if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
      } catch (saveError) {
        console.error('Error saving default Discord RPC settings:', saveError);
      }
    }
    settingsLoaded = true;
  } catch (error) {
    console.error('Error loading Discord RPC settings:', error);
  }
}

// Discord icon mappings - these must match asset names in your Discord Developer Portal
const LANGUAGE_ICONS = {
  'javascript': 'javascript',
  'typescript': 'typescript',
  'python': 'python',
  'html': 'html',
  'css': 'css',
  'json': 'json',
  'markdown': 'markdown',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'csharp': 'csharp',
  'go': 'go',
  'php': 'php',
  'ruby': 'ruby',
  'rust': 'rust',
  'shell': 'shell',
  'sql': 'sql',
  'xml': 'xml',
  'yaml': 'yaml',
};

let editorInfo = {
  file: 'Untitled',
  workspace: 'Pointer',
  line: 1,
  column: 1,
  languageId: 'plaintext',
  fileSize: '0 KB',
};

// Initialize Discord RPC
async function initDiscordRPC() {
  // Load settings first
  await loadSettings();
  
  if (!discordRpcSettings.enabled) {
    console.log('Discord RPC is disabled in settings');
    return;
  }
  
  // Register and create client
  DiscordRPC.register(DISCORD_CLIENT_ID);
  rpc = new DiscordRPC.Client({ transport: 'ipc' });
  startTimestamp = new Date();
  
  // Handle the ready event
  rpc.on('ready', () => {
    console.log('Discord RPC ready');
    updateRichPresence();
    // Keep live status refreshed
    setInterval(updateRichPresence, 15 * 1000);
  });
  
  // Login with client ID
  rpc.login({ clientId: DISCORD_CLIENT_ID })
    .then(() => console.log('Discord RPC login successful'))
    .catch(error => {
      console.log('Discord RPC unavailable (Discord not running):', error.message);
      // disable RPC to avoid repeated attempts
      discordRpcSettings.enabled = false;
    });
}

// Update Discord Rich Presence with current editor info
function updateRichPresence() {
  if (!rpc || !discordRpcSettings.enabled) return;
  
  try {
    // Check if user is not editing a real file
    const isIdling = !editorInfo.file || editorInfo.file === 'Untitled' || editorInfo.file === 'Welcome';
    const activeFile = isIdling ? 'Idle' : path.basename(editorInfo.file);
    const workspaceName = editorInfo.workspace || 'Pointer';

    // Replace placeholders in messages
    const details = isIdling ? `Editing in ${workspaceName}` : `Editing ${activeFile}`;
    const state = isIdling ? 'Waiting for input' : `Workspace: ${workspaceName}`;
    const largeImageText = replaceVariables(discordRpcSettings.largeImageText);
    const smallImageText = isIdling ? 'Idle mode' : `${activeFile} | Line ${editorInfo.line}:${editorInfo.column}`;
    
    // Determine correct image keys based on language
    let smallImageKey = discordRpcSettings.smallImageKey;
    if (editorInfo.languageId && discordRpcSettings.smallImageKey === 'code') {
      // Use language-specific icons when available if using default 'code' setting
      if (LANGUAGE_ICONS[editorInfo.languageId]) {
        smallImageKey = LANGUAGE_ICONS[editorInfo.languageId];
      }
    }
    
    // Prepare buttons array
    const buttons = [];
    
    // Add buttons if they have values
    if (discordRpcSettings.button1Label && discordRpcSettings.button1Url) {
      buttons.push({
        label: discordRpcSettings.button1Label.substring(0, 32),
        url: discordRpcSettings.button1Url
      });
    }
    
    if (discordRpcSettings.button2Label && discordRpcSettings.button2Url) {
      buttons.push({
        label: discordRpcSettings.button2Label.substring(0, 32),
        url: discordRpcSettings.button2Url
      });
    }
    
    // Build the activity object
    const activity = {
      details: isIdling ? 'Idling' : (details || 'Editing'),
      state: state || 'In Pointer Editor',
      startTimestamp: startTimestamp,
      largeImageKey: discordRpcSettings.largeImageKey || 'pointer_logo',
      largeImageText: largeImageText || 'Pointer Code Editor',
      smallImageKey: smallImageKey,
      smallImageText: smallImageText,
      instance: false
    };
    
    // Only add buttons if we have any
    if (buttons.length > 0) {
      activity.buttons = buttons;
    }
    
    // Set the activity
    rpc.setActivity(activity)
      .catch(error => {
        console.log('Discord RPC setActivity failed:', error.message);
      });
      
  } catch (error) {
    console.log('Discord RPC updateRichPresence skipped:', error.message);
  }
}

// Replace placeholder variables in Discord RPC messages
function replaceVariables(message) {
  if (!message) return '';
  
  // Check if user is not editing a real file
  let fileDisplay = editorInfo.file;
  if (!fileDisplay || fileDisplay === 'Untitled' || fileDisplay === 'Welcome') {
    fileDisplay = 'Idling';
  }
  
  return message
    .replace(/{file}/g, fileDisplay)
    .replace(/{workspace}/g, editorInfo.workspace)
    .replace(/{line}/g, editorInfo.line)
    .replace(/{column}/g, editorInfo.column)
    .replace(/{languageId}/g, editorInfo.languageId)
    .replace(/{fileSize}/g, editorInfo.fileSize);
}

// Define icon path based on platform
const getIconPath = () => {
  const platform = process.platform;
  const logoPath = path.join(__dirname, 'logo.png');
  
  // On macOS, we need to use the .icns file for the dock icon
  if (platform === 'darwin') {
    // For development, use the PNG file and set it as the dock icon
    if (isDev) {
      app.dock.setIcon(logoPath);
      return logoPath;
    }
    // For production, use the .icns file from the app bundle
    return path.join(process.resourcesPath, 'app.icns');
  }
  
  // On Windows and Linux, use the PNG file
  return logoPath;
};

// Create a variable to hold the splash window
let splashWindow = null;
let splashReady = false;
let pendingSplashMessage = null;

// Update splash screen message
function updateSplashMessage(message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;

  if (!splashReady) {
    pendingSplashMessage = message;
    return;
  }

  const safeMessage = JSON.stringify(String(message));
  splashWindow.webContents.executeJavaScript(`
    (function() {
      var el = document.querySelector('.message');
      if (el) el.textContent = ${safeMessage};
    })();
  `).catch(() => {});
}

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    resizable: false,
    icon: getIconPath(),
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.webContents.on('did-finish-load', () => {
    splashReady = true;
    if (pendingSplashMessage) {
      updateSplashMessage(pendingSplashMessage);
      pendingSplashMessage = null;
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  // Allow user to close splash manually (quits the app)
  splashWindow.on('closed', () => {
    splashReady = false;
    splashWindow = null;
  });
}

// Check if the backend is running
async function checkBackendConnection() {
  const maxRetries = 10;
  const retryDelay = 1000;
  let retries = 0;

  updateSplashMessage('Starting...');
  
  while (retries < maxRetries) {
    try {
      const response = await fetch('http://127.0.0.1:23816/test-backend');
      if (response.ok) {
        const data = await response.json();
        console.log('Backend connection successful:', data.message);
        return true;
      }
    } catch (err) {
      console.log('Waiting for backend...', retries + 1);
    }
    
    updateSplashMessage(`Connecting to backend... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    retries++;
  }

  return false;
}

async function waitForViteServer() {
  const maxRetries = 10;
  const retryDelay = 1000;
  let retries = 0;

  updateSplashMessage('Starting development server...');

  const serverUrl = `http://localhost:${DEV_SERVER_PORT}`;
  console.log(`Checking for Vite server at: ${serverUrl}`);

  while (retries < maxRetries) {
    try {
      const response = await fetch(serverUrl);
      if (response.ok) {
        console.log('Vite server is ready');
        return true;
      }
    } catch (err) {
      console.log('Waiting for Vite server...', retries + 1);
    }
    
    updateSplashMessage(`Starting development server... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    retries++;
  }
  return false;
}

// Function to show and hide windows with timeout protection
function showMainWindow(mainWindow) {
  console.log('Main window ready to show, cleaning up splash screen');
  
  // Close the splash screen
  if (splashWindow) {
    try {
      splashWindow.destroy();
    } catch (err) {
      console.error('Error closing splash screen:', err);
    }
    splashWindow = null;
  }
  
  // Show main window
  try {
    mainWindow.show();
    console.log('Main window shown successfully');
  } catch (err) {
    console.error('Error showing main window:', err);
  }
}

// ── Backend process management ─────────────────────────────────────────────
let backendProcess = null;

function getAppRoot() {
  // In production the resources are at process.resourcesPath/app
  // In dev they are at the repo root (App/)
  if (isDev) return path.join(__dirname, '..');
  return path.join(process.resourcesPath, 'app');
}

async function startBackend() {
  const appRoot = getAppRoot();
  const backendDir = path.join(appRoot, 'backend-node');
  const serverScript = path.join(backendDir, 'server.js');

  if (!fs.existsSync(serverScript)) {
    console.error('Backend server.js not found at', serverScript);
    return false;
  }

  // Check if backend is already running (started by start-pointer.js)
  try {
    const res = await fetch('http://127.0.0.1:23816/test-backend');
    if (res.ok) {
      console.log('[Backend] Already running, skipping start.');
      return true;
    }
  } catch (_) {}

  return new Promise((resolve) => {
    backendProcess = spawn('node', [serverScript], {
      cwd: backendDir,
      stdio: 'pipe',
      env: { ...process.env }
    });

    backendProcess.stdout.on('data', d => console.log('[Backend]', d.toString().trim()));
    backendProcess.stderr.on('data', d => console.error('[Backend ERR]', d.toString().trim()));
    backendProcess.on('close', code => console.log('[Backend] exited', code));

    // Wait up to 15s for backend to respond
    let attempts = 0;
    const check = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('http://127.0.0.1:23816/test-backend');
        if (res.ok) { clearInterval(check); resolve(true); }
      } catch(e) {}
      if (attempts >= 30) { clearInterval(check); resolve(false); }
    }, 500);
  });
}

// ── Tray ───────────────────────────────────────────────────────────────────
let tray = null;
let forceQuit = false;

function createTray() {
  const iconPath = path.join(__dirname, 'logo.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Pointer — running in background');

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show Pointer',
      click: () => {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length === 0) {
          createWindow();
        } else {
          wins.forEach(w => { w.show(); w.focus(); });
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Pointer',
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]));

  tray.on('click', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length === 0) {
      createWindow();
    } else {
      const win = wins[0];
      if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
    }
  });
}

app.on('before-quit', () => {
  forceQuit = true;
  if (backendProcess) { try { backendProcess.kill(); } catch(e) {} }
});

async function createWindow() {
  try {
    // Load settings first
    await loadSettings();

    // ── First-run setup (install Node.js + npm deps if needed) ─────────────
    if (!isDev) {
      const appRoot = getAppRoot();
      if (isSetupNeeded(appRoot)) {
        updateSplashMessage('Setting up Pointer (first run)...');
        try {
          await runSetup({
            appRoot,
            onStatus: (msg, pct) => {
              console.log(`[Setup ${pct}%] ${msg}`);
              updateSplashMessage(msg);
            }
          });
        } catch(e) {
          dialog.showErrorBox('Setup Failed', `Pointer could not complete setup:\n\n${e.message}\n\nPlease install Node.js from https://nodejs.org and restart.`);
          app.quit();
          return;
        }
      }
    }

    // ── Start Node.js backend ───────────────────────────────────────────────
    updateSplashMessage('Starting backend...');
    const backendStarted = await startBackend();
    if (!backendStarted) {
      console.warn('Backend did not start in time — continuing anyway');
    }

    // First check if backend is running (unless skipping checks)
    if (!SKIP_CONNECTION_CHECKS) {
      const backendReady = await checkBackendConnection();
      if (!backendReady) {
        console.error('Failed to connect to backend');
        // Show error dialog
        if (splashWindow) {
          dialog.showErrorBox(
            'Connection Error',
            'Failed to connect to the backend. Please ensure the backend server is running.'
          );
          splashWindow.destroy();
        }
        app.quit();
        return;
      }
    } else {
      console.log('Skipping backend connection check');
    }
    
    // Update splash message
    updateSplashMessage('Initializing editor...');
    
    // Initialize Discord RPC in background — don't block window creation
    setTimeout(() => initDiscordRPC(), 2000);
    
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      icon: getIconPath(),
      title: 'Pointer',
      frame: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      backgroundColor: '#1e1e1e',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false,
        spellcheck: false,
      }
    });

    mainWindow.setMinimumSize(400, 300);
    mainWindow.setHasShadow(true);

    // Intercept native close — hide to tray instead of quitting
    mainWindow.on('close', (e) => {
      if (!forceQuit) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    // Handle external links - open them in the default browser
    mainWindow.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });

    // Handle link clicks within the app
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Set the app user model ID for Windows
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.pointer');
    }

    // ── Window show logic ──────────────────────────────────────────────────
    // Strategy: show window as soon as React signals ready OR after fallbacks.
    // This prevents the black-window flash.
    const windowShowTimeout = setTimeout(() => {
      showMainWindow(mainWindow);
    }, 12000);

    let reactReady = false;
    const doShow = () => {
      if (reactReady) return;
      reactReady = true;
      clearTimeout(windowShowTimeout);
      showMainWindow(mainWindow);
    };

    // Primary: React sends IPC when app is fully initialized
    ipcMain.once('react-app-ready', doShow);

    // Fallback 1: dom-ready + 1.5s (page parsed, React likely mounted)
    mainWindow.webContents.once('dom-ready', () => {
      setTimeout(doShow, 1500);
    });

    // Fallback 2: did-finish-load + 2s
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(doShow, 2000);
    });

    // Once everything is loaded and rendered, show the main window and close the splash
    mainWindow.once('ready-to-show', () => {
      // Don't show yet — wait for React signal or did-finish-load fallback
    });

    // Load the app
    if (isDev) {
      // Wait for Vite server in development (unless skipping checks)
      if (!SKIP_CONNECTION_CHECKS) {
        const serverReady = await waitForViteServer();
        if (!serverReady) {
          console.error('Failed to connect to Vite server');
          if (splashWindow) {
            dialog.showErrorBox(
              'Development Server Error',
              'Failed to connect to the development server. Please ensure "yarn start" is running.'
            );
            splashWindow.destroy();
          }
          app.quit();
          return;
        }
      } else {
        console.log('Skipping Vite server connection check');
      }

      updateSplashMessage('Loading development environment...');
      const devUrl = `http://localhost:${DEV_SERVER_PORT}`;
      console.log(`Loading development URL: ${devUrl}`);
      try {
        await mainWindow.loadURL(devUrl);
        console.log('Development URL loaded successfully');
      } catch (error) {
        console.error('Error loading development URL:', error);
        // Show the window anyway if we hit an error trying to load the URL
        showMainWindow(mainWindow);
      }
      
    } else {
      updateSplashMessage('Loading application...');
      console.log('Loading application from dist folder');
      try {
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        console.log('Application loaded successfully from dist folder');
      } catch (error) {
        console.error('Error loading application from dist folder:', error);
        // Show the window anyway if we hit an error trying to load the file
        showMainWindow(mainWindow);
      }
    }

    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
      if (isDev) {
        // Retry loading in development
        setTimeout(() => {
          console.log('Retrying to load the app...');
          const devUrl = `http://localhost:${DEV_SERVER_PORT}`;
          mainWindow.loadURL(devUrl).catch(err => {
            console.error('Error retrying load:', err);
            // Force show the window even if we can't load it
            showMainWindow(mainWindow);
          });
        }, 1000);
      } else {
        // Force show the window even if we can't load it
        showMainWindow(mainWindow);
      }
    });

    // Log any console messages from the renderer process
    mainWindow.webContents.on('console-message', (event, level, message) => {
      console.log('Renderer Console:', message);
    });
  } catch (error) {
    console.error('Error in createWindow:', error);
    if (splashWindow) {
      dialog.showErrorBox(
        'Application Error',
        'An error occurred while initializing the application. Please try restarting the application.'
      );
      splashWindow.destroy();
    }
    app.quit();
  }
}

app.commandLine.appendSwitch('force-color-profile', 'srgb');

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('Electron app is ready.');
  
  // Load settings first thing
  await loadSettings();

  // Create system tray
  createTray();
  
  // Create and show the splash screen
  createSplashScreen();
  
  // Create the main window
  await createWindow();

  if (process.platform === 'win32') {
    app.setAppUserModelId(''); // empty app user model id to allow the jump list to be set correctly

    app.setUserTasks([
      {
        program: process.execPath,
        arguments: (isDev) ? __filename : '',
        iconPath: path.join(__dirname, 'logo.png'),
        iconIndex: 0,
        title: 'New Window',
        description: 'Open a new application window'
      }
    ]);

    app.setAppUserModelId('com.pointer');
  };

  autoUpdater.checkForUpdatesAndNotify();

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 1 * 60 * 60 * 1000); // every hour
});

// Quit when all windows are closed — hide to tray instead of quitting.
app.on('window-all-closed', () => {
  // Stay alive in tray on all platforms
});

app.on('activate', () => {
  console.log('App activated. Checking for open windows...');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for Discord RPC
ipcMain.on('editor-info-update', (event, info) => {
  editorInfo = { ...editorInfo, ...info };
  updateRichPresence();
});

// Window control handlers
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.hide(); // Hide to tray instead of closing
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
});

ipcMain.on('discord-settings-update', (event, settings) => {
  discordRpcSettings = { ...discordRpcSettings, ...settings };
  
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
  } catch (error) {
    console.error('Error saving Discord RPC settings:', error);
  }
  
  if (settings.enabled !== undefined) {
    if (settings.enabled) {
      if (!rpc) initDiscordRPC();
    } else {
      if (rpc) {
        // Safe destroy — ignore errors if socket already closed
        try { rpc.destroy(); } catch (_) {}
        rpc = null;
      }
    }
  } else {
    updateRichPresence();
  }
});

// Update Discord Rich Presence settings
ipcMain.handle('update-discord-rpc-settings', async (event, newSettings) => {
  try {
    console.log('Updating Discord RPC settings:', newSettings);
    
    // Update the global settings object
    discordRpcSettings = { ...discordRpcSettings, ...newSettings };
    
    // Save settings to file
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings', 'discord_rpc.json');
    
    // Create the settings directory if it doesn't exist
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    // Save the settings
    fs.writeFileSync(settingsPath, JSON.stringify(discordRpcSettings, null, 2));
    console.log('Discord RPC settings saved to:', settingsPath);
    
    // Update the rich presence with new settings
    if (rpc && discordRpcSettings.enabled) {
      updateRichPresence();
    } else if (!discordRpcSettings.enabled && rpc) {
      // Clear presence if disabled — safe call
      try { rpc.clearActivity(); } catch (_) {}
    } else if (discordRpcSettings.enabled && !rpc) {
      initDiscordRPC();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating Discord RPC settings:', error);
    return { success: false, error: error.message };
  }
});

// Get Discord Rich Presence settings
ipcMain.handle('get-discord-rpc-settings', async () => {
  await loadSettings();
  return discordRpcSettings;
});

// Open file/folder in system explorer
ipcMain.handle('open-in-explorer', async (event, filePath) => {
  try {
    // Check if the file/folder exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Path does not exist: ${filePath}`);
    }
    
    // Get the stats to determine if it's a file or folder
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // For folders, show the folder in the explorer
      await shell.openPath(filePath);
    } else {
      // For files, show the file in the explorer (will highlight the file)
      await shell.showItemInFolder(filePath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error opening in explorer:', error);
    return { success: false, error: error.message };
  }
});

// Open external links in default browser
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external link:', error);
    return { success: false, error: error.message };
  }
});

// Native file/folder dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const result = await dialog.showOpenDialog(win, options);
    return result; // { canceled, filePaths }
  } catch (error) {
    console.error('Error showing open dialog:', error);
    return { canceled: true, filePaths: [] };
  }
});

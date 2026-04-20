# Pointer — Building the Installer

## Prerequisites (build machine only — NOT required for end users)
- Node.js 18+ and yarn
- Windows: build the Windows installer on a Windows machine
- macOS: build the macOS installer on a macOS machine
- **Windows specific**: NSIS (Nullsoft Scriptable Install System) installed
- **macOS specific**: Xcode Command Line Tools (`xcode-select --install`)

## Build the installer

```bash
cd App

# Install build dependencies (one-time)
yarn install

# Build Windows .exe installer (NSIS)
yarn dist:win

# Build macOS .dmg installer
yarn dist:mac

# Build both platforms (requires both Windows and macOS or cross-compilation)
yarn dist
```

The finished installer is placed in `App/release/`:
- Windows: `Pointer Setup 1.0.0.exe`
- macOS: `Pointer-1.0.0.dmg`

## Advanced Build Options

```bash
# Build with debug information
yarn build && electron-builder --win --publish never

# Build for specific architecture
yarn build && electron-builder --win --x64
yarn build && electron-builder --mac --arm64

# Build without code signing (for testing)
yarn build && electron-builder --win --config.forceCodeSigning=false
```

## What the installer does

### Windows (.exe via NSIS)
1. Installs Pointer to `C:\Program Files\Pointer` (customizable location)
2. Checks for Node.js installation with multiple fallback strategies:
   - Uses local Node.js installer if included (`node-win-x64.zip`)
   - Downloads Node.js 20 LTS with retry logic (3 attempts)
   - Installs silently with progress reporting
3. Runs `npm install` for all dependencies with retry mechanism
4. Creates desktop shortcut and Start Menu entry
5. Sets up environment variables

### macOS (.dmg)
1. Copies Pointer.app to /Applications
2. Runs post-install script that:
   - Checks for Node.js in multiple locations
   - Offers local installation if available
   - Guides user to download if missing
3. On first launch: `setup.js` verifies installation
4. Runs `npm install` with retry logic for all dependencies

## How it works (technical)

### Installation Flow:
1. **NSIS Installer (Windows)**: `installer/nsis-custom.nsh` handles Node.js check and installation
2. **macOS Post-Install**: `installer/mac-postinstall.sh` runs after app copy
3. **First Launch Setup**: `electron/setup.js` runs on app start to finalize installation

### Key Improvements:
- **Retry Logic**: All downloads and npm installs have 3 retry attempts
- **Progress Reporting**: Detailed progress updates during installation
- **Error Handling**: User-friendly error messages with recovery options
- **Offline Support**: Can use local Node.js installers
- **Path Detection**: Checks multiple Node.js installation locations

### File Structure:
```
App/installer/
├── nsis-custom.nsh          # Windows NSIS custom script
├── mac-postinstall.sh       # macOS post-install script
└── node-win-x64.zip        # Optional local Node.js for Windows

App/electron/
├── setup.js                # First-launch setup manager
└── main.js                 # Main Electron process
```

## Troubleshooting

### Common Build Issues:

**Windows:**
```bash
# If NSIS is not found:
choco install nsis

# If build fails with signing errors:
set CSC_LINK=
set CSC_KEY_PASSWORD=
```

**macOS:**
```bash
# If code signing fails:
export CSC_IDENTITY_AUTO_DISCOVERY=false

# If notarization fails:
# Check Apple Developer account and credentials
```

**Both:**
```bash
# Clean build:
rm -rf node_modules dist release
yarn install
yarn build
yarn dist:win  # or dist:mac
```

## Testing the Installer

1. **Windows**: Run the `.exe` on a clean Windows VM or machine
2. **macOS**: Test on a clean macOS installation
3. **Verify**:
   - Installation completes without errors
   - Node.js is detected or installed
   - App launches successfully
   - All features work correctly

## Continuous Integration

Example GitHub Actions workflow:
```yaml
name: Build Installers
on: [push, pull_request]
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd App && yarn install && yarn dist:win
      - uses: actions/upload-artifact@v3
        with:
          name: pointer-windows-installer
          path: App/release/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd App && yarn install && yarn dist:mac
      - uses: actions/upload-artifact@v3
        with:
          name: pointer-macos-installer
          path: App/release/*.dmg
```

## New Installer Scripts

The improved installer includes new utility scripts:

### Test Installation Components
```bash
# Test all installer components
yarn installer:test

# Test specific components
node installer/test-installation.js
```

### Prepare Offline Installation
```bash
# Download Node.js for offline installation
yarn installer:prepare-offline

# This creates offline installer packages in:
# - installer/windows-offline/ (Windows)
# - installer/macos-offline/ (macOS)
```

### Verify Before Building
```bash
# Verify all components before building
yarn installer:verify
```

## What's Improved

### 1. **Enhanced Error Handling**
- Retry logic for downloads (3 attempts)
- Better error messages for users
- Graceful degradation when npm install fails

### 2. **Progress Reporting**
- Detailed progress during Node.js download
- Percentage-based updates
- Clear status messages

### 3. **Offline Support**
- Can use local Node.js installers
- Fallback to download if local not available
- Prepared offline installer packages

### 4. **macOS Improvements**
- Supports both Intel and Apple Silicon
- Tries user installation before requiring admin
- Better architecture detection

### 5. **Windows Improvements**
- Checks for local Node.js installer first
- Better PATH handling
- Cleaner uninstallation

## Quick Start for Testing

1. **Test the installer components:**
   ```bash
   cd App
   yarn installer:test
   ```

2. **Build the installer:**
   ```bash
   # Windows
   yarn dist:win
   
   # macOS  
   yarn dist:mac
   ```

3. **Test the built installer:**
   - Windows: Run `release/Pointer Setup 1.0.0.exe`
   - macOS: Mount `release/Pointer-1.0.0.dmg` and copy to Applications

## Next Steps

After building, consider:
1. **Code Signing**: Sign the installer for distribution
2. **Notarization** (macOS): Notarize through Apple
3. **Update Server**: Set up auto-update server
4. **CI/CD**: Automate builds with GitHub Actions
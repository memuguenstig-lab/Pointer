#!/bin/bash
# Pointer macOS post-install script
# Runs after the app is copied to /Applications

set -e  # Exit on error

APP_DIR="$(dirname "$0")/../Resources"
BACKEND_DIR="$APP_DIR/backend-node"
APP_RESOURCES="$APP_DIR/app"

echo "=== Pointer macOS Setup ==="
echo "Checking Node.js..."

# Check multiple possible node locations
NODE_PATHS=(
  "/usr/local/bin/node"
  "/opt/homebrew/bin/node"
  "$HOME/.nvm/versions/node/*/bin/node"
  "/usr/bin/node"
)

NODE_FOUND=""
for NODE_PATH in "${NODE_PATHS[@]}"; do
  if command -v "$NODE_PATH" &> /dev/null; then
    NODE_FOUND="$NODE_PATH"
    break
  fi
done

if [ -z "$NODE_FOUND" ]; then
  # Try to find node in PATH
  if command -v node &> /dev/null; then
    NODE_FOUND="node"
  fi
fi

if [ -z "$NODE_FOUND" ]; then
  echo "Node.js not found. Checking for local installer..."
  
  # Check for local Node.js installer
  if [ -f "$APP_DIR/node-mac-arm64.pkg" ] || [ -f "$APP_DIR/node-mac-x64.pkg" ]; then
    echo "Found local Node.js installer..."
    
    # Determine architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ] && [ -f "$APP_DIR/node-mac-arm64.pkg" ]; then
      INSTALLER="$APP_DIR/node-mac-arm64.pkg"
    elif [ -f "$APP_DIR/node-mac-x64.pkg" ]; then
      INSTALLER="$APP_DIR/node-mac-x64.pkg"
    fi
    
    if [ -n "$INSTALLER" ]; then
      echo "Installing Node.js from local package..."
      
      # Try without sudo first
      if installer -pkg "$INSTALLER" -target CurrentUserHomeDirectory 2>/dev/null; then
        echo "Node.js installed to user directory."
        export PATH="$HOME/node/bin:$PATH"
      else
        # Fallback to system installation with user confirmation
        echo "User directory installation failed. Requesting system installation..."
        osascript <<EOF
display dialog "Pointer needs to install Node.js to run.$\n$\nThis requires administrator privileges." with title "Pointer - Install Node.js" buttons {"Cancel", "Install"} default button "Install" cancel button "Cancel" with icon caution
EOF
        if [ $? -eq 0 ]; then
          sudo installer -pkg "$INSTALLER" -target /
          echo "Node.js installed system-wide."
        else
          echo "Installation cancelled by user."
          exit 1
        fi
      fi
    fi
  else
    # No local installer, prompt user
    echo "Node.js not found. Opening nodejs.org for download..."
    open "https://nodejs.org/en/download/"
    
    osascript <<EOF
display dialog "Node.js is required to run Pointer.$\n$\nPlease install Node.js from nodejs.org and then launch Pointer again.$\n$\nThe download page has been opened in your browser." with title "Pointer - Node.js Required" buttons {"OK"} default button "OK" with icon caution
EOF
    exit 1
  fi
fi

# Verify Node.js is now available
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js still not found after installation attempts."
  exit 1
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(node --version | cut -d. -f1 | tr -d 'v')
echo "Node.js found: $NODE_VERSION"

# Check Node.js version
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "WARNING: Node.js version $NODE_VERSION is older than required (18+)."
  echo "Pointer may not work correctly."
fi

# Install backend dependencies with retry
if [ -d "$BACKEND_DIR" ]; then
  echo "Installing backend dependencies..."
  MAX_RETRIES=3
  RETRY_COUNT=0
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $(($RETRY_COUNT + 1))/$MAX_RETRIES..."
    if cd "$BACKEND_DIR" && npm install --production --prefer-offline --no-audit --no-fund 2>&1; then
      echo "Backend dependencies installed successfully."
      break
    else
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "Installation failed, retrying in 5 seconds..."
        sleep 5
      else
        echo "WARNING: Backend dependencies installation failed after $MAX_RETRIES attempts."
        echo "Pointer will try to start anyway."
      fi
    fi
  done
fi

# Install app dependencies with retry
if [ -d "$APP_RESOURCES" ]; then
  echo "Installing app dependencies..."
  MAX_RETRIES=3
  RETRY_COUNT=0
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $(($RETRY_COUNT + 1))/$MAX_RETRIES..."
    if cd "$APP_RESOURCES" && npm install --production --prefer-offline --no-audit --no-fund 2>&1; then
      echo "App dependencies installed successfully."
      break
    else
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "Installation failed, retrying in 5 seconds..."
        sleep 5
      else
        echo "WARNING: App dependencies installation failed after $MAX_RETRIES attempts."
        echo "Pointer will try to start anyway."
      fi
    fi
  done
fi

echo "=== Pointer setup complete ==="
echo "You can now launch Pointer from your Applications folder."

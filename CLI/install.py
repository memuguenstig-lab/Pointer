#!/usr/bin/env python3
"""
ShadowIDE CLI Installation Script

This script installs ShadowIDE CLI and ensures the 'shadowide' command is available globally.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
import platform

def check_python_version():
    """Check if Python version is 3.8 or higher."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Error: Python 3.8 or higher is required. Found: {version.major}.{version.minor}")
        return False
    print(f"✅ Python version check passed: {version.major}.{version.minor}")
    return True

def check_pip():
    """Check if pip is available."""
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      check=True, capture_output=True)
        print("✅ pip is available")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error: pip is not available")
        return False

def install_shadowide_cli():
    """Install ShadowIDE CLI in development mode."""
    print("🔧 Installing ShadowIDE CLI in development mode...")
    
    try:
        # Install in development mode
        result = subprocess.run([
            sys.executable, "-m", "pip", "install", "-e", "."
        ], check=True, capture_output=True, text=True)
        
        print("✅ Installation successful!")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Installation failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def verify_installation():
    """Verify that the shadowide command is available."""
    print("🔍 Verifying installation...")
    
    # Check if shadowide command is available
    shadowide_path = shutil.which("shadowide")
    if shadowide_path:
        print(f"✅ 'shadowide' command found at: {shadowide_path}")
        return True
    else:
        print("❌ 'shadowide' command not found in PATH")
        return False

def get_scripts_directory():
    """Get the Python scripts directory."""
    # Method 1: Try to get from pip show
    try:
        result = subprocess.run([
            sys.executable, "-m", "pip", "show", "-f", "shadowide-cli"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if 'Location:' in line:
                    location = line.split('Location:')[1].strip()
                    scripts_dir = Path(location).parent / "Scripts" if platform.system() == "Windows" else Path(location).parent / "bin"
                    if scripts_dir.exists():
                        return scripts_dir
    except Exception:
        pass
    
    # Method 2: Try to find from site-packages
    try:
        import site
        site_packages = site.getsitepackages()[0]
        scripts_dir = Path(site_packages).parent / "Scripts" if platform.system() == "Windows" else Path(site_packages).parent / "bin"
        if scripts_dir.exists():
            return scripts_dir
    except Exception:
        pass
    
    # Method 3: Try to find from sys.executable
    try:
        python_exe = Path(sys.executable)
        scripts_dir = python_exe.parent / "Scripts" if platform.system() == "Windows" else python_exe.parent / "bin"
        if scripts_dir.exists():
            return scripts_dir
    except Exception:
        pass
    
    # Method 4: Try to find from user site-packages
    try:
        import site
        user_site = site.getusersitepackages()
        scripts_dir = Path(user_site).parent / "Scripts" if platform.system() == "Windows" else Path(user_site).parent / "bin"
        if scripts_dir.exists():
            return scripts_dir
    except Exception:
        pass
    
    # Method 5: Try common locations
    try:
        if platform.system() == "Windows":
            # Common Windows locations
            possible_paths = [
                Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python311" / "Scripts",
                Path.home() / "AppData" / "Roaming" / "Python" / "Python311" / "Scripts",
                Path.home() / "AppData" / "Local" / "Packages" / "PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0" / "LocalCache" / "local-packages" / "Python311" / "Scripts",
            ]
        else:
            # Common Unix locations
            possible_paths = [
                Path.home() / ".local" / "bin",
                Path("/usr/local/bin"),
                Path("/usr/bin"),
            ]
        
        for path in possible_paths:
            if path.exists():
                return path
    except Exception:
        pass
    
    return None

def create_shadowide_batch_file():
    """Create a shadowide.bat file in a directory that's in PATH."""
    try:
        batch_content = f"""@echo off
python -m shadowide_cli %*"""
        
        # Try to find a directory that's in PATH where we can create the batch file
        path_dirs = os.environ.get('PATH', '').split(';')
        
        for path_dir in path_dirs:
            if path_dir.strip():
                try:
                    path_path = Path(path_dir.strip())
                    if path_path.exists() and path_path.is_dir():
                        # Test if we can write to this directory
                        test_file = path_path / "test_write.tmp"
                        try:
                            with open(test_file, 'w') as f:
                                f.write("test")
                            test_file.unlink()  # Delete test file
                            
                            # Create shadowide.bat in this directory
                            batch_file = path_path / "shadowide.bat"
                            with open(batch_file, 'w') as f:
                                f.write(batch_content)
                            
                            print(f"✅ Created shadowide.bat in: {batch_file}")
                            return True
                        except Exception:
                            continue
                except Exception:
                    continue
        
        # If no writable directory found, try WindowsApps directory
        if platform.system() == "Windows":
            windows_apps = Path.home() / "AppData" / "Local" / "Microsoft" / "WindowsApps"
            if windows_apps.exists():
                try:
                    batch_file = windows_apps / "shadowide.bat"
                    with open(batch_file, 'w') as f:
                        f.write(batch_content)
                    print(f"✅ Created shadowide.bat in WindowsApps: {batch_file}")
                    return True
                except Exception:
                    pass
        
        # Fallback: create in current directory
        batch_file = Path.cwd() / "shadowide.bat"
        with open(batch_file, 'w') as f:
            f.write(batch_content)
        
        print(f"✅ Created shadowide.bat in current directory: {batch_file}")
        print("💡 You can copy this file to a directory in your PATH")
        print("💡 Or use: .\\shadowide instead of shadowide")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create shadowide.bat: {e}")
        return False

def add_to_path_windows(scripts_dir):
    """Add scripts directory to Windows PATH permanently."""
    try:
        print(f"🔧 Adding {scripts_dir} to Windows PATH...")
        
        # Get current PATH from registry
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_ALL_ACCESS)
        try:
            current_path, _ = winreg.QueryValueEx(key, "PATH")
        except FileNotFoundError:
            current_path = ""
        
        # Add scripts directory if not already in PATH
        if str(scripts_dir) not in current_path:
            new_path = f"{current_path};{scripts_dir}" if current_path else str(scripts_dir)
            winreg.SetValueEx(key, "PATH", 0, winreg.REG_EXPAND_SZ, new_path)
            winreg.CloseKey(key)
            
            # Broadcast WM_SETTINGCHANGE to notify other processes
            import ctypes
            ctypes.windll.user32.SendMessageW(0xFFFF, 0x001A, 0, "Environment")
            
            print("✅ Successfully added to PATH!")
            print("⚠️  You may need to restart your terminal for changes to take effect.")
            return True
        else:
            print("✅ Scripts directory is already in PATH")
            return True
            
    except Exception as e:
        print(f"❌ Failed to add to PATH: {e}")
        return False

def debug_path_info():
    """Debug function to show path information."""
    print("\n🔍 Debug Information:")
    print(f"Python executable: {sys.executable}")
    print(f"Platform: {platform.system()}")
    
    try:
        import site
        print(f"Site packages: {site.getsitepackages()}")
        print(f"User site: {site.getusersitepackages()}")
    except Exception as e:
        print(f"Site info error: {e}")
    
    # Check if shadowide.exe exists in common locations
    if platform.system() == "Windows":
        possible_locations = [
            Path(sys.executable).parent / "Scripts" / "shadowide.exe",
            Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python311" / "Scripts" / "shadowide.exe",
            Path.home() / "AppData" / "Roaming" / "Python" / "Python311" / "Scripts" / "shadowide.exe",
        ]
        
        print("\n🔍 Checking for shadowide.exe:")
        for location in possible_locations:
            if location.exists():
                print(f"✅ Found: {location}")
            else:
                print(f"❌ Not found: {location}")

def check_path_setup():
    """Check and provide guidance on PATH setup."""
    print("\n📋 PATH Configuration Check:")
    
    scripts_dir = get_scripts_directory()
    
    if scripts_dir and scripts_dir.exists():
        print(f"📁 Scripts directory: {scripts_dir}")
        
        # Check if it's in PATH
        path_env = os.environ.get('PATH', '')
        if str(scripts_dir) in path_env:
            print("✅ Scripts directory is in PATH")
            return True
        else:
            print("⚠️  Scripts directory is NOT in PATH")
            
            if platform.system() == "Windows":
                print("🔧 Attempting to add to PATH automatically...")
                if add_to_path_windows(scripts_dir):
                    return True
                else:
                    print("🔧 Creating shadowide.bat as alternative...")
                    if create_shadowide_batch_file():
                        return True
                    else:
                        print("\n   Manual Windows PATH setup:")
                        print(f"   setx PATH \"%PATH%;{scripts_dir}\"")
            else:
                print("\n   Unix/Linux PATH setup:")
                print(f"   export PATH=\"$PATH:{scripts_dir}\"")
                print("   Add to ~/.bashrc or ~/.zshrc for permanent setup")
    else:
        print("⚠️  Could not determine scripts directory")
        if platform.system() == "Windows":
            print("🔧 Creating shadowide.bat as alternative...")
            if create_shadowide_batch_file():
                return True
        debug_path_info()
    
    return False

def show_usage_instructions():
    """Show usage instructions after installation."""
    print("\n🎉 ShadowIDE CLI Installation Complete!")
    print("\n📖 Usage Instructions:")
    print("  1. Run: shadowide (or .\\shadowide on Windows)")
    print("  2. Initialize configuration on first run")
    print("  3. Start chatting with your codebase!")
    print("\n🔧 Available Commands:")
    print("  shadowide              - Start the CLI")
    print("  shadowide --version    - Show version")
    print("  shadowide --init       - Initialize configuration")
    print("  shadowide --help       - Show help")
    print("\n💡 Alternative Usage:")
    print("  python -m shadowide_cli - Always works")
    print("\n📁 Configuration Location:")
    print("  ~/.shadowide-cli/config.json")

def main():
    """Main installation function."""
    print("🚀 ShadowIDE CLI Installation Script")
    print("=" * 40)
    
    # Check prerequisites
    if not check_python_version():
        sys.exit(1)
    
    if not check_pip():
        sys.exit(1)
    
    # Install ShadowIDE CLI
    if not install_shadowide_cli():
        sys.exit(1)
    
    # Verify installation
    if not verify_installation():
        print("\n⚠️  Installation completed but 'shadowide' command not found in PATH")
        path_setup_success = check_path_setup()
        
        if path_setup_success:
            print("\n🔄 Re-verifying installation after PATH update...")
            if verify_installation():
                print("✅ Installation and PATH setup verified!")
            else:
                print("⚠️  PATH updated but 'shadowide' command still not found")
                print("💡 Try restarting your terminal and running: shadowide")
                print("💡 Or use: python -m shadowide_cli")
        else:
            print("\n💡 Try running: python -m shadowide_cli")
    else:
        print("✅ Installation and PATH setup verified!")
    
    # Show usage instructions
    show_usage_instructions()

if __name__ == "__main__":
    main()

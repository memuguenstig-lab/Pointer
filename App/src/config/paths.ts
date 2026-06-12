/**
 * Centralized path configuration for cross-platform compatibility
 * Note: Actual path resolution is handled by the backend for security and cross-platform compatibility
 */

export class PathConfig {
  /**
   * Get a placeholder settings path - actual path resolution is handled by backend
   */
  static getSettingsPath(): string {
    return 'settings'; // Backend will resolve to proper platform-specific path
  }

  /**
   * Get a placeholder data path - actual path resolution is handled by backend
   */
  static getDataPath(): string {
    return 'data'; // Backend will resolve to proper platform-specific path
  }

  /**
   * Get a placeholder cache path - actual path resolution is handled by backend
   */
  static getCachePath(): string {
    return 'cache'; // Backend will resolve to proper platform-specific path
  }

  /**
   * Get the active settings path (backend handles actual resolution)
   */
  static getActiveSettingsPath(): string {
    return this.getSettingsPath();
  }

  /**
   * Get the active data path (backend handles actual resolution)
   */
  static getActiveDataPath(): string {
    return this.getDataPath();
  }

  /**
   * Get platform information for debugging
   */
  static getPlatformInfo(): {
    platform: string;
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    settingsPath: string;
    dataPath: string;
  } {
    const platform = window.navigator.platform.toLowerCase();
    return {
      platform: window.navigator.platform,
      isWindows: platform.includes('win'),
      isMac: platform.includes('mac'),
      isLinux: !platform.includes('win') && !platform.includes('mac'),
      settingsPath: this.getActiveSettingsPath(),
      dataPath: this.getActiveDataPath(),
    };
  }
} 

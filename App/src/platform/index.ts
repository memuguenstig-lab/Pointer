/**
 * Platform abstraction layer.
 *
 * Usage:
 *   import { platform } from '../platform';
 *   await platform.fs.readFile('/path/to/file');
 *   await platform.window.minimize();
 *
 * The correct implementation is selected at runtime based on the environment:
 *   - Electron  → window.electron is present
 *   - Capacitor → window.Capacitor is present
 *   - Web       → fallback (limited functionality)
 */

import type { PlatformAPI } from './types';
import { ElectronPlatform } from './electron';
import { CapacitorPlatform } from './capacitor';
import { WebPlatform } from './web';

function detectPlatform(): PlatformAPI {
  if (typeof window !== 'undefined' && (window as any).electron) {
    return new ElectronPlatform();
  }
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return new CapacitorPlatform();
  }
  return new WebPlatform();
}

export const platform: PlatformAPI = detectPlatform();

export type { PlatformAPI };
export * from './types';

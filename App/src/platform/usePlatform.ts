/**
 * React hook to access the platform API and platform info.
 *
 * Usage:
 *   const { platform, isMobile, isDesktop } = usePlatform();
 *   const content = await platform.fs.readFile('/path');
 */

import { platform } from './index';

export function usePlatform() {
  return {
    platform,
    isMobile:  platform.info.isMobile,
    isDesktop: platform.info.isDesktop,
    isElectron: platform.info.type === 'electron',
    isCapacitor: platform.info.type === 'capacitor',
    isWeb: platform.info.type === 'web',
    os: platform.info.os,
  };
}

/** Simple boolean helpers for conditional rendering */
export const IS_MOBILE  = platform.info.isMobile;
export const IS_DESKTOP = platform.info.isDesktop;
export const IS_ELECTRON = platform.info.type === 'electron';
export const IS_CAPACITOR = platform.info.type === 'capacitor';

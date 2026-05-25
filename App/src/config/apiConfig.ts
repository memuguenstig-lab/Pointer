/**
 * Centralized API configuration.
 * Reads from the platform layer so desktop/mobile/web all get the right URL.
 */

// Runtime platform detection (set by vite.config.ts via define)
const PLATFORM = (import.meta.env.VITE_PLATFORM as string) ?? 'electron';

export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:23816';
};

export const getWsUrl = (): string => {
  return import.meta.env.VITE_WS_URL || 'ws://localhost:23816';
};

export const getDevServerPort = (): number => {
  return parseInt(import.meta.env.VITE_DEV_SERVER_PORT || '3000', 10);
};

export const API_CONFIG = {
  API_URL: getApiUrl(),
  WS_URL: getWsUrl(),
  DEV_SERVER_PORT: getDevServerPort(),
  PLATFORM,
  IS_MOBILE:   PLATFORM === 'capacitor',
  IS_DESKTOP:  PLATFORM === 'electron',
  IS_WEB:      PLATFORM === 'web',
  IS_PRODUCTION: import.meta.env.MODE === 'production',
  IS_DEVELOPMENT: import.meta.env.MODE === 'development',
  ALLOWED_ORIGINS: (import.meta.env.VITE_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  ENDPOINTS: {
    WS: '/ws',
    EXECUTE_COMMAND: '/execute-command',
    READ_FILE: '/read-file',
    HEALTH: '/health',
    CHAT: '/chat',
    SAVE_CHAT: '/save-chat',
    GET_CHATS: '/get-chats',
    DELETE_CHAT: '/delete-chat',
  },
} as const;

export const buildApiUrl = (endpoint: string): string => `${API_CONFIG.API_URL}${endpoint}`;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shadowide.mobile',
  appName: 'ShadowIDE',
  webDir: 'dist',
  server: {
    // In dev, point to the Vite dev server
    url: process.env.CAPACITOR_DEV ? 'http://localhost:3000' : undefined,
    cleartext: true,
  },
  plugins: {
    // Filesystem: use Documents directory as root
    Filesystem: {},
    // Preferences: use default namespace
    Preferences: {
      group: 'com.shadowide.prefs',
    },
    // SplashScreen: hide after app is ready
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1e1e1e',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1e1e1e',
  },
  android: {
    backgroundColor: '#1e1e1e',
    allowMixedContent: true,
  },
};

export default config;

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ── Platform modes ─────────────────────────────────────────────────────────
// npm run build:desktop  → mode = 'desktop'  (Electron)
// npm run build:mobile   → mode = 'mobile'   (Capacitor iOS/Android)
// npm run build:web      → mode = 'web'      (Browser / PWA)
// npm run build          → mode = 'production' (defaults to desktop)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isMobile  = mode === 'mobile';
  const isDesktop = mode === 'desktop' || mode === 'production';
  const isWeb     = mode === 'web';

  // Inject VITE_PLATFORM so runtime code can read it
  const platform = isMobile ? 'capacitor' : isDesktop ? 'electron' : 'web';

  return {
    plugins: [
      react({ fastRefresh: true }),
    ],

    // For Capacitor, base must be './' so assets resolve from the bundle root
    base: (isMobile || isDesktop) ? './' : '/',

    define: {
      // Available as import.meta.env.VITE_PLATFORM at runtime
      'import.meta.env.VITE_PLATFORM': JSON.stringify(platform),
      // API URL — override via .env.mobile / .env.desktop
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL ?? 'http://localhost:23816'
      ),
      'import.meta.env.VITE_WS_URL': JSON.stringify(
        env.VITE_WS_URL ?? 'ws://localhost:23816'
      ),
    },

    server: {
      port: parseInt(env.VITE_PORT || '3000', 10),
      strictPort: false,
      host: true,
      fs: { strict: false },
      proxy: {
        '/execute-command': { target: 'http://127.0.0.1:23816', changeOrigin: true, ws: true },
        '/read-file':        { target: 'http://127.0.0.1:23816', changeOrigin: true },
        '/ws':               { target: 'http://127.0.0.1:23816', changeOrigin: true, ws: true },
      },
    },

    optimizeDeps: {
      include: [
        'monaco-editor', 'react', 'react-dom', 'react-markdown',
        'remark-gfm', '@xterm/xterm', '@xterm/addon-fit',
        '@xterm/addon-web-links', 'zustand', 'uuid',
      ],
      // Exclude Electron and Capacitor from browser bundle
      exclude: ['electron', '@capacitor/core'],
      force: false,
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      target: isMobile ? 'es2020' : 'esnext',

      rollupOptions: {
        // On mobile, exclude Electron; on desktop, exclude Capacitor
        external: isMobile
          ? ['electron']
          : isDesktop
          ? ['@capacitor/core', '@capacitor/filesystem', '@capacitor/preferences', '@capacitor/browser']
          : [],

        output: {
          manualChunks(id) {
            if (id.includes('monaco-editor/esm/vs/language/json'))       return 'jsonWorker';
            if (id.includes('monaco-editor/esm/vs/language/css'))        return 'cssWorker';
            if (id.includes('monaco-editor/esm/vs/language/html'))       return 'htmlWorker';
            if (id.includes('monaco-editor/esm/vs/language/typescript')) return 'tsWorker';
            if (id.includes('monaco-editor/esm/vs/editor/editor.worker'))return 'editorWorker';
            if (id.includes('monaco-editor'))                             return 'monaco';
            if (id.includes('react-syntax-highlighter') || id.includes('highlight.js') || id.includes('refractor')) return 'syntax';
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('micromark') || id.includes('mdast')) return 'markdown';
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react';
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        // On mobile/web, stub out electron-only modules
        ...(isMobile || isWeb ? {
          'electron': path.resolve(process.cwd(), 'src/platform/stubs/electron.ts'),
        } : {}),
      },
    },
  };
});

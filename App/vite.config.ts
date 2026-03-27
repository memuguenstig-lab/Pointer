import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// API configuration from environment variables
const API_PORT = process.env.VITE_API_URL?.match(/:(\d+)$/)?.[1] || '23816'
const API_HOST = process.env.VITE_API_URL ? new URL(process.env.VITE_API_URL).host : 'http://127.0.0.1:23816'
const DEV_PORT = parseInt(process.env.VITE_DEV_SERVER_PORT || '3000', 10)

// Dynamic chunk strategy: Smart code splitting based on dependencies
function generateManualChunks(id: string) {
  // Monaco editor workers - separate heavy chunks
  if (id.includes('monaco-editor')) {
    if (id.includes('json.worker')) return 'monaco-json';
    if (id.includes('css.worker')) return 'monaco-css';
    if (id.includes('html.worker')) return 'monaco-html';
    if (id.includes('typescript') || id.includes('ts.worker')) return 'monaco-ts';
    if (id.includes('editor.worker')) return 'monaco-editor-core';
    return 'monaco-vendors';
  }

  // Node modules vendor splitting
  if (id.includes('node_modules')) {
    // React ecosystem
    if (/react|react-dom|react-markdown/.test(id)) return 'vendor-react';
    
    // UI/Editor libraries
    if (/xterm|@xterm/.test(id)) return 'vendor-terminal';
    if (/syntax-highlighter|highlight/.test(id)) return 'vendor-highlight';
    
    // Utilities
    if (/zustand|uuid|chalk|diff/.test(id)) return 'vendor-utils';
    
    // Discord/External integrations
    if (/discord/.test(id)) return 'vendor-discord';
    
    // Default fallback for other vendors
    return 'vendor-common';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:23816'),
    __DEV_PORT__: JSON.stringify(DEV_PORT),
  },
  server: {
    port: DEV_PORT,
    strictPort: false,
    host: true, // needed for Electron
    fs: {
      strict: false,
      allow: ['..']
    },
    proxy: {
      '/execute-command': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/read-file': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
      '/read-settings-files': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
      },
      '/save-settings-files': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  optimizeDeps: {
    include: ['monaco-editor'],
    exclude: ['electron']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'production' ? false : 'inline',
    rollupOptions: {
      output: {
        // Dynamic chunk splitting strategy
        manualChunks: generateManualChunks,
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return 'js/[name]-[hash].js';
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp|ico|woff2?|eot|ttf|otf/.test(ext)) {
            return `assets/[name]-[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name]-[hash].css`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      },
    },
    // Increase chunk size threshold for better caching
    chunkSizeWarningLimit: 1024,
    // Enable minification for production
    minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
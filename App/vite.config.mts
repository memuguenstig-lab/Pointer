import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Faster React refresh in dev
      fastRefresh: true,
    }),
  ],
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  server: {
    port: parseInt(process.env.VITE_PORT || '3000', 10),
    strictPort: false,
    host: true,
    fs: {
      strict: false,
      allow: ['..']
    },
    proxy: {
      '/execute-command': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/read-file': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://127.0.0.1:23816',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  optimizeDeps: {
    include: [
      'monaco-editor',
      'react',
      'react-dom',
      'react-markdown',
      'remark-gfm',
      '@xterm/xterm',
      '@xterm/addon-fit',
      '@xterm/addon-web-links',
      'zustand',
      'uuid',
    ],
    exclude: ['electron'],
    // Force pre-bundling on first run so subsequent starts are fast
    force: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // Increase chunk size warning limit (monaco is large by nature)
    chunkSizeWarningLimit: 2000,
    // Enable minification
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Monaco workers — each in own chunk
          if (id.includes('monaco-editor/esm/vs/language/json')) return 'jsonWorker';
          if (id.includes('monaco-editor/esm/vs/language/css')) return 'cssWorker';
          if (id.includes('monaco-editor/esm/vs/language/html')) return 'htmlWorker';
          if (id.includes('monaco-editor/esm/vs/language/typescript')) return 'tsWorker';
          if (id.includes('monaco-editor/esm/vs/editor/editor.worker')) return 'editorWorker';
          // Monaco core — separate from app code
          if (id.includes('monaco-editor')) return 'monaco';
          // Syntax highlighting — large, rarely changes
          if (id.includes('react-syntax-highlighter') || id.includes('highlight.js') || id.includes('refractor')) return 'syntax';
          // Markdown rendering
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('micromark') || id.includes('mdast')) return 'markdown';
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react';
          // Other vendor libs
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})

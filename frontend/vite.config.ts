import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }) as PluginOption,
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: 'http://127.0.0.1:8000',
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
        },
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        // КРИТИЧНО: убираем Domain и Secure в Set-Cookie — host-only cookie работает на любом хосте (localhost, 192.168.x.x).
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            const raw = proxyRes.headers['set-cookie'];
            if (raw) {
              const cookies = Array.isArray(raw) ? raw : [raw];
              proxyRes.headers['set-cookie'] = cookies.map((cookie: string) => {
                // Убираем Secure для dev (HTTP)
                let c = cookie.replace(/;\s*Secure/gi, '');
                // Убираем Domain если backend поставил (127.0.0.1) — host-only cookie работает на ЛЮБОМ хосте:
                // localhost, 192.168.x.x (телефон), 10.0.2.2 (эмулятор). НЕ добавляем Domain=localhost — ломает мобильный!
                c = c.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*;+/g, ';').replace(/;\s*$/, '');
                return c;
              });
            }
          });
        },
      },
      // Медіа-файли (аватарки, обкладинки книг) з бекенду — щоб img src працював з того ж origin (ПК і мобільний)
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }

          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }

          if (
            id.includes('node_modules/@tiptap/') ||
            id.includes('node_modules/prosemirror-')
          ) {
            return 'vendor-tiptap';
          }
        },
      },
    },
  },
})

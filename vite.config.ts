/**
 * Official Documentation:
 * - Vite Configuration Reference: https://vite.dev/config/
 * - Rolldown Code Splitting Options: https://rolldown.rs/reference/OutputOptions.codeSplitting
 * - vite-plugin-pwa Configuration: https://vite-pwa-org.netlify.app/guide/
 * - Tailwind CSS Vite Plugin: https://tailwindcss.com/docs/installation/using-vite
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        // Copy dist/index.html to dist/404.html so static hosts (e.g. GitHub Pages) serve the SPA on deep links
        name: 'generate-spa-404',
        closeBundle() {
          const indexHtml = path.resolve('dist/index.html');
          const notFoundHtml = path.resolve('dist/404.html');
          if (fs.existsSync(indexHtml)) {
            fs.copyFileSync(indexHtml, notFoundHtml);
          }
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'gawkyy-cat-64x64.png', 'gawkyy-cat-256x256.png', 'sql-wasm.wasm'],
        manifest: {
          id: '/',
          name: 'Gawkyy',
          short_name: 'Gawkyy',
          description: 'Gawkyy - A modern, web-native offline-first MS Access in the browser. Portable SQLite apps with dynamic TSX plugins, interactive query grids, spreadsheets, and reports.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Match all built assets emitted into dist/ (requires glob >= 14.0.2 when minimatch >= 11 is installed)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      // Allow the intact lucide-react chunk (~620 kB minified, ~160 kB gzipped) required by dynamic TSX plugins
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          // Split large vendor libraries into separate cacheable chunks without maxSize slicing.
          // Note: Do NOT set maxSize on lucide-react or general vendor groups—forcing Rolldown to
          // slice a single package across multiple chunks can introduce circular ES module imports
          // that evaluate before createLucideIcon is initialized (causing a blank-page runtime crash).
          // Prettier is already dynamically imported per-module in src/engine/formatter.ts and splits naturally.
          codeSplitting: {
            groups: [
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor-lucide', test: /node_modules[\\/]lucide-react[\\/]/ },
              { name: 'vendor-sucrase', test: /node_modules[\\/]sucrase[\\/]/ },
              { name: 'vendor-excel', test: /node_modules[\\/](read-excel-file|write-excel-file|fflate)[\\/]/ },
              { name: 'vendor-motion', test: /node_modules[\\/](motion|framer-motion)[\\/]/ },
              { name: 'vendor-monaco', test: /node_modules[\\/](@monaco-editor|monaco-editor)[\\/]/ },
              { name: 'vendor-sqljs', test: /node_modules[\\/]sql\.js[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

/**
 * Official Documentation:
 * - Vite Configuration Reference: https://vite.dev/config/
 * - Rolldown Code Splitting Options: https://rolldown.rs/reference/OutputOptions.codeSplitting
 * - vite-plugin-pwa Configuration: https://vite-pwa-org.netlify.app/guide/
 * - Workbox generateSW manifestTransforms: https://developer.chrome.com/docs/workbox/reference/workbox-build/#type-ManifestTransform
 * - Tailwind CSS Vite Plugin: https://tailwindcss.com/docs/installation/using-vite
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// Assets already injected into Workbox's additionalManifestEntries by vite-plugin-pwa
// (via includeAssets, manifest.icons, and manifest.webmanifest)
const INCLUDE_ASSETS = [
  'favicon.ico',
  'apple-touch-icon.png',
  'icon.svg',
  'gawkyy-cat-64x64.png',
  'gawkyy-cat-256x256.png',
  'sql-wasm.wasm',
];
const MANIFEST_ICON_ASSETS = [
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
];
const PRECACHE_EXTENSIONS = new Set(['.js', '.css', '.html', '.ico', '.png', '.svg', '.wasm']);
const MAX_CACHE_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Recursively collects built precache entries from dist/ using native Node.js fs/crypto.
 * Passing globPatterns: [] + manifestTransforms bypasses workbox-build's internal globSync()
 * call, avoiding "One of the glob patterns doesn't match any files" warnings caused by
 * glob/minimatch version mismatches across different local npm environments.
 */
function collectDistPrecacheEntries(distDir: string) {
  const alreadyIncludedByPwa = new Set([
    ...INCLUDE_ASSETS,
    ...MANIFEST_ICON_ASSETS,
    'manifest.webmanifest',
  ]);
  const entries: Array<{ url: string; revision: string | null; size: number }> = [];

  const walk = (currentDir: string) => {
    if (!fs.existsSync(currentDir)) return;
    for (const dirent of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name !== 'node_modules') {
          walk(fullPath);
        }
        continue;
      }
      const relUrl = path.relative(distDir, fullPath).split(path.sep).join('/');
      if (
        relUrl === 'sw.js' ||
        /^workbox-.*\.js$/.test(relUrl) ||
        alreadyIncludedByPwa.has(relUrl)
      ) {
        continue;
      }
      const ext = path.extname(dirent.name).toLowerCase();
      if (!PRECACHE_EXTENSIONS.has(ext)) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_CACHE_FILE_BYTES) {
        continue;
      }
      // Files inside assets/ carry Vite content hashes in their filenames so revision can be null
      const isHashedAsset = relUrl.startsWith('assets/');
      const revision = isHashedAsset
        ? null
        : crypto.createHash('md5').update(fs.readFileSync(fullPath)).digest('hex');

      entries.push({ url: relUrl, revision, size: stat.size });
    }
  };

  walk(distDir);
  // Sort deterministically so sw.js output is identical across operating systems and filesystems
  entries.sort((a, b) => a.url.localeCompare(b.url));
  return entries;
}

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
        includeAssets: INCLUDE_ASSETS,
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
          // Use an empty globPatterns array and populate precache entries via native Node fs/crypto
          // in manifestTransforms so workbox-build never emits globSync empty-match warnings
          globPatterns: [],
          maximumFileSizeToCacheInBytes: MAX_CACHE_FILE_BYTES,
          manifestTransforms: [
            async (manifestEntries) => {
              const distDir = path.resolve('dist');
              const seen = new Set(manifestEntries.map((entry) => entry.url));
              const scanned = collectDistPrecacheEntries(distDir).filter(
                (entry) => !seen.has(entry.url)
              );
              return {
                manifest: [...manifestEntries, ...scanned],
                warnings: [],
              };
            },
          ],
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

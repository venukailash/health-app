import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo from /health-app/; local dev and tests use /.
const base = process.env.GITHUB_ACTIONS ? '/health-app/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' keeps the new worker waiting so the app can choose when to
      // reload; useAppUpdate applies it automatically once the user is idle.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Health App — Meal & Macro Tracker',
        short_name: 'Health App',
        description: 'Track meals, recipes and macronutrients against your daily goals. Works offline.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The barcode decoder is ~475 KB and only iOS ever loads it, on the
        // first scan. Precaching it would make every install pay for a
        // feature most sessions never touch, so it is fetched on demand and
        // cached once used.
        globIgnores: ['**/barcode-decoder-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/barcode-decoder-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'barcode-decoder' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Stable name so the service worker can single it out.
          if (id.includes('@zxing')) return 'barcode-decoder'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/storage/**', 'src/state/**'],
    },
  },
})

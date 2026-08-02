/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Bug reports are useless without a version to pin them to, and hardcoding one
  // in a component guarantees it goes stale. Single source of truth: package.json.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        /**
         * The default glob omits fonts, so an offline launch fell back to Georgia
         * even after the faces were bundled — self-hosting them is only half the
         * fix. `woff2` only: Fontsource also emits legacy `.woff`, which no
         * browser we target will ever request (the @font-face src lists woff2
         * first), so precaching it would be ~200 KB of dead cache.
         */
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
      },
      manifest: {
        name: 'Electric Cats',
        short_name: 'Electric Cats',
        description: 'Humans are gone. Cats inherit the world — and the lightning. Power a feline civilisation from one kneading paw to the whole galaxy.',
        theme_color: '#f3ead4',
        background_color: '#f3ead4',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

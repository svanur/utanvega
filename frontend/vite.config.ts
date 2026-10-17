import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { PWA_MANIFEST_STATIC_FIELDS, PWA_MANIFEST_BRAND_FIELDS } from './pwaManifestFields';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@mui/lab', '@emotion/react', '@emotion/styled'],
          'vendor-leaflet': ['leaflet', 'react-leaflet', 'leaflet.markercluster', '@changey/react-leaflet-markercluster'],
          'vendor-charts': ['recharts'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // No includeAssets: this build-time manifest is dead in production (see
      // the comment below), and the files it used to list (favicon.ico,
      // mask-icon.svg) don't exist in frontend/public — there's nothing
      // real to precache beyond Workbox's own default glob patterns.
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'offline-tiles',
              expiration: {
                maxEntries: 10000,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'offline-tiles-dark',
              expiration: {
                maxEntries: 10000,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Hlaupadagskra.is',
        short_name: 'Hlaupadagskrá',
        description: 'Öll hlaup á einum stað',
        ...PWA_MANIFEST_STATIC_FIELDS,
        // This build-time manifest cannot vary per host (#1080's per-host
        // icons live in api/manifest.ts instead, which is what's actually
        // served in production — see vercel.json's unconditional rewrite);
        // picking `is` here just keeps this dead-in-production asset valid.
        ...PWA_MANIFEST_BRAND_FIELDS.is,
      }
    })
  ],
});

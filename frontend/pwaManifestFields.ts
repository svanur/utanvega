/**
 * Static PWA manifest fields — icons, colors, display mode, start_url, scope
 * and shortcuts — shared by two independent consumers so they cannot
 * silently diverge (#1043):
 *  - vite.config.ts's VitePWA `manifest` option, which generates the
 *    build-time dist/manifest.webmanifest served on every host.
 *  - frontend/api/manifest.ts, an edge function that serves the same
 *    manifest at runtime, templating only the locale-dependent identity
 *    fields (name/short_name/description/lang) on top of these (#1033).
 *
 * Deliberately framework-agnostic: no Node or Vite-only imports, since this
 * module is imported both from vite.config.ts (Node, build time) and from an
 * edge runtime (Request/Response only, no Node APIs).
 */

const PWA_ICONS = [
  {
    src: 'icons/icon-192.svg',
    sizes: '192x192',
    type: 'image/svg+xml',
  },
  {
    src: 'icons/icon-512.svg',
    sizes: '512x512',
    type: 'image/svg+xml',
  },
  {
    src: 'icons/icon-512.svg',
    sizes: '512x512',
    type: 'image/svg+xml',
    purpose: 'any maskable',
  },
];

const PWA_SHORTCUTS = [
  {
    name: 'Search Trails',
    short_name: 'Search',
    url: '/?search=true',
    icons: [{ src: 'icons/icon-192.svg', sizes: '192x192' }],
  },
  {
    name: 'Favorites',
    short_name: 'Favorites',
    url: '/?favorites=true',
    icons: [{ src: 'icons/icon-192.svg', sizes: '192x192' }],
  },
  {
    name: 'Random Trail',
    short_name: 'Random',
    url: '/?random=true',
    icons: [{ src: 'icons/icon-192.svg', sizes: '192x192' }],
  },
];

export const PWA_MANIFEST_STATIC_FIELDS = {
  theme_color: '#1976d2',
  background_color: '#f6f8fb',
  display: 'standalone' as const,
  start_url: '/',
  scope: '/',
  icons: PWA_ICONS,
  shortcuts: PWA_SHORTCUTS,
};

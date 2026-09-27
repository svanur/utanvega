export const config = { runtime: 'edge' };

import { requestHost, localeForHostname, type Locale } from './_site';

/**
 * Locale for this request, resolved from the host it actually arrived on —
 * mirrors resolveLocale() in api/og.ts, duplicated rather than imported since
 * og.ts's copy is a private (non-exported) helper local to that file.
 */
function resolveLocale(request: Request): Locale {
  const host = requestHost(request);
  if (!host) return 'is';
  return localeForHostname(host.split(':')[0]);
}

/** name/short_name/description copy, per locale. */
const IDENTITY: Record<Locale, { name: string; short_name: string; description: string }> = {
  is: {
    name: 'Hlaupadagskra.is',
    short_name: 'Hlaupadagskrá',
    description: 'Öll hlaup á einum stað',
  },
  en: {
    name: '360Runs',
    short_name: '360Runs',
    description: 'All trail races in one place',
  },
};

/**
 * Served at /manifest.webmanifest via a rewrite in vercel.json.
 *
 * An edge function rather than the static dist/manifest.webmanifest VitePWA
 * emits at build time, because the installable-app identity differs per host
 * (#1033): 360runs.com installs as "360Runs", every other host — including
 * previews with no HOST_LOCALES entry — keeps the existing "Hlaupadagskra.is"
 * identity. The icons/colors/shortcuts below are copied verbatim from the
 * manifest object in vite.config.ts, which remains the source of truth for
 * those static fields; only the locale-dependent identity fields are templated.
 */
export default function handler(request: Request) {
  const locale = resolveLocale(request);
  const { name, short_name, description } = IDENTITY[locale];

  const manifest = {
    name,
    short_name,
    description,
    lang: locale,
    theme_color: '#1976d2',
    background_color: '#f6f8fb',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
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
    ],
    shortcuts: [
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
    ],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}

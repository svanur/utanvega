/**
 * Static PWA manifest fields — icons, colors, display mode, start_url, scope
 * and shortcuts — shared by two independent consumers so they cannot
 * silently diverge (#1043):
 *  - vite.config.ts's VitePWA `manifest` option, which generates the
 *    build-time dist/manifest.webmanifest served on every host.
 *  - frontend/api/manifest.ts, an edge function that serves the same
 *    manifest at runtime, templating only the locale-dependent identity
 *    fields (name/short_name/description/lang) on top of these (#1033) — and,
 *    as of #1080, `icons`/`shortcuts` too, since those now carry per-host
 *    brand artwork rather than the shared placeholder mountain SVGs.
 *
 * Deliberately framework-agnostic: no Node or Vite-only imports, since this
 * module is imported both from vite.config.ts (Node, build time) and from an
 * edge runtime (Request/Response only, no Node APIs). `Locale` is a
 * type-only import from api/_site.ts — erased at compile time, so it adds
 * no runtime dependency for either consumer.
 */

import type { Locale } from './api/_site';

type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

type ManifestShortcut = {
  name: string;
  short_name: string;
  url: string;
  icons: ManifestIcon[];
};

/**
 * Icon/shortcut-icon file stems per host brand, keyed the same way
 * manifest.ts's IDENTITY is. Each brand's 192/512 PNGs are downscaled from
 * the real lockup artwork in design-assets/logos/ (#1080), replacing the
 * placeholder mountain SVGs every host used to share. The 512 PNG is reused
 * for both the plain `any` entry and the `any maskable` one — its visible
 * ring content was padded in at generation time to sit inside the ~80%
 * maskable-safe center zone, so no separate maskable-only asset is needed.
 */
const ICON_STEMS: Record<Locale, { icon192: string; icon512: string }> = {
  is: {
    icon192: 'icons/hlaupadagskra-icon-192.png',
    icon512: 'icons/hlaupadagskra-icon-512.png',
  },
  en: {
    icon192: 'icons/360runs-icon-192.png',
    icon512: 'icons/360runs-icon-512.png',
  },
};

function iconsFor(locale: Locale): ManifestIcon[] {
  const { icon192, icon512 } = ICON_STEMS[locale];
  return [
    { src: icon192, sizes: '192x192', type: 'image/png' },
    { src: icon512, sizes: '512x512', type: 'image/png' },
    { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ];
}

function shortcutsFor(locale: Locale): ManifestShortcut[] {
  const { icon192 } = ICON_STEMS[locale];
  return [
    {
      name: 'Search Trails',
      short_name: 'Search',
      url: '/?search=true',
      icons: [{ src: icon192, sizes: '192x192' }],
    },
    {
      name: 'Favorites',
      short_name: 'Favorites',
      url: '/?favorites=true',
      icons: [{ src: icon192, sizes: '192x192' }],
    },
    {
      name: 'Random Trail',
      short_name: 'Random',
      url: '/?random=true',
      icons: [{ src: icon192, sizes: '192x192' }],
    },
  ];
}

/** Per-host `icons`/`shortcuts`, for manifest.ts to template alongside its own per-locale IDENTITY. */
export const PWA_MANIFEST_BRAND_FIELDS: Record<Locale, { icons: ManifestIcon[]; shortcuts: ManifestShortcut[] }> = {
  is: { icons: iconsFor('is'), shortcuts: shortcutsFor('is') },
  en: { icons: iconsFor('en'), shortcuts: shortcutsFor('en') },
};

/**
 * Fields that genuinely don't vary by host — colors, display mode,
 * start_url, scope. `icons`/`shortcuts` moved out to PWA_MANIFEST_BRAND_FIELDS
 * above (#1080); vite.config.ts's build-time manifest, which cannot vary per
 * host, picks one brand's icons/shortcuts explicitly instead.
 */
export const PWA_MANIFEST_STATIC_FIELDS = {
  theme_color: '#1976d2',
  background_color: '#f6f8fb',
  display: 'standalone' as const,
  start_url: '/',
  scope: '/',
};

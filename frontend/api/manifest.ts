export const config = { runtime: 'edge' };

import { resolveLocale, type Locale } from './_site';
import { PWA_MANIFEST_STATIC_FIELDS } from '../pwaManifestFields';

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
 * identity. The icons/colors/shortcuts come from ../pwaManifestFields.ts, the
 * single shared source of truth also used by vite.config.ts's VitePWA
 * `manifest` option (#1043); only the locale-dependent identity fields below
 * are templated.
 */
export default function handler(request: Request) {
  const locale = resolveLocale(request);
  const { name, short_name, description } = IDENTITY[locale];

  const manifest = {
    name,
    short_name,
    description,
    lang: locale,
    ...PWA_MANIFEST_STATIC_FIELDS,
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}

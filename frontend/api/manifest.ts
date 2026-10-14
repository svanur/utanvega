export const config = { runtime: 'edge' };

import { resolveLocale, BRAND_NAME, TAGLINE, type Locale } from './_site';
import { PWA_MANIFEST_STATIC_FIELDS, PWA_MANIFEST_BRAND_FIELDS } from '../pwaManifestFields';

/**
 * name/short_name/description copy, per locale. `name` derives from
 * BRAND_NAME rather than holding its own literal, since it is the same
 * string (#1105) — short_name stays hand-written here. `description` derives
 * from TAGLINE for `en` the same way (#1198); the `is` side keeps its literal
 * for now since it was already correct and untouched by that fix.
 */
const IDENTITY: Record<Locale, { name: string; short_name: string; description: string }> = {
  is: {
    name: BRAND_NAME.is,
    short_name: 'Hlaupadagskrá',
    description: 'Öll hlaup á einum stað',
  },
  en: {
    name: BRAND_NAME.en,
    short_name: '360Runs',
    description: TAGLINE.en,
  },
};

/**
 * Served at /manifest.webmanifest via a rewrite in vercel.json.
 *
 * An edge function rather than the static dist/manifest.webmanifest VitePWA
 * emits at build time, because the installable-app identity differs per host
 * (#1033): 360runs.com installs as "360Runs", every other host — including
 * previews with no HOST_LOCALES entry — keeps the existing "Hlaupadagskra.is"
 * identity. As of #1080 the installed icon differs per host too — each
 * brand's own PNG artwork rather than a shared placeholder — so `icons`/
 * `shortcuts` are templated from PWA_MANIFEST_BRAND_FIELDS alongside the
 * identity fields below; only the genuinely host-agnostic colors/display/
 * start_url/scope in PWA_MANIFEST_STATIC_FIELDS stay shared.
 */
export default function handler(request: Request) {
  const locale = resolveLocale(request);
  const { name, short_name, description } = IDENTITY[locale];
  const { icons, shortcuts } = PWA_MANIFEST_BRAND_FIELDS[locale];

  const manifest = {
    name,
    short_name,
    description,
    lang: locale,
    ...PWA_MANIFEST_STATIC_FIELDS,
    icons,
    shortcuts,
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}

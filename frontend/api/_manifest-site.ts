// Private copy of the handful of _site.ts exports manifest.ts needs
// (resolveLocale, BRAND_NAME, TAGLINE, Locale), scoped to manifest.ts alone —
// nothing else imports this file.
//
// This duplicates _site.ts rather than importing it, as a narrow, deliberate
// exception to this repo's usual dedup stance: Vercel's Edge Function bundler
// builds a shared chunk for every function that imports _site.ts, and when it
// checks edge-runtime module compatibility for that chunk, it unions the
// dependencies of every function touching it — so og-image.ts's @vercel/og
// import (which legitimately needs Node-only APIs there) got misattributed to
// manifest.ts too, which has no such dependency, failing manifest's deploy
// with "referencing unsupported modules: @vercel". Giving manifest.ts its own
// import graph, disconnected from og-image.ts's, keeps it out of that shared
// chunk. See PR #1701 for the Vercel-side investigation.
//
// If this ever needs to grow beyond these four exports, prefer re-deriving
// from _site.ts's source rather than copy-pasting more of it by hand — the
// point is to stay disconnected at the Vercel bundler's chunk-graph level,
// not to fork _site.ts's logic.

export type Locale = 'is' | 'en';

/** Host → default UI locale. Keep in sync by hand with _site.ts's HOST_LOCALES. */
const HOST_LOCALES: Record<string, Locale> = {
  'hlaupadagskra.is': 'is',
  '360runs.com': 'en',
};

/** Keep in sync by hand with _site.ts's BRAND_NAME. */
export const BRAND_NAME: Record<Locale, string> = {
  is: 'Hlaupadagskra.is',
  en: '360Runs',
};

/** Keep in sync by hand with _site.ts's TAGLINE. */
export const TAGLINE: Record<Locale, string> = {
  is: 'Öll hlaup á einum stað',
  en: 'All running events in one place',
};

const DEFAULT_LOCALE: Locale = 'is';

function matchesHostSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function requestHost(request: Request): string | null {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) return forwardedHost;
  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}

function localeForHostname(hostname: string): Locale {
  const lower = hostname.toLowerCase();
  const match = Object.entries(HOST_LOCALES).find(([suffix]) => matchesHostSuffix(lower, suffix));
  return match ? match[1] : DEFAULT_LOCALE;
}

/** Keep in sync by hand with _site.ts's resolveLocale. */
export function resolveLocale(request: Request): Locale {
  const host = requestHost(request);
  if (!host) return 'is';
  return localeForHostname(host.split(':')[0]);
}

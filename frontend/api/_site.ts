// Shared helpers for the edge functions in this directory.
// Vercel treats files prefixed with "_" as modules, not routes.
//
// HOST_LOCALES below is also imported by frontend/i18n/i18n.ts, which runs in
// the browser, not the edge runtime — so `process` is guarded with a
// `typeof` check rather than referenced directly, to avoid a ReferenceError
// on that side of the import.
declare const process: { env: Record<string, string | undefined> } | undefined;

// Explicit override, normalised — env values are written with a trailing slash
// often enough that admin/src strips one too. Set this only to force one
// canonical host when the site answers on several (custom domain + *.vercel.app).
const CONFIGURED_SITE_URL = (
  (typeof process !== 'undefined' ? process.env.SITE_URL : undefined) || ''
).replace(/\/+$/, '');

const FALLBACK_SITE_URL = 'https://www.hlaupadagskra.is';

export type Locale = 'is' | 'en';

/**
 * Host → default UI locale, keyed by the apex domain of every production
 * host this site answers on. Single source of truth: og.ts locale-aware copy
 * (#1032) and the per-host PWA manifest (#1033) import this, and
 * isIndexableHost() below reuses its keys as the production allow-list
 * instead of duplicating the domain list.
 */
export const HOST_LOCALES: Record<string, Locale> = {
  'hlaupadagskra.is': 'is',
  '360runs.com': 'en',
};

/** Locale for a fresh visitor on a host with no entry in HOST_LOCALES (localhost, preview deploys). */
const DEFAULT_LOCALE: Locale = 'is';

/** Whether `hostname` is `suffix` itself or a subdomain of it (e.g. "www."). */
function matchesHostSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** The host the client actually asked for, or null if it cannot be determined. */
export function requestHost(request: Request): string | null {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) return forwardedHost;
  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}

/**
 * Origin to build canonical URLs from.
 *
 * Prefers the host the crawler actually requested, so canonicals are correct on
 * production, staging and preview deploys with no env configuration — a
 * hardcoded default silently points every canonical at the wrong domain the
 * moment it goes stale.
 */
export function siteOrigin(request: Request): string {
  if (CONFIGURED_SITE_URL) return CONFIGURED_SITE_URL;

  const host = requestHost(request);
  if (!host) return FALLBACK_SITE_URL;

  // Vercel terminates TLS at the edge; trust the forwarded scheme when present.
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/**
 * Whether this deployment should be indexed. Staging and preview deploys serve
 * the same content as production, so letting them into the index would compete
 * with the real site for its own keywords.
 */
export function isIndexableHost(request: Request): boolean {
  const host = requestHost(request);
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return Object.keys(HOST_LOCALES).some((suffix) => matchesHostSuffix(hostname, suffix));
}

/**
 * Default locale for a hostname, used only to seed a first-time visitor who
 * has no stored `utanvega-lang` preference yet — an existing preference
 * always wins over this on return visits.
 */
export function localeForHostname(hostname: string): Locale {
  const lower = hostname.toLowerCase();
  const match = Object.entries(HOST_LOCALES).find(([suffix]) => matchesHostSuffix(lower, suffix));
  return match ? match[1] : DEFAULT_LOCALE;
}

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

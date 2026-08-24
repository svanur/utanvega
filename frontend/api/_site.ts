// Shared helpers for the edge functions in this directory.
// Vercel treats files prefixed with "_" as modules, not routes.

declare const process: { env: Record<string, string | undefined> };

// Explicit override, normalised — env values are written with a trailing slash
// often enough that admin/src strips one too. Set this only to force one
// canonical host when the site answers on several (custom domain + *.vercel.app).
const CONFIGURED_SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const FALLBACK_SITE_URL = 'https://www.hlaupadagskra.is';

/** Hosts whose content is the real site; anything else is a preview or staging. */
const PRODUCTION_HOST_SUFFIX = 'hlaupadagskra.is';

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
  return hostname === PRODUCTION_HOST_SUFFIX || hostname.endsWith(`.${PRODUCTION_HOST_SUFFIX}`);
}

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

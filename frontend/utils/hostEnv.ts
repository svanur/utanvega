import { HOST_LOCALES } from '../api/_site';

// Same anchoring rule as the local helper in Layout.tsx (matchesHostSuffix)
// and the private one in api/_site.ts — deduplicating all three is tracked
// separately in #1062. Kept as its own copy here, rather than imported from
// Layout.tsx, so isStagingHost stays importable in tests without pulling in
// Layout's full MUI/router/i18n dependency tree (which touches `localStorage`
// at module scope via LanguageToggle -> i18n.ts, unsafe in vitest's Node env).
function matchesHostSuffix(hostname: string, suffix: string): boolean {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/**
 * Whether `hostname` should show the staging banner: false for any host this
 * site legitimately answers on (the per-domain locale list in _site.ts,
 * shared with the edge functions' production allow-list), true otherwise —
 * *.vercel.app previews, localhost, and lookalike hosts all stay staging.
 */
export function isStagingHost(hostname: string): boolean {
    return !Object.keys(HOST_LOCALES).some((suffix) => matchesHostSuffix(hostname, suffix));
}

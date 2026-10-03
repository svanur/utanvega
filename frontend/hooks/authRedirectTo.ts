// #1147: extracted out of LoginModal.tsx so the derivation is unit-testable independently of the
// module-load call there — mirroring i18n.ts's brandNameForHostname/initialLangForHostname
// extraction (#1133/#1141). Lives here rather than in LoginModal.tsx itself to avoid a
// react-refresh/only-export-components lint warning (component files should only export
// components).

/**
 * OAuth/magic-link redirect target — `envValue` (trimmed) wins if non-empty, otherwise falls
 * through to `origin`.
 */
export function authRedirectToFor(envValue: string | undefined, origin: string): string {
    return envValue?.trim() || origin;
}

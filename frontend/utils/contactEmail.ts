import { localeForHostname } from '../api/_site';

// Split out of ContactPage.tsx: that file also exports the ContactPage component, and a
// component file that also exports a plain pure function trips
// react-refresh/only-export-components (same pattern as getActivityIcon.tsx and
// useAuthContext.ts elsewhere in this repo). This file holds only the plain function, so
// ContactPage.test.tsx (#1067) can import and unit-test it directly as a plain function call —
// no need to mock react, react-i18next, @mui/material, or Layout the way the pre-#1067 test did.

// Split to avoid plain-text harvesting
const USER = 'oskar';
const DOMAIN = 'hlaupadagskra';
const TLD = 'is';
const EN_DOMAIN = '360runs';
const EN_TLD = 'com';

/**
 * Support email address for `hostname`: the 360runs.com address on the
 * English production host, the hlaupadagskra.is address everywhere else —
 * same host→locale resolution as usePageTitle's siteForHostname.
 */
export function emailForHostname(hostname: string): string {
    return localeForHostname(hostname) === 'en'
        ? `${USER}@${EN_DOMAIN}.${EN_TLD}`
        : `${USER}@${DOMAIN}.${TLD}`;
}

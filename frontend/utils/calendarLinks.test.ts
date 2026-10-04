import { describe, it, expect, afterEach, vi } from 'vitest';
import { googleCalendarUrl, outlookCalendarUrl, generateIcs } from './calendarLinks';

// #1065: appendTagline()/generateIcs() read window.location.hostname lazily, inside the
// function body, rather than at module scope — same reason documented in usePageTitle.ts:16-19
// (keeps this module importable under vitest's Node environment, which has no `window` global).
// Stubbing `window` per-test (same pattern as ContactPage.test.tsx) lets us drive that branch
// without a real browser.
function stubHostname(hostname: string): void {
    vi.stubGlobal('window', { location: { hostname } });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

const baseEvent = {
    title: 'Esjan Hringur',
    date: '2026-06-01',
    location: 'Esjan',
};

describe('calendarLinks host-aware branding (#1065)', () => {
    it.each(['localhost', 'hlaupadagskra.is', 'www.hlaupadagskra.is'])(
        'keeps the Icelandic brand unchanged on %s',
        (hostname) => {
            stubHostname(hostname);
            const ics = generateIcs(baseEvent);
            expect(ics).toContain('PRODID:-//Hlaupadagskra.is//Events//IS');
            expect(ics).toContain('@hlaupadagskra.is');
            expect(ics).toContain('https://www.hlaupadagskra.is');
            expect(ics).toContain('Öll hlaup á einum stað');
            expect(ics).not.toContain('360runs.com');
            expect(ics).not.toContain('360Runs');
        }
    );

    it.each(['360runs.com', 'www.360runs.com'])(
        'switches to the 360Runs brand on %s',
        (hostname) => {
            stubHostname(hostname);
            const ics = generateIcs(baseEvent);
            expect(ics).toContain('PRODID:-//360Runs//Events//IS');
            expect(ics).toContain('@360runs.com');
            expect(ics).toContain('https://www.360runs.com');
            expect(ics).toContain('All running events in one place');
            expect(ics).not.toContain('hlaupadagskra.is');
            expect(ics).not.toContain('Hlaupadagskra.is');
        }
    );

    // Lookalike host: contains "360runs.com" but is not a true (sub)domain of it, so it must
    // keep the Icelandic brand — same edge case as usePageTitle.test.ts/ContactPage.test.tsx.
    it('falls back to the Icelandic brand on a lookalike host', () => {
        stubHostname('evil360runs.com');
        const ics = generateIcs(baseEvent);
        expect(ics).toContain('PRODID:-//Hlaupadagskra.is//Events//IS');
        expect(ics).toContain('@hlaupadagskra.is');
    });

    it('carries the host-aware tagline into googleCalendarUrl/outlookCalendarUrl', () => {
        stubHostname('360runs.com');
        const google = googleCalendarUrl(baseEvent);
        const outlook = outlookCalendarUrl(baseEvent);
        // URLSearchParams encodes spaces as '+', which decodeURIComponent alone
        // does not turn back into ' ' — swap '+' for '%20' first so the decoded
        // string matches the literal tagline wording, not just its %-escaped form.
        const decodeQuery = (url: string): string => decodeURIComponent(url.replace(/\+/g, '%20'));
        expect(decodeQuery(google)).toContain('https://www.360runs.com');
        expect(decodeQuery(outlook)).toContain('https://www.360runs.com');
        expect(decodeQuery(google)).toContain('All running events in one place');
        expect(decodeQuery(outlook)).toContain('All running events in one place');
        expect(decodeQuery(google)).not.toContain('hlaupadagskra.is');
        expect(decodeQuery(outlook)).not.toContain('hlaupadagskra.is');
    });
});

/**
 * Utilities for generating "Add to Calendar" links and ICS downloads.
 */

import { localeForHostname, TAGLINE } from '../api/_site';

export interface CalendarEventInfo {
    title: string;
    date: string;      // YYYY-MM-DD (start)
    endDate?: string;  // YYYY-MM-DD (inclusive end for multi-day events)
    location?: string;
    description?: string;
    url?: string;
}

// Composed from the shared TAGLINE constant (api/_site.ts) rather than each
// holding its own independent literal, so the English wording can't drift
// from the tagline used by og-image.ts/manifest.ts again (#1198).
const SITE_TAGLINE_IS = `https://www.hlaupadagskra.is – ${TAGLINE.is}`;
const SITE_TAGLINE_EN = `https://www.360runs.com – ${TAGLINE.en}`;

const UID_DOMAIN_IS = 'hlaupadagskra.is';
const UID_DOMAIN_EN = '360runs.com';

// Same brand strings siteForHostname (usePageTitle.ts) maps "en" to — kept as a
// local literal rather than calling siteForHostname so localeForHostname is
// resolved exactly once per brandForHostname invocation, not once here and
// again inside siteForHostname (#1082).
const PRODID_BRAND_IS = 'Hlaupadagskra.is';
const PRODID_BRAND_EN = '360Runs';

/**
 * Host-aware tagline / UID domain / PRODID brand for `hostname`, all derived
 * from a single localeForHostname(hostname) check (api/_site.ts) (#1082).
 */
function brandForHostname(hostname: string): { tagline: string; uidDomain: string; prodIdBrand: string } {
    const isEnglish = localeForHostname(hostname) === 'en';
    return {
        tagline: isEnglish ? SITE_TAGLINE_EN : SITE_TAGLINE_IS,
        uidDomain: isEnglish ? UID_DOMAIN_EN : UID_DOMAIN_IS,
        prodIdBrand: isEnglish ? PRODID_BRAND_EN : PRODID_BRAND_IS,
    };
}

function appendTagline(description?: string): string {
    // Read lazily, inside the function, rather than as a module-scope constant:
    // keeps this module importable (for brandForHostname's own unit test) in
    // vitest's Node environment, which has no `window` global — same reason
    // documented in usePageTitle.ts:16-19.
    const { tagline } = brandForHostname(window.location.hostname);
    return description ? `${description}\n\n${tagline}` : tagline;
}

/** Compute the next day from a YYYY-MM-DD string using pure UTC math. */
function nextDayCompact(yyyymmdd: string): string {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const ny = next.getUTCFullYear();
    const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
    const nd = String(next.getUTCDate()).padStart(2, '0');
    return `${ny}${nm}${nd}`;
}

/**
 * Generate a Google Calendar "Add Event" URL.
 */
export function googleCalendarUrl(event: CalendarEventInfo): string {
    // Google uses all-day format: YYYYMMDD/YYYYMMDD (end is exclusive)
    const start = event.date.replace(/-/g, '');
    const end = nextDayCompact(event.endDate ?? event.date);

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${start}/${end}`,
    });
    if (event.location) params.set('location', event.location);
    params.set('details', appendTagline(event.description));

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate an Outlook.com "Add Event" URL.
 */
export function outlookCalendarUrl(event: CalendarEventInfo): string {
    const endCompact = nextDayCompact(event.endDate ?? event.date);
    const enddt = `${endCompact.slice(0, 4)}-${endCompact.slice(4, 6)}-${endCompact.slice(6, 8)}`;
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: event.title,
        startdt: event.date,
        enddt,
        allday: 'true',
    });
    if (event.location) params.set('location', event.location);
    params.set('body', appendTagline(event.description));

    return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * Generate an ICS file content string for a single event.
 */
export function generateIcs(event: CalendarEventInfo): string {
    const start = event.date.replace(/-/g, '');
    const end = nextDayCompact(event.endDate ?? event.date);

    const { uidDomain, prodIdBrand } = brandForHostname(window.location.hostname);
    const uid = `${event.title.replace(/\s/g, '-').toLowerCase()}-${event.date}@${uidDomain}`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//${prodIdBrand}//Events//IS`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escapeIcs(event.title)}`,
    ];
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push(`DESCRIPTION:${escapeIcs(appendTagline(event.description))}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
}

/**
 * Download an ICS file for a single event.
 */
export function downloadIcs(event: CalendarEventInfo): void {
    const ics = generateIcs(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeIcs(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

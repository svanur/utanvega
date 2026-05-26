/**
 * Utilities for generating "Add to Calendar" links and ICS downloads.
 */

export interface CalendarEventInfo {
    title: string;
    date: string; // YYYY-MM-DD
    location?: string;
    description?: string;
    url?: string;
}

/**
 * Generate a Google Calendar "Add Event" URL.
 */
export function googleCalendarUrl(event: CalendarEventInfo): string {
    // Google uses all-day format: YYYYMMDD/YYYYMMDD (end is exclusive)
    const start = event.date.replace(/-/g, '');
    const endDate = new Date(event.date + 'T00:00:00');
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().slice(0, 10).replace(/-/g, '');

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${start}/${end}`,
    });
    if (event.location) params.set('location', event.location);
    if (event.description) params.set('details', event.description);

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate an Outlook.com "Add Event" URL.
 */
export function outlookCalendarUrl(event: CalendarEventInfo): string {
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: event.title,
        startdt: event.date,
        enddt: event.date,
        allday: 'true',
    });
    if (event.location) params.set('location', event.location);
    if (event.description) params.set('body', event.description);

    return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * Generate an ICS file content string for a single event.
 */
export function generateIcs(event: CalendarEventInfo): string {
    const start = event.date.replace(/-/g, '');
    const endDate = new Date(event.date + 'T00:00:00');
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString().slice(0, 10).replace(/-/g, '');

    const uid = `${event.title.replace(/\s/g, '-').toLowerCase()}-${event.date}@hlaupadagskra.is`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hlaupadagskra.is//Events//IS',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escapeIcs(event.title)}`,
    ];
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
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
    URL.revokeObjectURL(url);
}

function escapeIcs(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

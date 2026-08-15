import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventCalendar, type CalendarDay } from './useEvents';

const EXCLUDED_TYPES = ['Advertisement'];
const MAX_PER_DAY = 4;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function getDateWindow(): { from: string; to: string; days: Date[] } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Friday → also show the weekend (Sat + Sun), otherwise today + tomorrow
    const extraDays = today.getDay() === 5 ? 2 : 1;

    const to = new Date(today);
    to.setDate(today.getDate() + extraDays);

    const days: Date[] = [];
    for (let d = new Date(today); d <= to; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
    }

    return { from: toDateStr(today), to: toDateStr(to), days };
}

export interface BannerDay {
    date: Date;
    label: string;
    events: {
        name: string;
        nameEn: string | null;
        slug: string;
        locationName: string | null;
        effectiveCancelled: boolean;
        dateRange: string | null;
    }[];
    overflow: number;
}

const IS_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];

function fmtDayMonth(dateStr: string, locale: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    if (locale === 'is') {
        return `${d.getDate()}. ${IS_MONTHS[d.getMonth()]}`;
    }
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function buildBannerDays(
    calendarDays: CalendarDay[],
    windowDays: Date[],
    t: ReturnType<typeof useTranslation>['t'],
    locale: string,
): BannerDay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byDate = new Map(calendarDays.map(d => [d.date, d]));

    // Collect all events across the window, de-duplicating multi-day events by slug.
    // First pass: find which slugs appear on multiple days so we can build a date range.
    const slugDates = new Map<string, { first: string; last: string }>();
    for (const windowDay of windowDays) {
        const dateStr = toDateStr(windowDay);
        const day = byDate.get(dateStr);
        for (const ev of day?.events ?? []) {
            if (EXCLUDED_TYPES.includes(ev.type)) continue;
            const existing = slugDates.get(ev.slug);
            if (!existing) {
                slugDates.set(ev.slug, { first: dateStr, last: ev.endDate ?? dateStr });
            }
        }
    }

    // Track which slugs have already been emitted so multi-day events appear only once.
    const emittedSlugs = new Set<string>();

    return windowDays
        .map(date => {
            const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
            let label: string;
            if (diffDays === 0) label = t('eventDayBanner.today');
            else if (diffDays === 1) label = t('eventDayBanner.tomorrow');
            else label = t(`eventDayBanner.${DAY_KEYS[date.getDay()]}`);

            const dateStr = toDateStr(date);
            const day = byDate.get(dateStr);
            const filtered = (day?.events ?? []).filter(e => !EXCLUDED_TYPES.includes(e.type));

            const visible: BannerDay['events'] = [];
            for (const ev of filtered) {
                if (emittedSlugs.has(ev.slug)) continue;
                emittedSlugs.add(ev.slug);
                const range = slugDates.get(ev.slug)!;
                const isMultiDay = range.last > range.first;
                visible.push({
                    name: ev.name,
                    nameEn: ev.nameEn,
                    slug: ev.slug,
                    locationName: ev.locationName,
                    effectiveCancelled: ev.effectiveCancelled,
                    dateRange: isMultiDay ? `${fmtDayMonth(range.first, locale)} – ${fmtDayMonth(range.last, locale)}` : null,
                });
                if (visible.length >= MAX_PER_DAY) break;
            }

            const overflow = Math.max(0, filtered.filter(e => !emittedSlugs.has(e.slug) || visible.some(v => v.slug === e.slug)).length - visible.length);
            return { date, label, events: visible, overflow };
        })
        .filter(d => d.events.length > 0 || d.overflow > 0);
}

export function useEventDayBanner(): { days: BannerDay[]; loading: boolean } {
    const { t, i18n } = useTranslation();
    const { from, to, days: windowDays } = useMemo(() => getDateWindow(), []);
    const { days: calendarDays, loading } = useEventCalendar(from, to);

    const days = useMemo(
        () => buildBannerDays(calendarDays, windowDays, t, i18n.language),
        [calendarDays, windowDays, t, i18n.language],
    );

    return { days, loading };
}

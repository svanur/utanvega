import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventCalendar, type CalendarDay } from './useEvents';

const INCLUDED_TYPES = ['Race', 'Series'];
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
    events: { name: string; slug: string; locationName: string | null }[];
    overflow: number;
}

function buildBannerDays(
    calendarDays: CalendarDay[],
    windowDays: Date[],
    t: (key: string, opts?: object) => string,
): BannerDay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byDate = new Map(calendarDays.map(d => [d.date, d]));

    return windowDays
        .map(date => {
            const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
            let label: string;
            if (diffDays === 0) label = t('eventDayBanner.today');
            else if (diffDays === 1) label = t('eventDayBanner.tomorrow');
            else label = t(`eventDayBanner.${DAY_KEYS[date.getDay()]}`);

            const dateStr = toDateStr(date);
            const day = byDate.get(dateStr);
            const filtered = (day?.events ?? []).filter(e => INCLUDED_TYPES.includes(e.type));
            const visible = filtered.slice(0, MAX_PER_DAY);
            const overflow = Math.max(0, filtered.length - MAX_PER_DAY);
            return { date, label, events: visible, overflow };
        })
        .filter(d => d.events.length > 0 || d.overflow > 0);
}

export function useEventDayBanner(): { days: BannerDay[]; loading: boolean } {
    const { t } = useTranslation();
    const { from, to, days: windowDays } = useMemo(() => getDateWindow(), []);
    const { days: calendarDays, loading } = useEventCalendar(from, to);

    const days = useMemo(
        () => buildBannerDays(calendarDays, windowDays, t),
        [calendarDays, windowDays, t],
    );

    return { days, loading };
}

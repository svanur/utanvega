import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HERO_THEMES, type HeroTheme } from '../data/heroThemes';

type HolidayMap = Record<string, { date: string; name: string }[]>;

async function fetchHolidays(): Promise<HolidayMap> {
    const res = await fetch('/data/is-holidays.json');
    if (!res.ok) throw new Error('Failed to load holidays');
    return res.json() as Promise<HolidayMap>;
}

function resolveHolidayDate(theme: HeroTheme, holidays: HolidayMap | undefined): Date | null {
    if (!theme.holidayKey || !holidays) return null;
    const year = new Date().getFullYear();
    const entries = holidays[String(year)] ?? [];
    const match = entries.find(h => h.name === theme.holidayKey);
    return match ? new Date(match.date) : null;
}

function daysUntilRaceDay(theme: HeroTheme, now: Date): number | null {
    if (!theme.recurring) return null;
    const { month, day } = theme.recurring;
    const raceDay = new Date(now.getFullYear(), month - 1, day);
    const diffMs = raceDay.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isThemeActive(theme: HeroTheme, now: Date, holidays: HolidayMap | undefined): boolean {
    if (theme.holidayKey) {
        const holidayDate = resolveHolidayDate(theme, holidays);
        if (!holidayDate) return false;
        const daysBefore = theme.holidayDaysBefore ?? 0;
        const daysAfter = theme.holidayDaysAfter ?? 0;
        const from = new Date(holidayDate);
        from.setDate(from.getDate() - daysBefore);
        const to = new Date(holidayDate);
        to.setDate(to.getDate() + daysAfter);
        to.setHours(23, 59, 59, 999);
        return now >= from && now <= to;
    }

    if (theme.oneOff) {
        const from = new Date(theme.oneOff.from);
        const to = new Date(theme.oneOff.to);
        to.setHours(23, 59, 59, 999);
        return now >= from && now <= to;
    }

    if (theme.recurring) {
        const { month, day, daysBefore = 0, daysAfter = 0, milestones } = theme.recurring;
        const year = now.getFullYear();
        const from = new Date(year, month - 1, day - daysBefore);
        const to = new Date(year, month - 1, day + daysAfter);
        to.setHours(23, 59, 59, 999);

        if (now < from || now > to) return false;

        if ((milestones && milestones.length > 0) || theme.recurring?.milestoneRange) {
            const days = daysUntilRaceDay(theme, now)!;
            if (days > 0) {
                const inMilestones = milestones?.includes(days) ?? false;
                const ranges = theme.recurring?.milestoneRange ?? [];
                const inRange = ranges.some(r => days <= r.from && days >= r.to);
                return inMilestones || inRange;
            }
            // race day (0) and daysAfter (negative) always show
        }

        return true;
    }

    return false;
}

export function useHeroTheme(): HeroTheme | null {
    const { data: holidays } = useQuery<HolidayMap>({
        queryKey: ['is-holidays'],
        queryFn: fetchHolidays,
        staleTime: Infinity,
    });

    return useMemo(() => {
        const now = new Date();
        const active = HERO_THEMES
            .filter(t => t.enabled !== false && isThemeActive(t, now, holidays))
            .sort((a, b) => b.priority - a.priority);
        return active[0] ?? null;
    }, [holidays]);
}

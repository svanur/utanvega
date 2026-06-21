type TFunc = (key: string, opts?: Record<string, unknown>) => string;

export function formatNextDate(dateStr: string, t: TFunc): string {
    const date = new Date(dateStr + 'T00:00:00');
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const month = months[date.getMonth()];
    const formatted = `${date.getDate()}. ${month} ${date.getFullYear()}`;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'success';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

export function getCountdownLabel(daysUntil: number | null, t: TFunc): string {
    if (daysUntil === null) return t('races.noDate');
    if (daysUntil === 0) return t('races.today');
    if (daysUntil === 1) return t('races.tomorrow');
    if (daysUntil === -1) return t('races.yesterday');
    if (daysUntil < -1) return t('races.daysAgo', { count: Math.abs(daysUntil) });
    return t('races.daysUntil', { count: daysUntil });
}

export function formatRaceDateTime(
    dateOfRace: string | null,
    startTime: string | null,
    t: TFunc,
): string | null {
    if (!dateOfRace && !startTime) return null;
    const dateLabel = dateOfRace ? formatNextDate(dateOfRace, t) : null;
    const timeLabel = startTime ? startTime.slice(0, 5) : null;
    return [dateLabel, timeLabel].filter(Boolean).join(' · ');
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

export function getEventTypeColor(type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default' {
    switch (type) {
        case 'Race': return 'primary';
        case 'Series': return 'secondary';
        case 'FunRun': return 'success';
        case 'Training': return 'info';
        case 'Advertisement': return 'warning';
        default: return 'default';
    }
}

export function formatNextDate(dateStr: string, t: TFunc): string {
    const date = new Date(dateStr + 'T00:00:00');
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const month = months[date.getMonth()];
    const formatted = `${date.getDate()}. ${month} ${date.getFullYear()}`;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDateRange(startStr: string, endStr: string | null | undefined, t: TFunc): string {
    if (!endStr) return formatNextDate(startStr, t);
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        const s = `${start.getDate()}.–${end.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return `${formatNextDate(startStr, t)} – ${formatNextDate(endStr, t)}`;
}

export function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'default';
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

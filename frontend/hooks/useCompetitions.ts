import { useQuery } from '@tanstack/react-query';
import { API_URL } from './useTrails';

export interface ScheduleRule {
    type: 'Yearly' | 'Seasonal' | 'Fixed';
    month?: number;
    weekOfMonth?: number;
    dayOfMonth?: number;
    dayOfWeek?: string;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface CompetitionSummary {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizerName: string | null;
    organizerWebsite: string | null;
    registrationUrl: string | null;
    alertMessage: string | null;
    alertSeverity: string | null;
    locationId: string | null;
    locationName: string | null;
    status: string;
    scheduleRule: ScheduleRule | null;
    nextDate: string | null;
    daysUntil: number | null;
    raceCount: number;
}

export interface RaceDto {
    id: string;
    competitionId: string;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    name: string;
    distanceLabel: string | null;
    cutoffMinutes: number | null;
    description: string | null;
    status: string;
    sortOrder: number;
    trailDistanceMeters: number | null;
    trailElevationGain: number | null;
}

export interface CompetitionDetail extends CompetitionSummary {
    upcomingDates: string[];
    races: RaceDto[];
}

export function useCompetitions() {
    const { data: competitions = [], isPending, error: queryError } = useQuery<CompetitionSummary[]>({
        queryKey: ['competitions'],
        queryFn: () => fetch(`${API_URL}/api/v1/competitions`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch competitions');
                return res.json() as Promise<CompetitionSummary[]>;
            }),
        staleTime: 5 * 60 * 1000,
    });
    return { competitions, loading: isPending, error: queryError instanceof Error ? queryError.message : null };
}

export function useCompetitionBySlug(slug: string | undefined) {
    const { data: competition = null, isPending, error: queryError } = useQuery<CompetitionDetail | null>({
        queryKey: ['competition', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/competitions/${encodeURIComponent(slug!)}`)
            .then(res => {
                if (!res.ok) throw new Error('Competition not found');
                return res.json() as Promise<CompetitionDetail>;
            }),
        enabled: !!slug,
        staleTime: 5 * 60 * 1000,
    });
    return { competition, loading: isPending && !!slug, error: queryError instanceof Error ? queryError.message : null };
}

export interface CalendarEvent {
    name: string;
    slug: string;
    locationName: string | null;
    raceCount: number;
}

export interface CalendarDay {
    date: string;
    events: CalendarEvent[];
}

export function useCompetitionCalendar(from: string, to: string) {
    const { data: days = [], isPending, error: queryError } = useQuery<CalendarDay[]>({
        queryKey: ['competition-calendar', from, to],
        queryFn: () => fetch(`${API_URL}/api/v1/competitions/calendar?from=${from}&to=${to}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch calendar');
                return res.json() as Promise<CalendarDay[]>;
            }),
        staleTime: 5 * 60 * 1000,
        enabled: !!from && !!to,
    });
    return { days, loading: isPending, error: queryError instanceof Error ? queryError.message : null };
}

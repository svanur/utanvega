import { useQuery, useQueries } from '@tanstack/react-query';
import { API_URL } from './useTrails';

export interface ScheduleRule {
    type: 'Yearly' | 'Seasonal' | 'Fixed' | 'Approximate';
    month?: number;
    weekOfMonth?: number;
    dayOfMonth?: number;
    dayOfWeek?: string;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface SocialLink {
    type: string;
    url: string;
}

export interface SeriesRaceDto {
    raceId: string;
    raceName: string;
    raceNameEn: string | null;
    dateOfRace: string | null;
    startTime: string | null;
    distanceLabel: string | null;
    ticketStatus: string;
    registrationUrl: string | null;
}

export interface EventSummary {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionEn: string | null;
    type: string;
    activityType: string;
    activityTypes: string[] | null;
    status: string;
    organizerName: string | null;
    organizerNameEn: string | null;
    organizerWebsite: string | null;
    alertMessage: string | null;
    alertMessageEn: string | null;
    alertSeverity: string | null;
    locationId: string | null;
    locationName: string | null;
    scheduleRule: ScheduleRule | null;
    socialLinks: SocialLink[] | null;
    nextEditionDate: string | null;
    daysUntil: number | null;
    displayDate: string | null;
    editionCount: number;
    distances: { label: string; ticketStatus: string | null }[] | null;
    registrationUrl: string | null;
    registrationStatus: string | null;
    resultsUrl: string | null;
    photoGalleryUrl: string | null;
    certifications: string[] | null;
    youtubeUrl: string | null;
    championshipCategories: string[] | null;
    itraPoints: number[] | null;
    createdAt: string;
    updatedAt: string | null;
    seriesRaces: SeriesRaceDto[] | null;
    gpxPointLat: number | null;
    gpxPointLng: number | null;
    isMountainRace: boolean;
    endDisplayDate: string | null;
    editionStatus: string | null;
    editionEffectiveCancelled: boolean;
}

export interface RaceDto {
    id: string;
    eventEditionId: string;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    name: string;
    nameEn: string | null;
    distanceLabel: string | null;
    cutoffMinutes: number | null;
    description: string | null;
    descriptionEn: string | null;
    status: string;
    sortOrder: number;
    ticketStatus: string | null;
    maxParticipants: number | null;
    itraPoints: number | null;
    certifiedBy: string | null;
    certifiedByEn: string | null;
    prizeMoney: number | null;
    championshipCategory: string | null;
    championshipCategoryEn: string | null;
    dateOfRace: string | null;
    startTime: string | null;
    trailDistanceMeters: number | null;
    trailElevationGain: number | null;
    trailTerrainType: string | null;
    trailDifficulty: string | null;
    trailActivityType: string | null;
    activityType: string | null;
}

export interface EventEditionDto {
    id: string;
    eventId: string;
    year: number | null;
    date: string | null;
    endDate: string | null;
    title: string | null;
    titleEn: string | null;
    registrationUrl: string | null;
    resultsUrl: string | null;
    photoGalleryUrl: string | null;
    notes: string | null;
    notesEn: string | null;
    registrationStatus: string | null;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    races: RaceDto[];
    createdAt: string;
    updatedAt: string | null;
    status: string;
    effectiveCancelled: boolean;
}

export interface EventDetail extends EventSummary {
    upcomingDates: string[];
    editions: EventEditionDto[];
}

const EVENTS_CACHE_KEY = 'utanvega-events-v1';
const EVENTS_CACHE_TS_KEY = 'utanvega-events-v1-ts';

function readEventsCache(): EventSummary[] | undefined {
    try {
        const raw = localStorage.getItem(EVENTS_CACHE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as EventSummary[]) : undefined;
    } catch {
        return undefined;
    }
}

function readEventsCacheTimestamp(): number {
    try {
        return Number(localStorage.getItem(EVENTS_CACHE_TS_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeEventsCache(events: EventSummary[]): void {
    try {
        localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events));
        localStorage.setItem(EVENTS_CACHE_TS_KEY, String(Date.now()));
    } catch { /* storage full or private mode */ }
}

export function useEvents() {
    const { data: events = [], isPending, error: queryError, refetch } = useQuery<EventSummary[]>({
        queryKey: ['events'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/events`);
            if (!res.ok) throw new Error('Failed to fetch events');
            const data = await res.json() as EventSummary[];
            writeEventsCache(data);
            return data;
        },
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        initialData: readEventsCache,
        initialDataUpdatedAt: readEventsCacheTimestamp,
    });
    return { events, loading: isPending, error: queryError instanceof Error ? queryError.message : null, refresh: refetch };
}

export function useEventBySlug(slug: string | undefined) {
    const { data: event = null, isPending, error: queryError } = useQuery<EventDetail | null>({
        queryKey: ['event', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/events/${encodeURIComponent(slug!)}`)
            .then(res => {
                if (!res.ok) throw new Error('Event not found');
                return res.json() as Promise<EventDetail>;
            }),
        enabled: !!slug,
        staleTime: 5 * 60 * 1000,
    });
    return { event, loading: isPending && !!slug, error: queryError instanceof Error ? queryError.message : null };
}

export interface CalendarEvent {
    name: string;
    nameEn: string | null;
    slug: string;
    locationName: string | null;
    editionTitle: string | null;
    raceCount: number;
    type: string;
    activityTypes: string[] | null;
    raceName: string | null;
    distances: string[] | null;
}

export interface CalendarDay {
    date: string;
    events: CalendarEvent[];
}

export function useEventCalendar(from: string, to: string, enabled = true) {
    const { data: days = [], isPending, error: queryError } = useQuery<CalendarDay[]>({
        queryKey: ['event-calendar', from, to],
        queryFn: () => fetch(`${API_URL}/api/v1/events/calendar?from=${from}&to=${to}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch calendar');
                return res.json() as Promise<CalendarDay[]>;
            }),
        staleTime: 5 * 60 * 1000,
        enabled: enabled && !!from && !!to,
    });
    return { days, loading: isPending, error: queryError instanceof Error ? queryError.message : null };
}

export interface EditionHistoryRow {
    eventId: string;
    eventSlug: string;
    eventName: string;
    eventNameEn: string | null;
    eventType: string;
    editionId: string;
    editionYear: number | null;
    rowDate: string;
    rowEndDate: string | null;
    locationName: string | null;
    effectiveCancelled: boolean;
    distances: { label: string; ticketStatus: string | null }[];
    resultsUrl: string | null;
    photoGalleryUrl: string | null;
    activityTypes: string[] | null;
    eventActivityType: string;
    raceId: string | null;
    raceName: string | null;
    raceNameEn: string | null;
}

export function useEditionsHistory(year: number | undefined, includeCancelled: boolean) {
    const { data: rows = [], isPending, error: queryError } = useQuery<EditionHistoryRow[]>({
        queryKey: ['editions-history', year, includeCancelled],
        queryFn: () => fetch(`${API_URL}/api/v1/events/history?year=${year}&includeCancelled=${includeCancelled}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch editions history');
                return res.json() as Promise<EditionHistoryRow[]>;
            }),
        staleTime: 5 * 60 * 1000,
        enabled: !!year,
    });
    return { rows, loading: isPending, error: queryError instanceof Error ? queryError.message : null };
}

// Fetches every year in `years` in parallel and merges the rows — used when a search term is
// active, so results aren't limited to whichever year happens to be selected. Reuses the same
// query key as useEditionsHistory, so any year the user already browsed is served from cache.
export function useEditionsHistoryAllYears(years: number[], includeCancelled: boolean, enabled: boolean) {
    const results = useQueries({
        queries: years.map(year => ({
            queryKey: ['editions-history', year, includeCancelled],
            queryFn: () => fetch(`${API_URL}/api/v1/events/history?year=${year}&includeCancelled=${includeCancelled}`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch editions history');
                    return res.json() as Promise<EditionHistoryRow[]>;
                }),
            staleTime: 5 * 60 * 1000,
            enabled: enabled && !!year,
        })),
    });

    const loading = enabled && results.some(r => r.isPending);
    const rows = enabled ? results.flatMap(r => r.data ?? []) : [];
    return { rows, loading };
}

export function useEditionsHistoryYears() {
    const { data: years = [], isPending } = useQuery<number[]>({
        queryKey: ['editions-history-years'],
        queryFn: () => fetch(`${API_URL}/api/v1/events/history/years`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch editions history years');
                return res.json() as Promise<number[]>;
            }),
        staleTime: 30 * 60 * 1000,
    });
    return { years, loading: isPending };
}

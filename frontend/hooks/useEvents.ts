import { useQuery } from '@tanstack/react-query';
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
    notes: string | null;
    notesEn: string | null;
    registrationStatus: string | null;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    races: RaceDto[];
    createdAt: string;
    updatedAt: string | null;
}

export interface EventDetail extends EventSummary {
    upcomingDates: string[];
    editions: EventEditionDto[];
}

export function useEvents() {
    const { data: events = [], isPending, error: queryError, refetch } = useQuery<EventSummary[]>({
        queryKey: ['events'],
        queryFn: () => fetch(`${API_URL}/api/v1/events`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch events');
                return res.json() as Promise<EventSummary[]>;
            }),
        staleTime: 5 * 60 * 1000,
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
}

export interface CalendarDay {
    date: string;
    events: CalendarEvent[];
}

export function useEventCalendar(from: string, to: string) {
    const { data: days = [], isPending, error: queryError } = useQuery<CalendarDay[]>({
        queryKey: ['event-calendar', from, to],
        queryFn: () => fetch(`${API_URL}/api/v1/events/calendar?from=${from}&to=${to}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch calendar');
                return res.json() as Promise<CalendarDay[]>;
            }),
        staleTime: 5 * 60 * 1000,
        enabled: !!from && !!to,
    });
    return { days, loading: isPending, error: queryError instanceof Error ? queryError.message : null };
}

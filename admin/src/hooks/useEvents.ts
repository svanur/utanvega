import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type ScheduleType = 'Yearly' | 'Seasonal' | 'Fixed';
export type EventType = 'Race' | 'Series' | 'Advertisement' | 'Festival' | 'Other';
export type ActivityType = 'TrailRunning' | 'Running' | 'Cycling' | 'Hiking' | 'FunRun' | 'ObstacleCourse' | 'CrossCountryRun' | 'Social' | 'Other';
export type EventStatus = 'Unconfirmed' | 'Confirmed' | 'Cancelled' | 'Hidden' | 'Unlisted';
export type RegistrationStatus = 'NotStarted' | 'Open' | 'Closed';
export type RaceStatus = 'Active' | 'Cancelled' | 'Hidden';
export type TicketStatus = 'Available' | 'SoldOut';
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

export interface SocialLink {
    type: string;
    url: string;
}

export interface ScheduleRule {
    type: ScheduleType;
    month?: number;
    weekOfMonth?: number;
    dayOfMonth?: number;
    dayOfWeek?: DayOfWeek;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface RaceDto {
    id: string;
    eventEditionId: string;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    name: string;
    distanceLabel: string | null;
    cutoffMinutes: number | null;
    description: string | null;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    maxParticipants: number | null;
    itraPoints: number;
    certifiedBy: string | null;
    prizeMoney: number;
    championshipCategory: string | null;
    dateOfRace: string | null;
    startTime: string | null;
    trailDistanceMeters: number | null;
    trailElevationGain: number | null;
}

export interface EventEditionDto {
    id: string;
    eventId: string;
    year: number | null;
    date: string | null;
    title: string | null;
    registrationUrl: string | null;
    resultsUrl: string | null;
    notes: string | null;
    registrationStatus: RegistrationStatus;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    races: RaceDto[];
    createdAt: string;
    updatedAt: string | null;
}

export interface EventSummaryDto {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName: string | null;
    organizerWebsite: string | null;
    alertMessage: string | null;
    alertSeverity: AlertSeverity | null;
    locationId: string | null;
    locationName: string | null;
    scheduleRule: ScheduleRule | null;
    socialLinks: SocialLink[] | null;
    nextEditionDate: string | null;
    daysUntil: number | null;
    editionCount: number;
    createdAt: string;
    updatedAt: string | null;
}

export interface EventDetailDto extends EventSummaryDto {
    upcomingDates: string[];
    editions: EventEditionDto[];
}

export interface CreateEventInput {
    name: string;
    slug?: string;
    description?: string;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName?: string;
    organizerWebsite?: string;
    alertMessage?: string;
    alertSeverity?: AlertSeverity;
    locationId?: string | null;
    scheduleRule?: ScheduleRule | null;
    socialLinks?: SocialLink[] | null;
}

export interface UpdateEventInput {
    id: string;
    name: string;
    description?: string;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName?: string;
    organizerWebsite?: string;
    alertMessage?: string;
    alertSeverity?: AlertSeverity;
    locationId?: string | null;
    scheduleRule?: ScheduleRule | null;
    socialLinks?: SocialLink[] | null;
}

export interface CreateEditionInput {
    eventId: string;
    year?: number | null;
    date?: string | null;
    title?: string;
    registrationUrl?: string;
    resultsUrl?: string;
    notes?: string;
    registrationStatus: RegistrationStatus;
    trailId?: string | null;
}

export interface UpdateEditionInput {
    id: string;
    year?: number | null;
    date?: string | null;
    title?: string;
    registrationUrl?: string;
    resultsUrl?: string;
    notes?: string;
    registrationStatus: RegistrationStatus;
    trailId?: string | null;
}

export interface CreateRaceInput {
    eventEditionId: string;
    trailId?: string | null;
    name: string;
    distanceLabel?: string;
    cutoffMinutes?: number | null;
    description?: string;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    maxParticipants?: number | null;
    itraPoints: number;
    certifiedBy?: string;
    prizeMoney: number;
    championshipCategory?: string;
    dateOfRace?: string | null;
    startTime?: string | null;
}

export interface UpdateRaceInput {
    id: string;
    trailId?: string | null;
    name: string;
    distanceLabel?: string;
    cutoffMinutes?: number | null;
    description?: string;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    maxParticipants?: number | null;
    itraPoints: number;
    certifiedBy?: string;
    prizeMoney: number;
    championshipCategory?: string;
    dateOfRace?: string | null;
    startTime?: string | null;
}

export interface GenerateEditionsForSeasonInput {
    eventId: string;
    from: string;
    to: string;
    trailId?: string | null;
    registrationUrl?: string | null;
}

export interface GenerateEditionsForSeasonResult {
    editionIds: string[];
    count: number;
}

export function useEvents() {
    const [events, setEvents] = useState<EventSummaryDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<EventSummaryDto[]>('/api/v1/admin/events');
            setEvents(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchEvents();
    }, []);

    const createEvent = async (input: CreateEventInput) => {
        const result = await apiFetch<{ id: string }>('/api/v1/admin/events', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await fetchEvents();
        return result.id;
    };

    const updateEvent = async (id: string, input: Omit<UpdateEventInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
        await fetchEvents();
    };

    const deleteEvent = async (id: string) => {
        await apiFetch(`/api/v1/admin/events/${id}`, { method: 'DELETE' });
        setEvents(prev => prev.filter(event => event.id !== id));
    };

    const getEvent = async (slug: string) => apiFetch<EventDetailDto>(`/api/v1/events/${slug}`);

    const createEdition = async (input: CreateEditionInput) => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/events/${input.eventId}/editions`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await fetchEvents();
        return result.id;
    };

    const updateEdition = async (id: string, input: Omit<UpdateEditionInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/editions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
        await fetchEvents();
    };

    const deleteEdition = async (id: string) => {
        await apiFetch(`/api/v1/admin/editions/${id}`, { method: 'DELETE' });
        await fetchEvents();
    };

    const generateEditionsForSeason = async (input: GenerateEditionsForSeasonInput) => {
        const result = await apiFetch<GenerateEditionsForSeasonResult>(`/api/v1/admin/events/${input.eventId}/editions/generate`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await fetchEvents();
        return result;
    };

    const createRace = async (input: CreateRaceInput) => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/editions/${input.eventEditionId}/races`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return result.id;
    };

    const updateRace = async (id: string, input: Omit<UpdateRaceInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/races/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
    };

    const deleteRace = async (id: string) => {
        await apiFetch(`/api/v1/admin/races/${id}`, { method: 'DELETE' });
    };

    return {
        events,
        loading,
        error,
        refresh: fetchEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        getEvent,
        createEdition,
        updateEdition,
        deleteEdition,
        generateEditionsForSeason,
        createRace,
        updateRace,
        deleteRace,
    };
}

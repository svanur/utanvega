import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { haversineKm } from '../utils/geo';

export interface LocationInfo {
    name: string;
    nameEn: string | null;
    slug: string;
    order: number;
    role: string;
    centerLatitude: number | null;
    centerLongitude: number | null;
}

export interface TagInfo {
    name: string;
    nameEn: string | null;
    slug: string;
    color: string | null;
}

export interface LinkedRace {
    eventName: string;
    eventSlug: string;
    raceName: string;
    distanceLabel: string | null;
    daysUntil: number | null;
    startTime: string | null;
    ticketStatus: string | null;
    itraPoints: number | null;
}

export interface Trail {
    id: string;
    name: string;
    slug: string;
    description?: string;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    status: string;
    activityType: string;
    trailType: string;
    difficulty: string;
    startLatitude: number | null;
    startLongitude: number | null;
    locations: LocationInfo[];
    tags?: TagInfo[];
    viewCount?: number;
    linkedRaces?: LinkedRace[];
    youtubeUrl?: string | null;
    elevationProfile?: number[];
    terrainType?: string | null;
    distanceToUser?: number; // in kilometers
}

export type SortOption = 'distance' | 'name' | 'shortest' | 'longest' | 'elevation' | 'popular';

export interface FilterState {
    lengthBuckets: string[];       // '<10' | '10-21' | '21-42' | '42-100' | '100+'
    elevationGainBuckets: string[]; // '<200' | '200-500' | '500-1000' | '1000+'
    elevationLossBuckets: string[]; // same
    distanceBuckets: string[];     // '<10' | '10-25' | '25-50' | '50-100' | '100+'
    difficulties: string[];         // multi-select: 'Easy' | 'Moderate' | 'Hard' | 'Expert' | 'Extreme'
    locationSlugs: string[];        // multi-select Autocomplete (location slugs incl. descendants)
    favoritesOnly: boolean;
    offlineOnly: boolean;
    selectedTags: string[];
    selectedActivityTypes: string[];
    sortBy: SortOption;
}

export const ALL_ACTIVITY_TYPES = ['TrailRunning', 'Running', 'Hiking', 'Cycling', 'FunRun', 'ObstacleCourse', 'CrossCountryRun'];

export const DEFAULT_FILTERS: FilterState = {
    lengthBuckets: [],
    elevationGainBuckets: [],
    elevationLossBuckets: [],
    distanceBuckets: [],
    difficulties: [],
    locationSlugs: [],
    favoritesOnly: false,
    offlineOnly: false,
    selectedTags: [],
    selectedActivityTypes: [],
    sortBy: 'distance',
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const TRAILS_CACHE_KEY = 'utanvega-trails-v1';
const TRAILS_CACHE_TS_KEY = 'utanvega-trails-v1-ts';

function readTrailsCache(): Trail[] | undefined {
    try {
        const raw = localStorage.getItem(TRAILS_CACHE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Trail[]) : undefined;
    } catch {
        return undefined;
    }
}

function readTrailsCacheTimestamp(): number {
    try {
        return Number(localStorage.getItem(TRAILS_CACHE_TS_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeTrailsCache(trails: Trail[]): void {
    try {
        localStorage.setItem(TRAILS_CACHE_KEY, JSON.stringify(trails));
        localStorage.setItem(TRAILS_CACHE_TS_KEY, String(Date.now()));
    } catch {
        // Ignore write failures (storage full, private mode, etc.)
    }
}

export function useTrails(disableGeolocation = false) {
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const requestLocation = useCallback(() => {
        if (disableGeolocation || !navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLocationDenied(false);
                try { sessionStorage.setItem('utanvega-user-loc', JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude })); } catch { /* ignore */ }
            },
            (err) => {
                console.warn('Geolocation failed:', err.message);
                if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
                    setLocationDenied(true);
                }
            }
        );
    }, [disableGeolocation]);

    // Request location on mount
    useEffect(() => { requestLocation(); }, [requestLocation]);

    const {
        data: trails = [],
        isPending: loading,
        isFetching,
        refetch,
        error: queryError,
    } = useQuery<Trail[]>({
        queryKey: ['trails'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/trails`);
            if (!res.ok) throw new Error('Failed to fetch trails');
            const data = await res.json() as Trail[];
            writeTrailsCache(data);
            return data;
        },
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        initialData: readTrailsCache,
        initialDataUpdatedAt: readTrailsCacheTimestamp,
    });

    const refreshing = isFetching && !loading;
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

    const refresh = () => {
        requestLocation();
        refetch();
    };

    // Calculate distance and sort
    const processedTrails = useMemo(() => {
        let result = trails.map(trail => {
            if (!userLocation || 
                trail.startLatitude === null || trail.startLongitude === null ||
                (trail.startLatitude === 0 && trail.startLongitude === 0)
            ) {
                return { ...trail, distanceToUser: Infinity };
            }

            const dist = calculateHaversineDistance(
                userLocation.lat,
                userLocation.lng,
                trail.startLatitude,
                trail.startLongitude
            );

            return { ...trail, distanceToUser: dist };
        });

        // Filter by search query
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            result = result.filter(trail => 
                trail.name.toLowerCase().includes(query) || 
                (trail.description && trail.description.toLowerCase().includes(query))
            );
        }

        // Apply advanced filters
        result = result.filter(trail => {
            // Activity Type filter (empty = show all)
            if (filters.selectedActivityTypes.length > 0) {
                if (!filters.selectedActivityTypes.includes(trail.activityType)) return false;
            }

            // Trail length bucket filter (OR logic across selected buckets)
            if (filters.lengthBuckets.length > 0) {
                const km = trail.length / 1000;
                const inBucket = filters.lengthBuckets.some(b => {
                    if (b === '<10') return km < 10;
                    if (b === '10-21') return km >= 10 && km < 21.1;
                    if (b === '21-42') return km >= 21.1 && km < 42.2;
                    if (b === '42-100') return km >= 42.2 && km < 100;
                    if (b === '100+') return km >= 100;
                    return false;
                });
                if (!inBucket) return false;
            }

            // Distance filter (only if user location is available and trail has distance)
            if (userLocation && filters.distanceBuckets.length > 0 && trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity) {
                const d = trail.distanceToUser;
                const inBucket = filters.distanceBuckets.some(b => {
                    if (b === '<10') return d < 10;
                    if (b === '10-25') return d >= 10 && d < 25;
                    if (b === '25-50') return d >= 25 && d < 50;
                    if (b === '50-100') return d >= 50 && d < 100;
                    if (b === '100+') return d >= 100;
                    return false;
                });
                if (!inBucket) return false;
            }

            // Elevation Gain bucket filter (OR logic)
            if (filters.elevationGainBuckets.length > 0) {
                const gain = trail.elevationGain;
                const inBucket = filters.elevationGainBuckets.some(b => {
                    if (b === '<200') return gain < 200;
                    if (b === '200-500') return gain >= 200 && gain < 500;
                    if (b === '500-1000') return gain >= 500 && gain < 1000;
                    if (b === '1000+') return gain >= 1000;
                    return false;
                });
                if (!inBucket) return false;
            }

            // Elevation Loss bucket filter (OR logic)
            if (filters.elevationLossBuckets.length > 0) {
                const loss = trail.elevationLoss;
                const inBucket = filters.elevationLossBuckets.some(b => {
                    if (b === '<200') return loss < 200;
                    if (b === '200-500') return loss >= 200 && loss < 500;
                    if (b === '500-1000') return loss >= 500 && loss < 1000;
                    if (b === '1000+') return loss >= 1000;
                    return false;
                });
                if (!inBucket) return false;
            }

            // Trail Type (OR logic)

            // Difficulty (OR logic)
            if (filters.difficulties.length > 0 && !filters.difficulties.includes(trail.difficulty)) return false;

            // Location (multi-select, OR logic)
            if (filters.locationSlugs.length > 0) {
                if (!trail.locations || !trail.locations.some(l => filters.locationSlugs.includes(l.slug))) return false;
            }

            // Tags — trail must have ALL selected tags
            if (filters.selectedTags.length > 0) {
                const trailTagSlugs = trail.tags?.map(t => t.slug) || [];
                if (!filters.selectedTags.every(tag => trailTagSlugs.includes(tag))) return false;
            }

            return true;
        });

        // Sort based on selected option (fall back to name if distance unavailable)
        const sortBy = (userLocation || filters.sortBy !== 'distance') ? filters.sortBy : 'name';
        switch (sortBy) {
            case 'distance':
                result.sort((a, b) => (a.distanceToUser || 0) - (b.distanceToUser || 0));
                break;
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name, 'is'));
                break;
            case 'shortest':
                result.sort((a, b) => a.length - b.length);
                break;
            case 'longest':
                result.sort((a, b) => b.length - a.length);
                break;
            case 'elevation':
                result.sort((a, b) => b.elevationGain - a.elevationGain);
                break;
            case 'popular':
                result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
                break;
        }

        return result;
    }, [trails, userLocation, searchQuery, filters]);

    const resetFilters = () => setFilters(DEFAULT_FILTERS);

    return { 
        trails: processedTrails, 
        loading, 
        refreshing,
        refresh,
        error, 
        userLocation,
        locationDenied,
        requestLocation,
        searchQuery, 
        setSearchQuery,
        filters,
        setFilters,
        resetFilters
    };
}

export function useTrail(id?: string) {
    const { data: trail = null, isPending, error: queryError } = useQuery<Trail | null>({
        queryKey: ['trail', id],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch trail');
                return res.json() as Promise<Trail>;
            }),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
    const loading = isPending && !!id;
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
    return { trail, loading, error };
}

export function useTrailBySlug(slug?: string) {
    const { data, isPending, error: queryError } = useQuery<{ trail: Trail; isFromCache: boolean } | null>({
        queryKey: ['trail', slug],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_URL}/api/v1/trails/${slug}`);
                if (!res.ok) throw new Error('Failed to fetch trail');
                return { trail: await res.json() as Trail, isFromCache: false };
            } catch (fetchError) {
                // Try offline IndexedDB fallback
                try {
                    const db = await new Promise<IDBDatabase>((resolve, reject) => {
                        const req = indexedDB.open('utanvega-offline', 1);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    const tx = db.transaction('trails', 'readonly');
                    const store = tx.objectStore('trails');
                    const item = await new Promise<{ trail: Trail } | undefined>((resolve, reject) => {
                        const req = store.get(slug!);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (item?.trail) {
                        return { trail: item.trail, isFromCache: true };
                    }
                } catch {
                    // IndexedDB not available
                }
                throw fetchError;
            }
        },
        enabled: !!slug,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });
    const loading = isPending && !!slug;
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
    return { trail: data?.trail ?? null, loading, error, isFromCache: data?.isFromCache ?? false };
}

export interface TrailSuggestion {
    name: string;
    slug: string;
    length: number;
    activityType: string;
    trailType: string;
}

export function useTrailSuggestions(slug?: string, enabled = false) {
    const { data: suggestions = [], isPending } = useQuery<TrailSuggestion[]>({
        queryKey: ['suggestions', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/suggestions?slug=${encodeURIComponent(slug!)}`)
            .then(res => res.ok ? res.json() as Promise<TrailSuggestion[]> : []),
        enabled: !!slug && enabled,
        staleTime: 10 * 60 * 1000,
    });
    return { suggestions, loading: isPending && !!slug && enabled };
}

const calculateHaversineDistance = haversineKm;

export function recordTrailView(slug: string) {
    fetch(`${API_URL}/api/v1/trails/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
    }).catch(() => {
        // Fire-and-forget — silently ignore errors
    });
}

export interface TrendingTrail {
    name: string;
    slug: string;
    activityType: string;
    length: number;
    elevationGain: number;
    viewCount: number;
}

export function useTrendingTrails(count = 10, days = 7) {
    const { data: trending = [], isPending: loading } = useQuery<TrendingTrail[]>({
        queryKey: ['trending', count, days],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/trending?count=${count}&days=${days}`)
            .then(res => res.ok ? res.json() as Promise<TrendingTrail[]> : []),
        staleTime: 15 * 60 * 1000, // trending data changes slowly
    });
    return { trending, loading };
}

// Weather types and hook
export interface WeatherPointDto {
    latitude: number;
    longitude: number;
    elevation: number;
    temperature: number;
    apparentTemperature: number;
    windSpeed: number;
    windGusts: number;
    precipitation: number;
    weatherCode: number;
    cloudCover: number;
    label: string;
}

export interface HourlyForecastDto {
    time: string;
    temperature: number;
    apparentTemperature: number;
    windSpeed: number;
    windGusts: number;
    precipitation: number;
    weatherCode: number;
    cloudCover: number;
}

export interface DailyForecastDto {
    date: string;
    temperatureMax: number;
    temperatureMin: number;
    precipitationSum: number;
    windSpeedMax: number;
    windGustsMax: number;
    weatherCode: number;
}

export interface TrailWeather {
    current: WeatherPointDto;
    hourly: HourlyForecastDto[];
    daily: DailyForecastDto[];
    summit: WeatherPointDto | null;
    condition: 'Good' | 'Fair' | 'Poor';
}

export interface TrailLeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    timeInSeconds: number;
    logDate?: string;
}

interface TrailLeaderboardResponse {
    entries: TrailLeaderboardEntry[];
    totalEntries: number;
}

export function useTrailLeaderboard(slug?: string, limit = 10, enabled = true) {
    const { data, isPending, error: queryError } = useQuery<TrailLeaderboardResponse>({
        queryKey: ['trail-leaderboard', slug, limit],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/${slug}/leaderboard?limit=${limit}`)
            .then(async res => {
                if (!res.ok) {
                    throw new Error('Leaderboard unavailable');
                }
                const response = await res.json() as TrailLeaderboardResponse;
                return {
                    entries: response.entries.map(entry => ({
                        ...entry,
                        avatarUrl: entry.avatarUrl ?? undefined,
                        logDate: entry.logDate ?? undefined,
                    })),
                    totalEntries: response.totalEntries ?? 0,
                };
            }),
        enabled: !!slug && enabled,
        staleTime: 5 * 60 * 1000,
    });
    const loading = isPending && !!slug && enabled;
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
    return { leaderboard: data?.entries ?? [], totalEntries: data?.totalEntries ?? 0, loading, error };
}

export function useTrailWeather(slug?: string) {
    const { data: weather = null, isPending, error: queryError } = useQuery<TrailWeather | null>({
        queryKey: ['weather', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/${slug}/weather`)
            .then(res => {
                if (!res.ok) throw new Error('Weather unavailable');
                return res.json() as Promise<TrailWeather>;
            }),
        enabled: !!slug,
        staleTime: 10 * 60 * 1000,
    });
    const loading = isPending && !!slug;
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
    return { weather, loading, error };
}

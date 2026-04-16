import { useState, useEffect, useMemo } from 'react';
import { estimateDurationMinutes } from '../utils/estimateDuration';

export interface LocationInfo {
    name: string;
    slug: string;
    order: number;
    role: string;
}

export interface TagInfo {
    name: string;
    slug: string;
    color: string | null;
}

export interface LinkedRace {
    competitionName: string;
    competitionSlug: string;
    raceName: string;
    distanceLabel: string | null;
    daysUntil: number | null;
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
    distanceToUser?: number; // in kilometers
}

export type SortOption = 'distance' | 'name' | 'shortest' | 'longest' | 'elevation' | 'popular';

export interface FilterState {
    minLength: number;
    maxLength: number;
    maxDistance: number;
    minElevationGain: number;
    maxElevationGain: number;
    minElevationLoss: number;
    maxElevationLoss: number;
    minDuration: number;
    maxDuration: number;
    trailType: string;
    difficulty: string;
    location: string;
    locationSlugs: string[]; // Selected location + all descendant slugs for hierarchy-aware filtering
    favoritesOnly: boolean;
    offlineOnly: boolean;
    selectedTags: string[];
    selectedActivityTypes: string[];
    sortBy: SortOption;
}

export const ALL_ACTIVITY_TYPES = ['TrailRunning', 'Running', 'Hiking', 'Cycling'];

export const DEFAULT_FILTERS: FilterState = {
    minLength: 0,
    maxLength: 100,
    maxDistance: 250,
    minElevationGain: 0,
    maxElevationGain: 2000,
    minElevationLoss: 0,
    maxElevationLoss: 2000,
    minDuration: 0,
    maxDuration: 480,
    trailType: 'All',
    difficulty: 'All',
    location: 'All',
    locationSlugs: [],
    favoritesOnly: false,
    offlineOnly: false,
    selectedTags: [],
    selectedActivityTypes: [],
    sortBy: 'distance',
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useTrails() {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const requestLocation = () => {
        if (navigator.geolocation) {
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
        }
    };

    const fetchTrails = (isRefreshing = false) => {
        if (isRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        // Get user location
        requestLocation();

        // Fetch trails
        return fetch(`${API_URL}/api/v1/trails`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch trails');
                return res.json();
            })
            .then(data => {
                setTrails(data);
                setLoading(false);
                setRefreshing(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
                setRefreshing(false);
            });
    };

    useEffect(() => {
        fetchTrails();
    }, []);

    const refresh = () => {
        return fetchTrails(true);
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

            // Trail length filter (trail.length is in meters, filters are in km)
            const trailLengthKm = trail.length / 1000;
            if (trailLengthKm < filters.minLength) return false;
            if (filters.maxLength < 100 && trailLengthKm > filters.maxLength) return false;

            // Distance filter (only if user location is available and trail has distance)
            if (userLocation && trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity) {
                if (filters.maxDistance < 250 && trail.distanceToUser > filters.maxDistance) return false;
            }

            // Elevation Gain
            if (trail.elevationGain < filters.minElevationGain) return false;
            if (filters.maxElevationGain < 2000 && trail.elevationGain > filters.maxElevationGain) return false;

            // Elevation Loss
            if (trail.elevationLoss < filters.minElevationLoss) return false;
            if (filters.maxElevationLoss < 2000 && trail.elevationLoss > filters.maxElevationLoss) return false;

            // Estimated Duration
            if (filters.minDuration > 0 || filters.maxDuration < 480) {
                const durationMin = estimateDurationMinutes(trail.length, trail.elevationGain, trail.activityType);
                if (durationMin < filters.minDuration) return false;
                if (filters.maxDuration < 480 && durationMin > filters.maxDuration) return false;
            }

            // Trail Type
            if (filters.trailType !== 'All' && trail.trailType !== filters.trailType) return false;

            // Difficulty
            if (filters.difficulty !== 'All' && trail.difficulty !== filters.difficulty) return false;

            // Location (hierarchy-aware: matches selected location + all descendants)
            if (filters.location !== 'All') {
                const slugsToMatch = filters.locationSlugs.length > 0
                    ? filters.locationSlugs
                    : [filters.location];
                if (!trail.locations || !trail.locations.some(l => slugsToMatch.includes(l.slug))) return false;
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
    const [trail, setTrail] = useState<Trail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        fetch(`${API_URL}/api/v1/trails/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch trail');
                return res.json();
            })
            .then(data => {
                setTrail(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    return { trail, loading, error };
}

export function useTrailBySlug(slug?: string) {
    const [trail, setTrail] = useState<Trail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFromCache, setIsFromCache] = useState(false);

    useEffect(() => {
        if (!slug) return;

        setLoading(true);
        setError(null);
        setTrail(null);
        setIsFromCache(false);

        fetch(`${API_URL}/api/v1/trails/${slug}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch trail');
                return res.json();
            })
            .then(data => {
                setTrail(data);
                setLoading(false);
            })
            .catch(async (err) => {
                // Try offline fallback from IndexedDB
                try {
                    const db = await new Promise<IDBDatabase>((resolve, reject) => {
                        const req = indexedDB.open('utanvega-offline', 1);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    const tx = db.transaction('trails', 'readonly');
                    const store = tx.objectStore('trails');
                    const item = await new Promise<{ trail: Trail } | undefined>((resolve, reject) => {
                        const req = store.get(slug);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (item?.trail) {
                        setTrail(item.trail as Trail);
                        setIsFromCache(true);
                        setLoading(false);
                        return;
                    }
                } catch {
                    // IndexedDB not available
                }
                setError(err.message);
                setLoading(false);
            });
    }, [slug]);

    return { trail, loading, error, isFromCache };
}

export interface TrailSuggestion {
    name: string;
    slug: string;
    length: number;
    activityType: string;
    trailType: string;
}

export function useTrailSuggestions(slug?: string, enabled = false) {
    const [suggestions, setSuggestions] = useState<TrailSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!slug || !enabled) return;

        setLoading(true);
        fetch(`${API_URL}/api/v1/trails/suggestions?slug=${encodeURIComponent(slug)}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setSuggestions(data);
                setLoading(false);
            })
            .catch(() => {
                setSuggestions([]);
                setLoading(false);
            });
    }, [slug, enabled]);

    return { suggestions, loading };
}

// Haversine formula to calculate distance between two points in km
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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
    const [trending, setTrending] = useState<TrendingTrail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails/trending?count=${count}&days=${days}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setTrending(data);
                setLoading(false);
            })
            .catch(() => {
                setTrending([]);
                setLoading(false);
            });
    }, [count, days]);

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

export function useTrailWeather(slug?: string) {
    const [weather, setWeather] = useState<TrailWeather | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        setLoading(true);
        setError(null);

        fetch(`${API_URL}/api/v1/trails/${slug}/weather`)
            .then(res => {
                if (!res.ok) throw new Error('Weather unavailable');
                return res.json();
            })
            .then(data => {
                setWeather(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setWeather(null);
                setLoading(false);
            });
    }, [slug]);

    return { weather, loading, error };
}

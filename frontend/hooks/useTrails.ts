import { useState, useEffect, useMemo } from 'react';

export interface LocationInfo {
    name: string;
    slug: string;
    order: number;
}

export interface TagInfo {
    name: string;
    slug: string;
    color: string | null;
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
    distanceToUser?: number; // in kilometers
}

export interface FilterState {
    maxDistance: number;
    minElevationGain: number;
    maxElevationGain: number;
    minElevationLoss: number;
    maxElevationLoss: number;
    trailType: string;
    location: string;
    favoritesOnly: boolean;
    selectedTags: string[];
}

const DEFAULT_FILTERS: FilterState = {
    maxDistance: 1000,
    minElevationGain: 0,
    maxElevationGain: 5000,
    minElevationLoss: 0,
    maxElevationLoss: 5000,
    trailType: 'All',
    location: 'All',
    favoritesOnly: false,
    selectedTags: [],
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useTrails() {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const fetchTrails = (isRefreshing = false) => {
        if (isRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        // Get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.warn('Geolocation failed:', err.message);
                }
            );
        }

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
            // Distance filter (only if user location is available and trail has distance)
            if (userLocation && trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity) {
                // If maxDistance is 1000 (our max), we treat it as "no limit"
                if (filters.maxDistance < 1000 && trail.distanceToUser > filters.maxDistance) return false;
            }

            // Elevation Gain
            if (trail.elevationGain < filters.minElevationGain || trail.elevationGain > filters.maxElevationGain) return false;

            // Elevation Loss
            if (trail.elevationLoss < filters.minElevationLoss || trail.elevationLoss > filters.maxElevationLoss) return false;

            // Trail Type
            if (filters.trailType !== 'All' && trail.trailType !== filters.trailType) return false;

            // Location
            if (filters.location !== 'All') {
                if (!trail.locations || !trail.locations.some(l => l.name === filters.location)) return false;
            }

            // Tags — trail must have ALL selected tags
            if (filters.selectedTags.length > 0) {
                const trailTagSlugs = trail.tags?.map(t => t.slug) || [];
                if (!filters.selectedTags.every(tag => trailTagSlugs.includes(tag))) return false;
            }

            return true;
        });

        // Sort by distance if user location is available
        if (userLocation) {
            result.sort((a, b) => (a.distanceToUser || 0) - (b.distanceToUser || 0));
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

    useEffect(() => {
        if (!slug) return;

        fetch(`${API_URL}/api/v1/trails/${slug}`)
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
    }, [slug]);

    return { trail, loading, error };
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

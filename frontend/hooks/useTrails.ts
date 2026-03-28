import { useState, useEffect, useMemo } from 'react';

export interface Trail {
    id: string;
    name: string;
    slug: string;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    status: string;
    activityType: string;
    startLatitude: number | null;
    startLongitude: number | null;
    distanceToUser?: number; // in kilometers
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useTrails() {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
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
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch trails');
                return res.json();
            })
            .then(data => {
                setTrails(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    // Calculate distance and sort
    const sortedTrails = useMemo(() => {
        if (!userLocation) return trails;

        const trailsWithDistance = trails.map(trail => {
            if (trail.startLatitude === null || trail.startLongitude === null) {
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

        return [...trailsWithDistance].sort((a, b) => (a.distanceToUser || 0) - (b.distanceToUser || 0));
    }, [trails, userLocation]);

    return { trails: sortedTrails, loading, error, userLocation };
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

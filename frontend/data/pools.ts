import poolsData from './pools.json';
import { haversineKm } from '../utils/geo';

export type PoolType = 'municipal' | 'spa' | 'natural';

export interface Pool {
    id: string;
    name: string;
    type: PoolType;
    locationSlug: string;
    coordinates: { lat: number; lng: number };
    url: string;
    amenities: { hot_tubs: boolean; sauna: boolean; showers: boolean; changing_rooms: boolean };
    access: { is_paid: boolean; requires_hiking: boolean; requires_4wd: boolean };
}

export const pools: Pool[] = poolsData as Pool[];

const MAX_POOL_DISTANCE_KM = 50;

export function findNearestPool(lat: number, lng: number): { pool: Pool; distanceKm: number } | null {
    let nearest: { pool: Pool; distanceKm: number } | null = null;
    for (const pool of pools) {
        const d = haversineKm(lat, lng, pool.coordinates.lat, pool.coordinates.lng);
        if (!nearest || d < nearest.distanceKm) nearest = { pool, distanceKm: d };
    }
    if (nearest && nearest.distanceKm > MAX_POOL_DISTANCE_KM) return null;
    return nearest;
}

export function findPoolsByLocationSlugs(slugs: string[]): Pool[] {
    return pools.filter(p => slugs.includes(p.locationSlug));
}

export function googleMapsDirectionsUrl(pool: Pool): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${pool.coordinates.lat},${pool.coordinates.lng}`;
}

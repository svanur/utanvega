import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'utanvega-offline';
const DB_VERSION = 1;
const TRAIL_STORE = 'trails';
const TILE_CACHE = 'offline-tiles';

interface OfflineTrail {
    slug: string;
    trail: Record<string, unknown>;
    geometry: { type: string; coordinates: number[][] };
    savedAt: string;
    tileCount: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(TRAIL_STORE)) {
                db.createObjectStore(TRAIL_STORE, { keyPath: 'slug' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAll(db: IDBDatabase, store: string): Promise<OfflineTrail[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getByKey(db: IDBDatabase, store: string, key: string): Promise<OfflineTrail | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function putItem(db: IDBDatabase, store: string, item: OfflineTrail): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function deleteItem(db: IDBDatabase, store: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Calculate tile coordinates for a given lat/lon at a specific zoom level
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

// Get all tile URLs for a bounding box at given zoom levels
function getTileUrls(
    coords: number[][],
    zoomLevels: number[],
    tileServer: string
): string[] {
    if (coords.length === 0) return [];

    // Calculate bounding box from coordinates [lon, lat, ele]
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    for (const coord of coords) {
        minLon = Math.min(minLon, coord[0]);
        maxLon = Math.max(maxLon, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
    }

    // Add padding (~500m)
    const pad = 0.005;
    minLat -= pad;
    maxLat += pad;
    minLon -= pad;
    maxLon += pad;

    const urls: string[] = [];
    const servers = ['a', 'b', 'c'];

    for (const zoom of zoomLevels) {
        const topLeft = latLonToTile(maxLat, minLon, zoom);
        const bottomRight = latLonToTile(minLat, maxLon, zoom);

        for (let x = topLeft.x; x <= bottomRight.x; x++) {
            for (let y = topLeft.y; y <= bottomRight.y; y++) {
                const s = servers[(x + y) % 3];
                urls.push(tileServer.replace('{s}', s).replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)));
            }
        }
    }

    return urls;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TILE_SERVER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ZOOM_LEVELS = [10, 11, 12, 13, 14, 15];

export function useOfflineTrails() {
    const [offlineSlugs, setOfflineSlugs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    // Load saved trail slugs on mount
    useEffect(() => {
        openDB().then(db => getAll(db, TRAIL_STORE)).then(items => {
            setOfflineSlugs(new Set(items.map(i => i.slug)));
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const isOffline = useCallback((slug: string) => offlineSlugs.has(slug), [offlineSlugs]);

    const saveTrailOffline = useCallback(async (slug: string): Promise<void> => {
        setSaving(slug);
        setProgress(0);

        try {
            // 1. Fetch trail data and geometry in parallel
            const [trailRes, geoRes] = await Promise.all([
                fetch(`${API_URL}/api/v1/trails/${slug}`),
                fetch(`${API_URL}/api/v1/trails/${slug}/geometry`),
            ]);

            if (!trailRes.ok || !geoRes.ok) throw new Error('Failed to fetch trail data');

            const trail = await trailRes.json();
            const geometry = await geoRes.json();
            setProgress(10);

            // 2. Cache map tiles
            const tileUrls = getTileUrls(geometry.coordinates, ZOOM_LEVELS, TILE_SERVER);
            const cache = await caches.open(TILE_CACHE);
            let cached = 0;

            // Batch tile downloads (10 at a time)
            const batchSize = 10;
            for (let i = 0; i < tileUrls.length; i += batchSize) {
                const batch = tileUrls.slice(i, i + batchSize);
                const results = await Promise.allSettled(
                    batch.map(async url => {
                        const existing = await cache.match(url);
                        if (existing) return; // Already cached
                        const response = await fetch(url);
                        if (response.ok) await cache.put(url, response);
                    })
                );
                cached += results.filter(r => r.status === 'fulfilled').length;
                setProgress(10 + Math.floor((cached / tileUrls.length) * 85));
            }

            // 3. Save trail data to IndexedDB
            const db = await openDB();
            const item: OfflineTrail = {
                slug,
                trail,
                geometry,
                savedAt: new Date().toISOString(),
                tileCount: tileUrls.length,
            };
            await putItem(db, TRAIL_STORE, item);

            setOfflineSlugs(prev => new Set([...prev, slug]));
            setProgress(100);
        } finally {
            setSaving(null);
            setProgress(0);
        }
    }, []);

    const removeTrailOffline = useCallback(async (slug: string): Promise<void> => {
        const db = await openDB();
        const item = await getByKey(db, TRAIL_STORE, slug);

        // Remove from IndexedDB
        await deleteItem(db, TRAIL_STORE, slug);
        setOfflineSlugs(prev => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
        });

        // Clean up tiles (only if no other trail uses them)
        if (item) {
            const remaining = await getAll(db, TRAIL_STORE);
            const usedTileUrls = new Set<string>();
            for (const other of remaining) {
                const urls = getTileUrls(other.geometry.coordinates, ZOOM_LEVELS, TILE_SERVER);
                urls.forEach(u => usedTileUrls.add(u));
            }

            const thisTileUrls = getTileUrls(item.geometry.coordinates, ZOOM_LEVELS, TILE_SERVER);
            const cache = await caches.open(TILE_CACHE);
            for (const url of thisTileUrls) {
                if (!usedTileUrls.has(url)) {
                    await cache.delete(url);
                }
            }
        }
    }, []);

    const getOfflineTrail = useCallback(async (slug: string): Promise<OfflineTrail | undefined> => {
        const db = await openDB();
        return getByKey(db, TRAIL_STORE, slug);
    }, []);

    const getOfflineCount = useCallback(() => offlineSlugs.size, [offlineSlugs]);

    const getStorageEstimate = useCallback(async (): Promise<{ used: number; quota: number } | null> => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const est = await navigator.storage.estimate();
            return { used: est.usage ?? 0, quota: est.quota ?? 0 };
        }
        return null;
    }, []);

    return {
        offlineSlugs,
        loading,
        saving,
        progress,
        isOffline,
        saveTrailOffline,
        removeTrailOffline,
        getOfflineTrail,
        getOfflineCount,
        getStorageEstimate,
    };
}

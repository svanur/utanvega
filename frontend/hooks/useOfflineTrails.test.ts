// @vitest-environment jsdom
//
// #1856: offlineSlugs used to be a per-instance useState, loaded from
// IndexedDB only on mount, so two components mounted at once (OfflineButton
// and the actions-legend row on TrailDetailsPage) each kept their own copy —
// saving/removing offline in one never updated the other without a full page
// reload. useOfflineTrails.ts now keeps offlineSlugs in a module-level shared
// store with a listener set; this test mounts two hook instances at once and
// asserts a remove triggered through one is reflected by the other live,
// without either remounting.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

afterEach(cleanup);

interface FakeOfflineTrail {
    slug: string;
    trail: Record<string, unknown>;
    geometry: { type: string; coordinates: number[][] };
    savedAt: string;
    tileCount: number;
}

// Minimal fake IndexedDB/CacheStorage: just enough of the request/transaction
// shape openDB()/getAll()/getByKey()/putItem()/deleteItem() rely on
// (`.result`/`.onsuccess` on requests, `.oncomplete` on transactions), backed
// by a plain in-memory Map instead of a real IndexedDB implementation.
function installFakeOfflineStorage(seed: FakeOfflineTrail[] = []) {
    const store = new Map<string, FakeOfflineTrail>(seed.map(item => [item.slug, item]));

    function asyncRequest<T>(result: T): { result?: T; onsuccess?: () => void; onerror?: () => void } {
        const request: { result?: T; onsuccess?: () => void; onerror?: () => void } = {};
        queueMicrotask(() => {
            request.result = result;
            request.onsuccess?.();
        });
        return request;
    }

    const fakeDb = {
        objectStoreNames: { contains: () => true },
        transaction(_storeName: string, _mode: string) {
            const tx: { oncomplete?: () => void; onerror?: () => void; objectStore?: () => unknown } = {};
            tx.objectStore = () => ({
                getAll: () => asyncRequest(Array.from(store.values())),
                get: (key: string) => asyncRequest(store.get(key)),
                put: (item: FakeOfflineTrail) => {
                    store.set(item.slug, item);
                    queueMicrotask(() => tx.oncomplete?.());
                    return {};
                },
                delete: (key: string) => {
                    store.delete(key);
                    queueMicrotask(() => tx.oncomplete?.());
                    return {};
                },
            });
            return tx;
        },
    };

    vi.stubGlobal('indexedDB', {
        open: () => {
            const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void } = {};
            queueMicrotask(() => {
                request.result = fakeDb;
                request.onsuccess?.();
            });
            return request;
        },
    });

    vi.stubGlobal('caches', {
        open: async () => ({
            match: async () => undefined,
            put: async () => undefined,
            delete: async () => true,
        }),
    });

    return store;
}

describe('useOfflineTrails shared store', () => {
    beforeEach(() => {
        // The shared store lives in module-level variables, so each test
        // needs a fresh module instance — otherwise state saved/removed in
        // one test would leak into the next.
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it('propagates a remove triggered by one instance to every other mounted instance', async () => {
        installFakeOfflineStorage([
            { slug: 'trail-a', trail: {}, geometry: { type: 'LineString', coordinates: [] }, savedAt: '2024-01-01', tileCount: 0 },
        ]);
        const { useOfflineTrails } = await import('./useOfflineTrails');

        const buttonInstance = renderHook(() => useOfflineTrails());
        const legendInstance = renderHook(() => useOfflineTrails());

        await waitFor(() => expect(buttonInstance.result.current.loading).toBe(false));
        await waitFor(() => expect(legendInstance.result.current.loading).toBe(false));
        expect(buttonInstance.result.current.isOffline('trail-a')).toBe(true);
        expect(legendInstance.result.current.isOffline('trail-a')).toBe(true);

        await act(async () => {
            await buttonInstance.result.current.removeTrailOffline('trail-a');
        });

        // The legend's instance never called removeTrailOffline itself and
        // never remounted — it must still pick up the change live.
        expect(legendInstance.result.current.isOffline('trail-a')).toBe(false);
    });

    it('propagates a save triggered by one instance to every other mounted instance', async () => {
        installFakeOfflineStorage([]);
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ coordinates: [] }),
        })));

        const { useOfflineTrails } = await import('./useOfflineTrails');

        const buttonInstance = renderHook(() => useOfflineTrails());
        const legendInstance = renderHook(() => useOfflineTrails());

        await waitFor(() => expect(buttonInstance.result.current.loading).toBe(false));
        await waitFor(() => expect(legendInstance.result.current.loading).toBe(false));
        expect(legendInstance.result.current.isOffline('trail-b')).toBe(false);

        await act(async () => {
            await buttonInstance.result.current.saveTrailOffline('trail-b');
        });

        expect(legendInstance.result.current.isOffline('trail-b')).toBe(true);
    });
});

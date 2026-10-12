// @vitest-environment jsdom
//
// #1321: CompetitionDetailPage's map used to derive eventTrails by filtering the public bulk
// trail list (GET /api/v1/trails), which excludes EventOnly-status trails server-side — so an
// event linking only EventOnly trails rendered an empty map. useTrailsBySlugs fetches each slug
// individually against the per-trail endpoint instead, which does serve EventOnly trails; this
// test exercises that fetch-and-assemble behaviour directly, mocking global.fetch rather than
// standing up a real backend.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrailsBySlugs, useTrailBySlug, type Trail } from './useTrails';

afterEach(cleanup);

function makeTrail(slug: string, overrides: Partial<Trail> = {}): Trail {
    return {
        id: slug,
        name: slug,
        slug,
        length: 10000,
        elevationGain: 100,
        elevationLoss: 100,
        status: 'EventOnly',
        activityType: 'TrailRunning',
        trailType: 'Loop',
        difficulty: 'Moderate',
        startLatitude: 64.0,
        startLongitude: -19.0,
        locations: [],
        ...overrides,
    };
}

function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// Unlike `wrapper` above (fresh QueryClient per render, used for useTrailsBySlugs in isolation),
// this builds one Wrapper bound to a single, caller-supplied QueryClient instance — needed below
// to prove useTrailsBySlugs and useTrailBySlug don't collide when they share the one app-wide
// QueryClient a real session has (frontend/main.tsx), the way two isolated per-test clients never
// could.
function makeSharedWrapper(queryClient: QueryClient) {
    return function SharedWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

describe('useTrailsBySlugs (#1321)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            const slug = url.split('/').pop();
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(makeTrail(slug!)),
            } as Response);
        }));
    });

    it('fetches every slug individually and returns them as a Trail[], including EventOnly trails', async () => {
        const { result } = renderHook(() => useTrailsBySlugs(['a', 'b', 'c']), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.trails.map(t => t.slug).sort()).toEqual(['a', 'b', 'c']);
        expect(result.current.trails.every(t => t.status === 'EventOnly')).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('returns an empty array without fetching when given no slugs', async () => {
        const { result } = renderHook(() => useTrailsBySlugs([]), { wrapper });

        expect(result.current.trails).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });
});

// #1328 review: useTrailsBySlugs originally reused useTrailBySlug's ['trail', slug] query key,
// but the two hooks cache incompatible shapes (raw Trail vs. `{trail, isFromCache}`). Because the
// app has a single shared QueryClient (frontend/main.tsx), same-session navigation between an
// event page (useTrailsBySlugs) and a trail's own detail/leaderboard/compare page (useTrailBySlug)
// could serve either hook the other's cached shape. These tests render both hooks against one
// shared QueryClient — the isolated-per-test `wrapper` above can never reproduce this, since each
// render gets its own cache — in both read orders, and assert each hook always gets back its own
// shape from its own, independently-fetched cache entry.
describe('useTrailsBySlugs does not collide with useTrailBySlug in a shared QueryClient (#1328)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            const slug = url.split('/').pop();
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(makeTrail(slug!)),
            } as Response);
        }));
    });

    it('useTrailsBySlugs first, then useTrailBySlug for the same slug: each gets its own correctly-shaped data', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const sharedWrapper = makeSharedWrapper(queryClient);

        const bySlugs = renderHook(() => useTrailsBySlugs(['laugavegur']), { wrapper: sharedWrapper });
        await waitFor(() => expect(bySlugs.result.current.loading).toBe(false));
        expect(bySlugs.result.current.trails[0]?.slug).toBe('laugavegur');

        const bySlug = renderHook(() => useTrailBySlug('laugavegur'), { wrapper: sharedWrapper });
        await waitFor(() => expect(bySlug.result.current.loading).toBe(false));

        // If the two hooks shared a cache key, useTrailBySlug would read useTrailsBySlugs' raw
        // Trail back as its cached value — `.trail` would be undefined, not a Trail with a slug.
        expect(bySlug.result.current.trail?.slug).toBe('laugavegur');
        expect(bySlug.result.current.isFromCache).toBe(false);

        expect(queryClient.getQueryData(['event-trail', 'laugavegur'])).toBeTruthy();
        expect(queryClient.getQueryData(['trail', 'laugavegur'])).toEqual({
            trail: expect.objectContaining({ slug: 'laugavegur' }),
            isFromCache: false,
        });
        // Two distinct cache entries means two independent fetches, not one shared/reused response.
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('useTrailBySlug first, then useTrailsBySlugs for the same slug: order does not matter', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const sharedWrapper = makeSharedWrapper(queryClient);

        const bySlug = renderHook(() => useTrailBySlug('laugavegur'), { wrapper: sharedWrapper });
        await waitFor(() => expect(bySlug.result.current.loading).toBe(false));
        expect(bySlug.result.current.trail?.slug).toBe('laugavegur');

        const bySlugs = renderHook(() => useTrailsBySlugs(['laugavegur']), { wrapper: sharedWrapper });
        await waitFor(() => expect(bySlugs.result.current.loading).toBe(false));

        // If useTrailsBySlugs had instead read useTrailBySlug's `{trail, isFromCache}` cache entry
        // as if it were a raw Trail, `.slug` would be undefined here.
        expect(bySlugs.result.current.trails[0]?.slug).toBe('laugavegur');
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

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
import { useTrailsBySlugs, type Trail } from './useTrails';

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

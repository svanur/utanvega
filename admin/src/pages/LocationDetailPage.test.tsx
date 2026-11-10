// @vitest-environment jsdom
//
// #1759: LocationDetailPage had zero test coverage before this file, including the #1746
// idOrSlug canonicalize-navigate effect (LocationDetailPage.tsx:354-358) — a numeric-id URL
// (e.g. a bookmarked `/locations/123`) must replace itself with the slug URL once the location
// loads, while a slug URL that's already canonical must never trigger a redirect loop.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import LocationDetailPage from './LocationDetailPage';
import type { LocationDto } from '../hooks/useLocations';

afterEach(cleanup);

// Mirrors EventDetailPage.test.tsx's convention: mock ../hooks/api's apiFetch directly (not the
// data hooks themselves), via vi.hoisted mock state so it's initialized before this vi.mock
// factory runs (vi.mock is hoisted above regular imports/consts).
const mockState = vi.hoisted(() => ({
  location: null as LocationDto | null,
}));

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string }) => {
    const method = options?.method ?? 'GET';
    if (method !== 'GET') return Promise.resolve({});
    // useLocations()'s unfiltered list (feeds the parent-location Autocomplete) — an empty list
    // is enough, that picker isn't under test here.
    if (/^\/api\/v1\/admin\/locations$/.test(endpoint)) return Promise.resolve([]);
    // #1706's boundary fetch — null is enough, BoundaryEditor's own drawing is out of scope
    // (see the issue's OUT OF SCOPE note).
    if (/^\/api\/v1\/admin\/locations\/[^/]+\/boundary$/.test(endpoint)) {
      return Promise.resolve({ boundaryGeoJson: null });
    }
    // useLocationById(idOrSlug) — the backend resolves either an id or a slug to the same DTO,
    // so the mock does too, regardless of which one the component actually requested.
    if (/^\/api\/v1\/admin\/locations\/[^/]+$/.test(endpoint)) return Promise.resolve(mockState.location);
    return Promise.resolve([]);
  }),
}));

// LocationDetailPage mounts a real Leaflet <MapContainer> (pin/radius picker) plus Geoman's
// polygon BoundaryEditor — both out of scope per the issue ("stub/allow them to mount, don't
// assert on map internals"), and Leaflet measures real pixel layout on mount, which jsdom only
// partially supports. Mirrors frontend/components/TrailMapView.test.tsx's own react-leaflet mock.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Circle: () => null,
  useMap: () => ({
    pm: { addControls: vi.fn(), removeControls: vi.fn(), setGlobalOptions: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    getBounds: vi.fn(() => ({ isValid: () => false, contains: () => false })),
    setView: vi.fn(),
    getZoom: vi.fn(() => 7),
    fitBounds: vi.fn(),
    removeLayer: vi.fn(),
  }),
  useMapEvents: () => null,
}));

// The bundled municipality-boundaries.geojson fetch (LocationDetailPage.tsx:408-421) is a plain
// global fetch(), not apiFetch — stubbed so it resolves to "no bundled boundaries" rather than
// hitting jsdom's absent network stack. Its own .catch() would also swallow a rejection, but a
// resolved not-ok response is the more faithful stand-in for "the asset wasn't found".
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));

function buildLocationFixture(overrides: Partial<LocationDto> = {}): LocationDto {
  return {
    id: '123',
    name: 'Test Location',
    nameEn: null,
    slug: 'test-location',
    description: null,
    descriptionEn: null,
    type: 'Place',
    parentId: null,
    parentName: null,
    latitude: null,
    longitude: null,
    radius: null,
    childrenCount: 0,
    ...overrides,
  };
}

// Sibling of <Routes>, not a child of the routed element — reads the router's own current
// location/navigation-type so the tests below can assert the #1746 effect's `navigate(...,
// { replace: true })` actually replaced the entry (type "REPLACE") rather than pushed a new one
// (type "PUSH"), without reaching into LocationDetailPage's internals.
function NavProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <div data-testid="nav-probe">{location.pathname}|{navigationType}</div>;
}

function renderAt(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <NavProbe />
        <Routes>
          <Route path="/locations/new" element={<LocationDetailPage onNotify={() => {}} />} />
          <Route path="/locations/:idOrSlug" element={<LocationDetailPage onNotify={() => {}} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LocationDetailPage — idOrSlug canonicalize-navigate (#1746, #1759)', () => {
  it('replaces a numeric-id URL with the slug URL once the location loads', async () => {
    mockState.location = buildLocationFixture();

    renderAt('/locations/123');

    await waitFor(() => {
      expect(screen.getByTestId('nav-probe').textContent).toBe('/locations/test-location|REPLACE');
    }, { timeout: 5000 });

    // Proves the edit form itself did load for the resolved location (not just the probe), i.e.
    // the redirect landed on a working page rather than a blank one.
    expect(await screen.findByDisplayValue('Test Location')).not.toBe(null);
  });

  it('does not redirect once settled when the URL is already the canonical slug', async () => {
    mockState.location = buildLocationFixture();

    renderAt('/locations/test-location');

    await screen.findByDisplayValue('Test Location');

    // The initial MemoryRouter entry is itself a "POP" navigation — asserting it stays that way
    // (rather than becoming "REPLACE") proves the effect's `idOrSlug !== location.slug` guard
    // skipped firing, not merely that no visible redirect happened to be observed yet.
    expect(screen.getByTestId('nav-probe').textContent).toBe('/locations/test-location|POP');
  });
});

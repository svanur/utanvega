// @vitest-environment jsdom
//
// #1759: LocationList had zero test coverage before this file.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LocationList } from './LocationList';
import type { LocationDto } from '../hooks/useLocations';

afterEach(cleanup);

// Mirrors EventDetailPage.test.tsx's convention: mock ../hooks/api's apiFetch directly (the
// underlying fetch useLocations() itself calls), via vi.hoisted mock state so it's initialized
// before this vi.mock factory runs (vi.mock is hoisted above regular imports/consts).
const mockState = vi.hoisted(() => ({
  locations: [] as LocationDto[],
}));

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string }) => {
    const method = options?.method ?? 'GET';
    if (method === 'GET' && endpoint.startsWith('/api/v1/admin/locations')) {
      return Promise.resolve(mockState.locations);
    }
    return Promise.resolve({});
  }),
}));

function buildLocationFixture(overrides: Partial<LocationDto> = {}): LocationDto {
  return {
    id: 'loc-1',
    name: 'Reykjavik',
    nameEn: null,
    slug: 'reykjavik',
    description: null,
    descriptionEn: null,
    type: 'Municipality',
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
// location so the "clicking Edit navigates" test below can assert on the actual pathname handleEdit
// (LocationList.tsx:249) sent navigate() to, rather than only on some mocked navigate spy.
function PathProbe() {
  const location = useLocation();
  return <div data-testid="path-probe">{location.pathname}</div>;
}

function renderLocationList(onNotify: (message: string, severity: 'success' | 'error') => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/locations']}>
        <PathProbe />
        <Routes>
          <Route path="/locations" element={<LocationList onNotify={onNotify} />} />
          <Route path="/locations/:idOrSlug" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LocationList — renders the fetched list (#1759)', () => {
  it('shows every fetched location\'s name', async () => {
    mockState.locations = [
      buildLocationFixture({ id: 'loc-1', name: 'Reykjavik', slug: 'reykjavik' }),
      buildLocationFixture({ id: 'loc-2', name: 'Akureyri', slug: 'akureyri', type: 'Municipality' }),
    ];

    renderLocationList();

    expect(await screen.findByText('Reykjavik')).not.toBe(null);
    expect(screen.getByText('Akureyri')).not.toBe(null);
  });

  it('shows a child location nested under its parent in the tree', async () => {
    mockState.locations = [
      buildLocationFixture({ id: 'parent-1', name: 'Capital Region', slug: 'capital-region', type: 'Region', childrenCount: 1 }),
      buildLocationFixture({ id: 'child-1', name: 'Reykjavik', slug: 'reykjavik', parentId: 'parent-1' }),
    ];

    renderLocationList();

    expect(await screen.findByText('Capital Region')).not.toBe(null);
    // buildTree (LocationList.tsx:32) roots only parent-less nodes and nests the rest under their
    // parentId — the child must still be reachable (rendered, not dropped), not necessarily
    // expanded by default.
    const toggle = screen.getByText('Capital Region').closest('tr')!.querySelector('button');
    if (toggle) fireEvent.click(toggle);
    expect(await screen.findByText('Reykjavik')).not.toBe(null);
  });
});

describe('LocationList — Edit action navigates to the location\'s detail page (#1759)', () => {
  afterEach(() => cleanup());

  it('navigates to /locations/:slug when a tree row\'s Edit button is clicked', async () => {
    mockState.locations = [
      buildLocationFixture({ id: 'loc-1', name: 'Reykjavik', slug: 'reykjavik' }),
    ];

    renderLocationList();

    const row = (await screen.findByText('Reykjavik')).closest('tr')!;
    const editButton = within(row).getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('path-probe').textContent).toBe('/locations/reykjavik');
    });
  });

  it('navigates to /locations/:slug when a search-result row\'s Edit button is clicked', async () => {
    // handleEdit (LocationList.tsx:249) is shared by the tree view and the flat search-results
    // view below it — exercising the search path too catches a future regression where only one
    // of the two call sites gets wired up to navigate correctly.
    mockState.locations = [
      buildLocationFixture({ id: 'loc-1', name: 'Reykjavik', slug: 'reykjavik' }),
      buildLocationFixture({ id: 'loc-2', name: 'Akureyri', slug: 'akureyri' }),
    ];

    renderLocationList();
    await screen.findByText('Reykjavik');

    fireEvent.change(screen.getByPlaceholderText('Search locations…'), { target: { value: 'Akur' } });

    const row = (await screen.findByText('Akureyri')).closest('tr')!;
    const editButton = within(row).getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('path-probe').textContent).toBe('/locations/akureyri');
    });
  });
});

// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEvents, EVENTS_QUERY_KEY } from './useEvents';
import { apiFetch } from './api';

// #950: CreateEditionInput's optional `status` field (added in #939/PR #949 for the New Event
// wizard's Step 2) had zero test coverage — createEdition posts `input` verbatim, so nothing
// proved `status` actually survived that passthrough, or that a future refactor couldn't
// silently drop it. useEvents itself uses useQuery/useQueryClient, so renderHook needs a
// QueryClientProvider wrapper, same shape as EventHealth.test.tsx's.

vi.mock('./api', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEvents — createEdition', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends the caller-supplied status unchanged in the POST body', async () => {
    mockedApiFetch.mockResolvedValueOnce([]); // initial events list query
    mockedApiFetch.mockResolvedValueOnce({ id: 'edition-1' }); // createEdition POST

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let editionId: string | undefined;
    await act(async () => {
      editionId = await result.current.createEdition({
        eventId: 'event-1',
        registrationStatus: 'NotStarted',
        status: 'Cancelled',
      });
    });

    expect(editionId).toBe('edition-1');

    const postCall = mockedApiFetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(postCall).toBeDefined();
    const [, options] = postCall!;
    const parsedBody = JSON.parse(options!.body as string);
    expect(parsedBody.status).toBe('Cancelled');
  });

  it('succeeds and sends no status key when the caller omits it', async () => {
    mockedApiFetch.mockResolvedValueOnce([]); // initial events list query
    mockedApiFetch.mockResolvedValueOnce({ id: 'edition-2' }); // createEdition POST

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let editionId: string | undefined;
    await act(async () => {
      editionId = await result.current.createEdition({
        eventId: 'event-1',
        registrationStatus: 'NotStarted',
      });
    });

    expect(editionId).toBe('edition-2');

    const postCall = mockedApiFetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(postCall).toBeDefined();
    const [, options] = postCall!;
    const parsedBody = JSON.parse(options!.body as string);
    expect('status' in parsedBody).toBe(false);
  });

  it('invalidates the events query cache after a successful createEdition call', async () => {
    mockedApiFetch.mockResolvedValueOnce([]); // initial events list query
    mockedApiFetch.mockResolvedValueOnce({ id: 'edition-3' }); // createEdition POST

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createEdition({
        eventId: 'event-1',
        registrationStatus: 'NotStarted',
        status: 'Active',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }),
    );
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventHealth from './EventHealth';

// #859: EventHealth.tsx:118-129 seeds activeFilter from initialFilter via a useState
// initializer, then a mount-only useEffect ([] deps) calls onInitialFilterConsumed() exactly
// once so the value doesn't leak into a later, unrelated visit (App.tsx:134,362,374-378 owns
// the state and clears it via that callback). This is the second fix at this class of bug
// (#837 -> #849 -> PR #858) with nothing locking it in — this renders the real component and
// asserts the callback wiring end to end, the same shape as
// components/events/RaceFormCard.test.tsx, rather than testing an extracted pure function.

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn().mockResolvedValue([]),
}));

function renderEventHealth(initialFilter?: 'no-date') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onInitialFilterConsumed = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <EventHealth
        onNotify={() => {}}
        initialFilter={initialFilter}
        onInitialFilterConsumed={onInitialFilterConsumed}
      />
    </QueryClientProvider>,
  );

  return { onInitialFilterConsumed };
}

describe('EventHealth — initialFilter mount/consume wiring', () => {
  afterEach(cleanup);

  it('calls onInitialFilterConsumed exactly once on mount when initialFilter is set', async () => {
    const { onInitialFilterConsumed } = renderEventHealth('no-date');

    await waitFor(() => expect(onInitialFilterConsumed).toHaveBeenCalledTimes(1));
  });

  it('does not call onInitialFilterConsumed when initialFilter is undefined', async () => {
    const { onInitialFilterConsumed } = renderEventHealth(undefined);

    // There's nothing async to await for the negative case, so give any stray effect a tick
    // to fire before asserting it never did.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onInitialFilterConsumed).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventHealth, { getHealthChecks, scoreFromChecks, scoreColor } from './EventHealth';
import type { EventSummaryDto } from '../hooks/useEvents';

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

  it('seeds activeFilter from initialFilter on mount, rendering the Filtered chip', async () => {
    renderEventHealth('no-date');

    await waitFor(() => expect(screen.getByText('Filtered: no date')).toBeTruthy());
  });

  it('does not call onInitialFilterConsumed when initialFilter is undefined', async () => {
    const { onInitialFilterConsumed } = renderEventHealth(undefined);

    // There's nothing async to await for the negative case, so deterministically flush any
    // pending mount effects/microtasks before asserting one never fired.
    await act(async () => {});
    expect(onInitialFilterConsumed).not.toHaveBeenCalled();
  });
});

// #1842: getHealthChecks/scoreFromChecks/scoreColor are exported from here for reuse by
// EventDetailPage.tsx's inline completeness banner — EventDetailPage's EventDetailDto extends
// EventSummaryDto, so it's fed straight into getHealthChecks unchanged. These exercise the pure
// check-generation/scoring logic directly, the same style as EditionHealth.test.tsx's
// getEditionChecks/getRaceChecks coverage, rather than rendering the dashboard.
function makeEvent(overrides: Partial<EventSummaryDto> = {}): EventSummaryDto {
  return {
    id: 'event-1',
    name: 'Example Race',
    nameEn: null,
    slug: 'example-race',
    description: 'A well-described race through the hills.',
    descriptionEn: null,
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Active',
    organizerName: 'Example Club',
    organizerNameEn: null,
    organizerWebsite: null,
    organizerId: null,
    organizerSlug: null,
    alertMessage: null,
    alertMessageEn: null,
    alertSeverity: null,
    locationId: 'loc-1',
    locationName: 'Reykjavík',
    locationType: 'Place',
    scheduleRule: { type: 'Fixed', date: '2024-06-01' },
    socialLinks: null,
    nextEditionDate: '2024-06-01',
    daysUntil: 10,
    editionCount: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    seriesRaces: null,
    gpxPointLat: 64.1,
    gpxPointLng: -21.9,
    isMountainRace: false,
    terrainType: null,
    hasFutureEdition: true,
    endDisplayDate: null,
    editionStatus: 'Confirmed',
    editionEffectiveCancelled: false,
    anyEditionNeedsReview: false,
    anyEditionUnconfirmed: false,
    ...overrides,
  };
}

function checkByLabel(checks: ReturnType<typeof getHealthChecks>, label: string) {
  return checks.find(c => c.label === label);
}

describe('getHealthChecks / scoreFromChecks / scoreColor — EventSummaryDto', () => {
  it('scores 100 for a fully-complete Race event with every check applicable and passed', () => {
    const checks = getHealthChecks(makeEvent());

    expect(checks.every(c => c.na || c.passed)).toBe(true);
    expect(scoreFromChecks(checks)).toBe(100);
    expect(scoreColor(scoreFromChecks(checks))).toBe('success');
  });

  it('marks Editions and Next Date N/A for an Advertisement, excluding them from the score', () => {
    const checks = getHealthChecks(makeEvent({ type: 'Advertisement', nextEditionDate: null, editionCount: 0 }));

    expect(checkByLabel(checks, 'Next Date')!.na).toBe(true);
    expect(checkByLabel(checks, 'Editions')!.na).toBe(true);
    // None of the remaining applicable checks are failed by this fixture, so an Advertisement
    // with no editions/next date still scores 100 once those two are excluded.
    expect(scoreFromChecks(checks)).toBe(100);
  });

  it('marks Editions N/A (but not Next Date) for a Series event', () => {
    const checks = getHealthChecks(makeEvent({ type: 'Series' }));

    expect(checkByLabel(checks, 'Editions')!.na).toBe(true);
    expect(checkByLabel(checks, 'Next Date')!.na).toBe(false);
  });

  it('fails Location, GPX Pin, Climate Precision and Organizer when none are set, dragging the score down', () => {
    const checks = getHealthChecks(makeEvent({
      locationId: null, locationName: null, locationType: null,
      gpxPointLat: null, gpxPointLng: null,
      organizerName: null, organizerWebsite: null,
    }));

    expect(checkByLabel(checks, 'Location')!.passed).toBe(false);
    expect(checkByLabel(checks, 'GPX Pin')!.passed).toBe(false);
    // No location at all means Climate Precision is N/A — already covered by the Location check.
    expect(checkByLabel(checks, 'Climate Precision')!.na).toBe(true);
    expect(checkByLabel(checks, 'Organizer')!.passed).toBe(false);
    expect(scoreFromChecks(checks)).toBeLessThan(100);
  });

  it('fails Published when status is not Active', () => {
    const checks = getHealthChecks(makeEvent({ status: 'Hidden' }));

    expect(checkByLabel(checks, 'Published')!.passed).toBe(false);
    expect(scoreColor(scoreFromChecks(checks))).not.toBe('success');
  });
});

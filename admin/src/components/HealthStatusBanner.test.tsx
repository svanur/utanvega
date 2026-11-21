// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HealthStatusBanner, { HealthScoreBadge } from './HealthStatusBanner';

// #1842: this is the shared presentational piece TrailDetailPage.tsx and EventDetailPage.tsx
// mount with whichever Health-Dashboard check list/score the page already computed (see
// TrailHealth.test.tsx's and EventHealth.test.tsx's own coverage of that logic) — these cover
// the banner/badge's own rendering rules in isolation, with hand-built HealthBannerCheck fixtures
// rather than a real Trail/Event.

const scoreColor = (score: number): 'success' | 'warning' | 'error' => {
  if (score >= 100) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
};

describe('HealthStatusBanner', () => {
  afterEach(cleanup);

  it('renders the ready-to-publish banner and no check chips at score 100', () => {
    render(<HealthStatusBanner checks={[]} score={100} scoreColor={scoreColor} />);

    expect(screen.getByText('Ready to publish')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('accepts a custom readyLabel', () => {
    render(<HealthStatusBanner checks={[]} score={100} scoreColor={scoreColor} readyLabel="All good" />);

    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders a failing-count summary, collapsed by default, below 100', () => {
    const checks = [
      { label: 'Description', passed: false, tooltip: 'No description' },
      { label: 'Distance', passed: true, tooltip: '5.0 km' },
    ];
    render(<HealthStatusBanner checks={checks} score={50} scoreColor={scoreColor} />);

    expect(screen.getByText('1 check failing')).toBeTruthy();
    expect(screen.queryByText('Description: No description')).toBeNull();
  });

  it('expands to list exactly the failing checks (label + tooltip) on click, not the passed ones', () => {
    const checks = [
      { label: 'Description', passed: false, tooltip: 'No description' },
      { label: 'Distance', passed: true, tooltip: '5.0 km' },
    ];
    render(<HealthStatusBanner checks={checks} score={50} scoreColor={scoreColor} />);

    fireEvent.click(screen.getByText('1 check failing'));

    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.queryByText('Distance')).toBeNull();
  });

  it('pluralizes the failing-check count correctly', () => {
    const checks = [
      { label: 'Description', passed: false, tooltip: '' },
      { label: 'GPX Data', passed: false, tooltip: '' },
      { label: 'Distance', passed: true, tooltip: '' },
    ];
    render(<HealthStatusBanner checks={checks} score={33} scoreColor={scoreColor} />);

    expect(screen.getByText('2 checks failing')).toBeTruthy();
  });
});

describe('HealthScoreBadge', () => {
  afterEach(cleanup);

  it('renders the score percentage', () => {
    render(<HealthScoreBadge score={75} scoreColor={scoreColor} />);

    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('renders 100% for a fully-healthy entity', () => {
    render(<HealthScoreBadge score={100} scoreColor={scoreColor} />);

    expect(screen.getByText('100%')).toBeTruthy();
  });
});

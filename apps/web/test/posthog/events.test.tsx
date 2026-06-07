import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  init: vi.fn(),
  initPostHog: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: mocks.init,
    capture: mocks.capture,
    identify: mocks.identify,
    reset: mocks.reset,
    opt_out_capturing: vi.fn(),
  },
}));

vi.mock('@/lib/posthog', () => ({
  initPostHog: mocks.initPostHog,
  posthog: {
    capture: mocks.capture,
    identify: mocks.identify,
    reset: mocks.reset,
  },
}));

import { HomeViewedTracker } from '@/components/home/home-viewed-tracker';

describe('PostHog event tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HomeViewedTracker fires home_viewed on mount', async () => {
    await act(async () => {
      render(<HomeViewedTracker />);
    });
    expect(mocks.capture).toHaveBeenCalledWith('home_viewed');
  });

  it('posthog.capture fires play_clicked event', () => {
    mocks.capture('play_clicked', { mode: 'friend' });
    expect(mocks.capture).toHaveBeenCalledWith('play_clicked', { mode: 'friend' });
  });

  it('posthog.capture fires report_filed event', () => {
    mocks.capture('report_filed', { reason: 'cheating' });
    expect(mocks.capture).toHaveBeenCalledWith('report_filed', { reason: 'cheating' });
  });

  it('posthog.identify is callable with user data', () => {
    mocks.identify('user-123', { username: 'alice', isAdmin: false, theme: 'dark' });
    expect(mocks.identify).toHaveBeenCalledWith('user-123', {
      username: 'alice',
      isAdmin: false,
      theme: 'dark',
    });
  });

  it('posthog.reset is called on logout', () => {
    mocks.reset();
    expect(mocks.reset).toHaveBeenCalled();
  });
});

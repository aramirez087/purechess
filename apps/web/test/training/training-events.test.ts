import { vi, describe, it, expect, beforeEach } from 'vitest';

// The helper lazily `import('@/lib/posthog')` and calls `posthog.capture`. Mock
// that module so we can assert the exact event names + property shapes the
// documented training taxonomy emits — the single source of truth for the funnel.
const mocks = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock('@/lib/posthog', () => ({
  initPostHog: vi.fn(),
  posthog: { capture: mocks.capture },
}));

import {
  TRAINING_EVENTS,
  trainingPlanViewed,
  puzzleStarted,
  puzzleSolved,
  puzzleFailed,
  rushRunFinished,
  reviewSessionCompleted,
  openingDrillCompleted,
  endgameAttempt,
  insightViewed,
  insightActionClicked,
  streakAdvanced,
} from '@/lib/analytics/training-events';

/** Wait until `n` capture calls have landed (the lazy import resolves async). */
async function flush(n = 1) {
  const deadline = Date.now() + 1000;
  while (mocks.capture.mock.calls.length < n && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

/**
 * jsdom quirk: two fire-and-forget dynamic `import()`s in the SAME tick collapse
 * to one resolved `.then` under vitest (a real browser fires both). So when a
 * test exercises two events, space them across a macrotask and assert each
 * landed before firing the next. The production helper stays fire-and-forget.
 */
async function tick() {
  await new Promise((r) => setTimeout(r, 5));
}

describe('training-events taxonomy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the full documented event-name set', () => {
    expect(Object.values(TRAINING_EVENTS).sort()).toEqual(
      [
        'endgame_attempt',
        'insight_action_clicked',
        'insight_viewed',
        'opening_drill_completed',
        'puzzle_failed',
        'puzzle_solved',
        'puzzle_started',
        'review_session_completed',
        'rush_run_finished',
        'streak_advanced',
        'training_plan_viewed',
      ].sort(),
    );
  });

  it('training_plan_viewed carries the item count', async () => {
    trainingPlanViewed(4);
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('training_plan_viewed', { itemCount: 4 });
  });

  it('puzzle_started carries source + theme (null when absent)', async () => {
    puzzleStarted('theme', 'fork');
    await flush(1);
    await tick();
    puzzleStarted('daily');
    await flush(2);
    expect(mocks.capture).toHaveBeenNthCalledWith(1, 'puzzle_started', {
      source: 'theme',
      theme: 'fork',
    });
    expect(mocks.capture).toHaveBeenNthCalledWith(2, 'puzzle_started', {
      source: 'daily',
      theme: null,
    });
  });

  it('puzzle_solved / puzzle_failed carry source, theme, rating', async () => {
    puzzleSolved({ source: 'rush', theme: 'pin', rating: 1620 });
    await flush(1);
    await tick();
    puzzleFailed({ source: 'review' });
    await flush(2);
    expect(mocks.capture).toHaveBeenNthCalledWith(1, 'puzzle_solved', {
      source: 'rush',
      theme: 'pin',
      rating: 1620,
    });
    expect(mocks.capture).toHaveBeenNthCalledWith(2, 'puzzle_failed', {
      source: 'review',
      theme: null,
      rating: null,
    });
  });

  it('rush_run_finished carries mode + score', async () => {
    rushRunFinished('3min', 23);
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('rush_run_finished', { mode: '3min', score: 23 });
  });

  it('review_session_completed carries the count', async () => {
    reviewSessionCompleted(7);
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('review_session_completed', { count: 7 });
  });

  it('opening_drill_completed carries lines + accuracy', async () => {
    openingDrillCompleted({ lines: 5, accuracy: 80 });
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('opening_drill_completed', {
      lines: 5,
      accuracy: 80,
    });
  });

  it('endgame_attempt carries slug + succeeded', async () => {
    endgameAttempt('lucena', true);
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('endgame_attempt', {
      slug: 'lucena',
      succeeded: true,
    });
  });

  it('insight_viewed / insight_action_clicked carry kind', async () => {
    insightViewed('theme');
    await flush(1);
    await tick();
    insightActionClicked('opening');
    await flush(2);
    expect(mocks.capture).toHaveBeenNthCalledWith(1, 'insight_viewed', { kind: 'theme' });
    expect(mocks.capture).toHaveBeenNthCalledWith(2, 'insight_action_clicked', { kind: 'opening' });
  });

  it('streak_advanced carries n', async () => {
    streakAdvanced(9);
    await flush();
    expect(mocks.capture).toHaveBeenCalledWith('streak_advanced', { n: 9 });
  });
});

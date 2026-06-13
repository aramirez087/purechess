import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import type {
  InsightDto,
  PuzzleDto,
  PuzzleThemeStatDto,
  RushMode,
  TrainingPlanDto,
  TrainingStreakDto,
} from '@purechess/shared';

/**
 * Session 15 a11y regression net for the training surfaces. Asserts REAL
 * accessible names/roles (not snapshots) on the theme tile, plan rows, rush
 * HUD, insight cards, and streak calendar, and that the polite live region
 * fires the verdict on a solve outcome — the SR counterpart to the visual,
 * aria-hidden result overlays.
 */

// --- Shared mocks -----------------------------------------------------------

vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

vi.mock('@/components/board/board-context', () => ({
  BoardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBoardSettings: () => ({
    settings: { sound: true, coordinates: false, animationMs: 200 },
    updateSettings: () => {},
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Board → a button that emits the configured solving move when clicked.
let currentMove = '';
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({ onMove }: { onMove?: (m: { from: string; to: string }) => void }) => (
    <div role="grid" aria-label="Chess board" tabIndex={0}>
      <button
        type="button"
        data-testid="solve-btn"
        onClick={() => onMove?.({ from: currentMove.slice(0, 2), to: currentMove.slice(2, 4) })}
      >
        board
      </button>
    </div>
  ),
}));

vi.mock('@/lib/api/puzzles', () => ({
  fetchNextPuzzle: vi.fn(),
  fetchPuzzleStats: vi.fn(),
  recordAttempt: vi.fn(),
}));

import { ThemeTile } from '@/components/puzzle/theme-tile';
import { RushHud } from '@/components/puzzle/rush-hud';
import { DailyPlan } from '@/components/training/daily-plan';
import { StreakBanner } from '@/components/training/streak-banner';
import { InsightsClient } from '@/app/train/insights/insights-client';
import { TrainingSession } from '@/components/puzzle/training-session';
import { fetchNextPuzzle, fetchPuzzleStats, recordAttempt } from '@/lib/api/puzzles';

afterEach(() => {
  vi.clearAllMocks();
});

describe('ThemeTile a11y', () => {
  it('is a button whose accessible name carries the theme and accuracy', () => {
    render(<ThemeTile slug="fork" label="Fork" puzzleCount={1200} attempts={20} accuracy={0.45} />);
    const tile = screen.getByRole('button', { name: 'Train Fork, 45% accuracy' });
    expect(tile).toBeTruthy();
    // Accuracy is paired with a text label, never color alone.
    expect(within(tile).getByText('45% accuracy')).toBeTruthy();
  });

  it('drops the accuracy from the name when never attempted', () => {
    render(<ThemeTile slug="pin" label="Pin" attempts={0} />);
    expect(screen.getByRole('button', { name: 'Train Pin' })).toBeTruthy();
  });
});

describe('DailyPlan plan items a11y', () => {
  const plan: TrainingPlanDto = {
    date: '2026-06-13',
    dailyGoalPuzzles: 10,
    puzzlesSolvedToday: 3,
    estimatedMinutes: 10,
    items: [
      {
        kind: 'theme',
        label: 'Train 8 fork puzzles',
        target: 8,
        doneToday: 2,
        href: '/puzzles/train?theme=fork',
        completed: false,
      },
      {
        kind: 'review',
        label: 'Clear 5 reviews',
        target: 5,
        doneToday: 5,
        href: '/puzzles/review',
        completed: true,
      },
    ],
  };

  it('renders each plan item as a labelled row with a reachable CTA', () => {
    render(<DailyPlan plan={plan} />);
    const rows = screen.getAllByTestId('plan-row');
    expect(rows).toHaveLength(2);
    // Each row exposes its label text and a progress readout.
    expect(within(rows[0]).getByText('Train 8 fork puzzles')).toBeTruthy();
    expect(within(rows[0]).getByText('2 / 8')).toBeTruthy();
    // The active row's CTA is a real link (keyboard-reachable).
    const cta = within(rows[0]).getByRole('link', { name: /Train/ });
    expect(cta.getAttribute('href')).toBe('/puzzles/train?theme=fork');
  });

  it('gives the goal ring a text-equivalent accessible name', () => {
    render(<DailyPlan plan={plan} />);
    const ring = screen.getByTestId('goal-ring');
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toBe('3 of 10 daily puzzles');
  });
});

describe('RushHud a11y', () => {
  it('labels strikes-remaining, score, and combo with real text', () => {
    render(<RushHud mode="5strikes" strikes={2} score={7} combo={3} />);
    expect(screen.getByLabelText('3 strikes left')).toBeTruthy();
    expect(screen.getByTestId('rush-score').textContent).toBe('7');
    expect(screen.getByLabelText('Combo 3')).toBeTruthy();
  });

  it('keeps the live countdown out of the live region (no per-tick chatter)', () => {
    render(<RushHud mode={'3min' as RushMode} timeMs={12_000} strikes={0} score={4} combo={0} />);
    const clock = screen.getByTestId('rush-clock');
    expect(clock.getAttribute('aria-live')).toBe('off');
  });
});

describe('InsightsClient cards a11y', () => {
  const insight: InsightDto = {
    weaknesses: [
      {
        area: 'theme',
        kind: 'theme',
        slug: 'fork',
        label: 'Forks',
        title: 'Forks are costing you games',
        evidence: '38% on forks over 47 puzzles',
        actionHref: '/puzzles/train?theme=fork',
      },
      {
        area: 'endgame',
        kind: 'endgame',
        slug: 'rook',
        label: 'Rook endings',
        title: 'Rook endings need work',
        evidence: '2 of 6 drills unsolved',
        actionHref: '/endgames',
      },
    ],
  };

  it('renders each weakness as a card with a heading, evidence, and a labelled action', () => {
    render(<InsightsClient signedIn insight={insight} />);
    const cards = screen.getAllByTestId('insight-card');
    expect(cards).toHaveLength(2);

    // Heading text is real and reachable as a heading.
    expect(
      within(cards[0]).getByRole('heading', { name: 'Forks are costing you games' }),
    ).toBeTruthy();
    expect(within(cards[0]).getByTestId('insight-evidence').textContent).toBe(
      '38% on forks over 47 puzzles',
    );
    // The "fix it" action is a real link to the drill.
    const action = within(cards[0]).getByRole('link', { name: /Drill it/ });
    expect(action.getAttribute('href')).toBe('/puzzles/train?theme=fork');
  });
});

describe('StreakBanner calendar a11y', () => {
  it('summarizes activity as a text-equivalent image label', () => {
    const streak: TrainingStreakDto = {
      currentStreak: 4,
      longestStreak: 9,
      dailyGoalPuzzles: 10,
      history: [
        { day: '2026-06-13', puzzlesSolved: 6, reviewsDone: 0, drillsDone: 0 },
        { day: '2026-06-12', puzzlesSolved: 3, reviewsDone: 2, drillsDone: 0 },
      ],
    };
    render(<StreakBanner streak={streak} />);
    const cal = screen.getByTestId('streak-calendar');
    expect(cal.getAttribute('role')).toBe('img');
    expect(cal.getAttribute('aria-label')).toContain('Current streak 4 days');
    expect(cal.getAttribute('aria-label')).toMatch(/active on \d+ of the last 84 days/);
  });
});

describe('TrainingSession live-region announcement', () => {
  const SOLVE_MOVE = 'f3g5';
  const PUZZLE: PuzzleDto = {
    id: 'pz-a11y',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B5/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    moves: [SOLVE_MOVE],
    rating: 1500,
    themes: ['fork'],
  };

  beforeEach(() => {
    currentMove = SOLVE_MOVE;
    vi.mocked(fetchNextPuzzle).mockResolvedValue(PUZZLE);
    vi.mocked(fetchPuzzleStats).mockResolvedValue([] as PuzzleThemeStatDto[]);
    vi.mocked(recordAttempt).mockResolvedValue({
      puzzleId: 'pz-a11y',
      solved: true,
      ratingBefore: 1500,
      ratingAfter: 1508,
      ratingDelta: 8,
    });
  });

  it('announces the verdict and progress in a polite live region on a solve', async () => {
    render(<TrainingSession theme="fork" source="theme" target={3} />);

    const region = screen.getByTestId('training-announcer');
    // role=status / aria-live=polite — the SR contract.
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('role')).toBe('status');
    // Silent before any attempt.
    expect(region.textContent).toBe('');

    const btn = await screen.findByTestId('solve-btn');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('training-announcer').textContent).toBe('Correct. Solved 1 of 3.');
    });
  });

  it('announces "not the move" on a wrong attempt', async () => {
    currentMove = 'a2a3'; // legal but not the solution
    render(<TrainingSession theme="fork" source="theme" target={3} />);

    const btn = await screen.findByTestId('solve-btn');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('training-announcer').textContent).toBe(
        'Not the move — try again.',
      );
    });
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TrainingDayDto, TrainingPlanDto, TrainingStreakDto } from '@purechess/shared';
import { DailyPlan } from '@/components/training/daily-plan';
import { StreakBanner, buildCalendar } from '@/components/training/streak-banner';
import { TrainClient } from '@/app/train/train-client';

function plan(over: Partial<TrainingPlanDto> = {}): TrainingPlanDto {
  return {
    date: '2026-06-13',
    items: [],
    dailyGoalPuzzles: 10,
    puzzlesSolvedToday: 0,
    estimatedMinutes: 0,
    ...over,
  };
}

function streak(over: Partial<TrainingStreakDto> = {}): TrainingStreakDto {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastTrainedOn: null,
    dailyGoalPuzzles: 10,
    goalMetToday: false,
    history: [],
    ...over,
  };
}

describe('DailyPlan', () => {
  it('renders each plan item as a row with its label and CTA href', () => {
    render(
      <DailyPlan
        plan={plan({
          items: [
            { kind: 'daily', label: 'Solve the daily puzzle', target: 1, href: '/puzzles' },
            {
              kind: 'theme',
              label: 'Solve 5 Forks puzzles',
              target: 5,
              doneToday: 2,
              href: '/puzzles/train?theme=fork',
            },
          ],
        })}
      />,
    );
    const rows = screen.getAllByTestId('plan-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/puzzles');
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/puzzles/train?theme=fork');
    // The multi-target item shows "2 / 5" progress; the single-target one doesn't.
    expect(within(rows[1]).getByTestId('plan-progress')).toHaveTextContent('2 / 5');
    expect(within(rows[0]).queryByTestId('plan-progress')).toBeNull();
  });

  it('marks a completed item done (strike + completed flag) and not the rest', () => {
    render(
      <DailyPlan
        plan={plan({
          items: [
            { kind: 'daily', label: 'Daily', target: 1, doneToday: 1, completed: true, href: '/puzzles' },
            { kind: 'review', label: 'Review 5', target: 5, doneToday: 1, completed: false, href: '/puzzles/review' },
          ],
        })}
      />,
    );
    const rows = screen.getAllByTestId('plan-row');
    expect(rows[0]).toHaveAttribute('data-completed', 'true');
    expect(rows[1]).toHaveAttribute('data-completed', 'false');
  });

  it('shows "Done for today" only when every item is complete', () => {
    const { rerender } = render(
      <DailyPlan
        plan={plan({
          items: [{ kind: 'daily', label: 'Daily', target: 1, completed: true, href: '/puzzles' }],
        })}
      />,
    );
    expect(screen.getByTestId('plan-done')).toBeInTheDocument();

    rerender(
      <DailyPlan
        plan={plan({
          items: [
            { kind: 'daily', label: 'Daily', target: 1, completed: true, href: '/puzzles' },
            { kind: 'review', label: 'Review', target: 5, completed: false, href: '/puzzles/review' },
          ],
        })}
      />,
    );
    expect(screen.queryByTestId('plan-done')).toBeNull();
  });

  it('fills the goal ring and shows the met state at goal', () => {
    const { rerender } = render(
      <DailyPlan plan={plan({ dailyGoalPuzzles: 10, puzzlesSolvedToday: 4 })} />,
    );
    const ring = screen.getByTestId('goal-ring');
    expect(ring).toHaveAttribute('data-met', 'false');
    expect(ring).toHaveAttribute('aria-label', '4 of 10 daily puzzles');

    rerender(<DailyPlan plan={plan({ dailyGoalPuzzles: 10, puzzlesSolvedToday: 10 })} />);
    expect(screen.getByTestId('goal-ring')).toHaveAttribute('data-met', 'true');
  });

  it('shows an empty state when there are no items', () => {
    render(<DailyPlan plan={plan({ items: [] })} />);
    expect(screen.getByTestId('plan-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-done')).toBeNull();
  });
});

describe('StreakBanner', () => {
  it('shows the current + longest streak figures', () => {
    render(<StreakBanner streak={streak({ currentStreak: 5, longestStreak: 12 })} />);
    expect(within(screen.getByTestId('streak-current')).getByText('5')).toBeInTheDocument();
    expect(within(screen.getByTestId('streak-longest')).getByText('12')).toBeInTheDocument();
  });

  it('renders a calendar cell per recent day', () => {
    render(<StreakBanner streak={streak({ currentStreak: 1, longestStreak: 1 })} />);
    // 12 weeks * 7 days.
    expect(screen.getAllByTestId('streak-cell')).toHaveLength(84);
  });
});

describe('buildCalendar (pure)', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('produces `total` cells oldest-first ending today, marking active days', () => {
    const history: TrainingDayDto[] = [
      { day: today, puzzlesSolved: 3, reviewsDone: 0, drillsDone: 0 },
    ];
    const cells = buildCalendar(history, 7);
    expect(cells).toHaveLength(7);
    expect(cells[cells.length - 1].day).toBe(today);
    expect(cells[cells.length - 1]).toMatchObject({ count: 3, active: true });
    // A day with no history is inactive with count 0.
    expect(cells[0].active).toBe(false);
  });

  it('sums all activity kinds into the day count', () => {
    const cells = buildCalendar(
      [{ day: today, puzzlesSolved: 2, reviewsDone: 3, drillsDone: 1 }],
      3,
    );
    expect(cells[cells.length - 1].count).toBe(6);
  });
});

describe('TrainClient', () => {
  it('signed out: shows the sign-in pitch + the daily puzzle, no plan', () => {
    render(<TrainClient signedIn={false} plan={null} streak={null} insight={null} />);
    expect(screen.getByTestId('train-signin')).toBeInTheDocument();
    expect(screen.getByTestId('signed-out-daily')).toHaveAttribute('href', '/puzzles');
    expect(screen.queryByTestId('daily-plan')).toBeNull();
    expect(screen.queryByTestId('mode-grid')).toBeNull();
  });

  it('signed in: shows the plan, streak banner, mode grid, and the review due badge', () => {
    render(
      <TrainClient
        signedIn={true}
        streak={streak({ currentStreak: 3, longestStreak: 9 })}
        plan={plan({
          items: [
            { kind: 'review', label: 'Review 5 puzzles', target: 5, doneToday: 1, href: '/puzzles/review' },
          ],
          puzzlesSolvedToday: 1,
        })}
        insight={{ weaknesses: [] }}
      />,
    );
    expect(screen.getByTestId('daily-plan')).toBeInTheDocument();
    expect(screen.getByTestId('streak-banner')).toBeInTheDocument();
    expect(screen.getByTestId('mode-grid')).toBeInTheDocument();
    // 4 due remaining (5 target - 1 done) → badge shows 4.
    expect(screen.getByTestId('review-due-badge')).toHaveTextContent('4');
  });

  it('signed in: renders the Focus one-liner from the top insight', () => {
    render(
      <TrainClient
        signedIn={true}
        streak={streak()}
        plan={plan()}
        insight={{
          headline: 'Forks are costing you',
          weaknesses: [
            {
              area: 'theme',
              kind: 'theme',
              label: 'Forks',
              title: 'Forks are costing you games',
              evidence: '38% on forks over 47 puzzles',
              actionHref: '/puzzles/train?theme=fork',
            },
          ],
        }}
      />,
    );
    const focus = screen.getByTestId('focus-line');
    expect(focus).toHaveAttribute('href', '/puzzles/train?theme=fork');
    expect(focus).toHaveTextContent('Forks are costing you games');
    expect(focus).toHaveTextContent('38% on forks over 47 puzzles');
  });

  it('signed in: every mode is reachable from the grid', () => {
    render(
      <TrainClient signedIn={true} streak={streak()} plan={plan()} insight={{ weaknesses: [] }} />,
    );
    const hrefs = screen
      .getAllByTestId('mode-tile')
      .map((t) => t.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/puzzles',
        '/puzzles/train',
        '/puzzles/rush',
        '/puzzles/review',
        '/openings',
        '/endgames',
        '/puzzles/stats',
        '/train/insights',
      ]),
    );
  });
});

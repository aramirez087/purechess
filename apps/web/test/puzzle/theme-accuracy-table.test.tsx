import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { PuzzleThemeStatDto } from '@purechess/shared';
import {
  ThemeAccuracyTable,
  sortWeakestFirst,
} from '@/components/puzzle/theme-accuracy-table';

function stat(over: Partial<PuzzleThemeStatDto> & { slug: string }): PuzzleThemeStatDto {
  const attempts = over.attempts ?? 10;
  const accuracy = over.accuracy ?? 0.5;
  return {
    label: over.label,
    attempts,
    accuracy,
    solved: over.solved ?? Math.round(accuracy * attempts),
    ...over,
  };
}

// Mixed accuracies that exercise all three color bands + the <50% warning.
const STATS: PuzzleThemeStatDto[] = [
  stat({ slug: 'fork', accuracy: 0.85, attempts: 20 }), // high (green)
  stat({ slug: 'pin', accuracy: 0.35, attempts: 12 }), // low (red), <50 → ⚠
  stat({ slug: 'skewer', accuracy: 0.6, attempts: 15 }), // mid (yellow)
  stat({ slug: 'mateIn2', accuracy: 0.42, attempts: 8 }), // low (red), <50 → ⚠
];

function rowSlugsInOrder(): string[] {
  return screen
    .getAllByTestId('theme-accuracy-row')
    .map((r) => r.getAttribute('data-slug') as string);
}

describe('ThemeAccuracyTable', () => {
  it('orders rows weakest-first (accuracy ASC)', () => {
    render(<ThemeAccuracyTable stats={STATS} />);
    expect(rowSlugsInOrder()).toEqual(['pin', 'mateIn2', 'skewer', 'fork']);
  });

  it('tie-breaks equal accuracy by larger sample, then slug', () => {
    render(
      <ThemeAccuracyTable
        stats={[
          stat({ slug: 'beta', accuracy: 0.5, attempts: 5 }),
          stat({ slug: 'alpha', accuracy: 0.5, attempts: 5 }),
          stat({ slug: 'gamma', accuracy: 0.5, attempts: 30 }),
        ]}
      />,
    );
    // larger sample first (gamma), then slug ASC (alpha before beta)
    expect(rowSlugsInOrder()).toEqual(['gamma', 'alpha', 'beta']);
  });

  it('renders the ⚠ marker only on themes under 50%', () => {
    render(<ThemeAccuracyTable stats={STATS} />);
    const rows = screen.getAllByTestId('theme-accuracy-row');
    const warnBySlug = new Map(
      rows.map((r) => [r.getAttribute('data-slug'), within(r).queryAllByText('⚠').length > 0]),
    );
    expect(warnBySlug.get('pin')).toBe(true); // 35% → warned
    expect(warnBySlug.get('mateIn2')).toBe(true); // 42% → warned
    expect(warnBySlug.get('skewer')).toBe(false); // 60% → no warning
    expect(warnBySlug.get('fork')).toBe(false); // 85% → no warning
  });

  it('applies the shared color band to the accuracy figure', () => {
    render(<ThemeAccuracyTable stats={STATS} />);
    const rowFor = (slug: string) =>
      screen.getAllByTestId('theme-accuracy-row').find((r) => r.getAttribute('data-slug') === slug)!;

    // <50 → acc-low (red), <70 → acc-mid (yellow), >=70 → acc-high (green).
    expect(within(rowFor('pin')).getByText('35%').className).toContain('acc-low');
    expect(within(rowFor('skewer')).getByText('60%').className).toContain('acc-mid');
    expect(within(rowFor('fork')).getByText('85%').className).toContain('acc-high');

    // The bar uses the matching background band.
    expect(within(rowFor('pin')).getByTestId('accuracy-bar').className).toContain('acc-bg-low');
    expect(within(rowFor('skewer')).getByTestId('accuracy-bar').className).toContain('acc-bg-mid');
    expect(within(rowFor('fork')).getByTestId('accuracy-bar').className).toContain('acc-bg-high');
  });

  it('links each row into the theme trainer carrying the theme slug', () => {
    render(<ThemeAccuracyTable stats={STATS} />);
    const pinRow = screen
      .getAllByTestId('theme-accuracy-row')
      .find((r) => r.getAttribute('data-slug') === 'pin')!;
    const link = within(pinRow).getByRole('link');
    expect(link).toHaveAttribute('href', '/puzzles/train?theme=pin');
  });

  it('URL-encodes a slug that needs escaping', () => {
    const { container } = render(
      <ThemeAccuracyTable stats={[stat({ slug: 'mate in 2', accuracy: 0.3 })]} />,
    );
    const encoded = within(container).getByRole('link');
    expect(encoded.getAttribute('href')).toBe('/puzzles/train?theme=mate%20in%202');
  });

  it('filters out never-attempted themes and shows an empty state when none qualify', () => {
    render(
      <ThemeAccuracyTable
        stats={[{ slug: 'fork', attempts: 0, solved: 0, accuracy: undefined }]}
      />,
    );
    expect(screen.getByTestId('theme-accuracy-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-accuracy-table')).not.toBeInTheDocument();
  });
});

describe('sortWeakestFirst (pure)', () => {
  it('drops themes with no accuracy and orders the rest weakest-first', () => {
    const out = sortWeakestFirst([
      stat({ slug: 'a', accuracy: 0.9 }),
      { slug: 'unattempted', attempts: 0, solved: 0 },
      stat({ slug: 'b', accuracy: 0.2 }),
    ]);
    expect(out.map((s) => s.slug)).toEqual(['b', 'a']);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { WireMove } from '@purechess/shared';
import { MoveTimeChart } from '@/components/review/move-time-chart';
import type { ClassifiedMove } from '@/hooks/use-move-classifier';

function move(ply: number, moveTimeMs: number, overrides: Partial<WireMove> = {}): WireMove {
  return {
    ply,
    san: 'e4',
    uci: 'e2e4',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    clockAfterMs: 60_000,
    moveTimeMs,
    by: ply % 2 === 1 ? 'w' : 'b',
    ...overrides,
  };
}

function classified(ply: number, cls: ClassifiedMove['class']): ClassifiedMove {
  return {
    ply,
    san: 'e4',
    uci: 'e2e4',
    evalBefore: 0,
    evalAfter: 0,
    cpl: 0,
    winLoss: 0,
    accuracyPct: 100,
    class: cls,
  };
}

describe('MoveTimeChart', () => {
  it('renders nothing when every move is under the thinking threshold', () => {
    const { container } = render(
      <MoveTimeChart
        moves={[move(1, 200), move(2, 450), move(3, 0)]}
        currentPly={0}
        onSeek={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one bar per ply', () => {
    const { getByRole } = render(
      <MoveTimeChart
        moves={[move(1, 3000), move(2, 1200), move(3, 800), move(4, 200)]}
        currentPly={0}
        onSeek={() => {}}
      />,
    );
    const svg = getByRole('img', { name: 'Move times' });
    expect(svg.querySelectorAll('rect')).toHaveLength(4);
  });

  it('colors bars by classification: blunder red, brilliant emerald', () => {
    const { getByRole } = render(
      <MoveTimeChart
        moves={[move(1, 3000), move(2, 5000), move(3, 1000)]}
        classifications={[
          classified(1, 'blunder'),
          classified(2, 'brilliant'),
          classified(3, 'good'),
        ]}
        currentPly={0}
        onSeek={() => {}}
      />,
    );
    const svg = getByRole('img', { name: 'Move times' });
    const fills = Array.from(svg.querySelectorAll('rect')).map((r) => r.getAttribute('fill'));
    expect(fills[0]).toBe('#ef4444');
    expect(fills[1]).toBe('#10b981');
    expect(fills[2]).toBe('hsl(var(--muted-foreground))');
  });

  it('falls back to the neutral fill when unclassified', () => {
    const { getByRole } = render(
      <MoveTimeChart moves={[move(1, 3000)]} currentPly={0} onSeek={() => {}} />,
    );
    const svg = getByRole('img', { name: 'Move times' });
    expect(svg.querySelector('rect')?.getAttribute('fill')).toBe('hsl(var(--border))');
  });

  it('excludes sub-500ms moves from the averages', () => {
    // White: 3000ms + 5000ms count, 200ms excluded → avg 4.0s.
    // Black: 2000ms counts → avg 2.0s.
    const { getByText } = render(
      <MoveTimeChart
        moves={[move(1, 3000), move(2, 2000), move(3, 200), move(5, 5000)]}
        currentPly={0}
        onSeek={() => {}}
      />,
    );
    expect(getByText('White avg: 4.0s')).toBeTruthy();
    expect(getByText('Black avg: 2.0s')).toBeTruthy();
  });

  it('hides a side with no qualifying moves from the averages', () => {
    const { getByText, queryByText } = render(
      <MoveTimeChart moves={[move(1, 3000), move(2, 300)]} currentPly={0} onSeek={() => {}} />,
    );
    expect(getByText('White avg: 3.0s')).toBeTruthy();
    expect(queryByText(/Black avg/)).toBeNull();
  });

  it('seeks to the clicked ply', () => {
    const onSeek = vi.fn();
    const { getByRole } = render(
      <MoveTimeChart
        moves={[move(1, 3000), move(2, 1000), move(3, 2000), move(4, 1500)]}
        currentPly={0}
        onSeek={onSeek}
      />,
    );
    const svg = getByRole('img', { name: 'Move times' });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 48,
      right: 100,
      bottom: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // 4 columns over 100px → x=60 lands in column 2 (index 2) → ply 3.
    fireEvent.click(svg, { clientX: 60, clientY: 24 });
    expect(onSeek).toHaveBeenCalledWith(3);
  });

  it('ignores clicks when the chart has no measurable width (jsdom default)', () => {
    const onSeek = vi.fn();
    const { getByRole } = render(
      <MoveTimeChart moves={[move(1, 3000)]} currentPly={0} onSeek={onSeek} />,
    );
    fireEvent.click(getByRole('img', { name: 'Move times' }), { clientX: 10 });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

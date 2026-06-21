import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EvalBar,
  EngineLines,
  EvalReadout,
  whiteShare,
  formatScore,
} from '@/components/review/eval-panel';
import type { PositionEval } from '@/hooks/use-position-eval';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function evalOf(partial: Partial<PositionEval>): PositionEval {
  return { depth: 18, bestmove: 'e2e4', pv: ['e2e4'], ...partial };
}

describe('formatScore', () => {
  it('formats positive cp in pawns with sign', () => {
    expect(formatScore(140)).toBe('+1.4');
  });

  it('formats negative cp in pawns', () => {
    expect(formatScore(-30)).toBe('-0.3');
  });

  it('formats mate as #N regardless of side', () => {
    expect(formatScore(undefined, 3)).toBe('#3');
    expect(formatScore(undefined, -3)).toBe('#3');
  });

  it('returns ellipsis when no score yet', () => {
    expect(formatScore()).toBe('…');
  });
});

describe('whiteShare', () => {
  it('is 50 at equality', () => {
    expect(whiteShare(0)).toBe(50);
  });

  it('grows with White advantage and shrinks with Black advantage', () => {
    expect(whiteShare(400)).toBeGreaterThan(50);
    expect(whiteShare(-400)).toBeLessThan(50);
  });
});

describe('EvalBar score cap', () => {
  it('bar is w-3 wide', () => {
    render(<EvalBar evaluation={evalOf({ cp: 0 })} />);
    expect(screen.getByRole('img').className).toContain('w-3');
  });

  it('hides the cap until the first eval lands', () => {
    render(<EvalBar evaluation={null} />);
    expect(screen.queryByText('…')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Evaluation …');
  });

  it('pins the cap to the bottom (White edge) when White is winning, white orientation', () => {
    render(<EvalBar evaluation={evalOf({ cp: 140 })} orientation="white" />);
    const cap = screen.getByText('+1.4');
    expect(cap.className).toContain('bottom-1');
    expect(cap.className).not.toContain('top-1');
    // ink over the bone fill
    expect(cap.className).toContain('text-background');
  });

  it('pins the cap to the top (Black edge) when Black is winning, white orientation', () => {
    render(<EvalBar evaluation={evalOf({ cp: -140 })} orientation="white" />);
    const cap = screen.getByText('-1.4');
    expect(cap.className).toContain('top-1');
    expect(cap.className).not.toContain('bottom-1');
    // bone over the dark well
    expect(cap.className).toContain('text-board-light');
  });

  it('flips the winning edge with board orientation', () => {
    render(<EvalBar evaluation={evalOf({ cp: 140 })} orientation="black" />);
    const cap = screen.getByText('+1.4');
    expect(cap.className).toContain('top-1');
  });

  it('shows mate as #N at the mating side edge', () => {
    render(<EvalBar evaluation={evalOf({ mate: -3 })} orientation="white" />);
    const cap = screen.getByText('#3');
    expect(cap.className).toContain('top-1');
    expect(cap.className).toContain('text-board-light');
  });

  it('cap is decorative — score lives in the aria-label', () => {
    render(<EvalBar evaluation={evalOf({ cp: 140 })} />);
    expect(screen.getByText('+1.4').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Evaluation +1.4');
  });

  it('shows the scan-line only while thinking', () => {
    const { container, rerender } = render(<EvalBar evaluation={evalOf({ cp: 0 })} thinking />);
    expect(container.querySelector('.eval-scan')).not.toBeNull();
    rerender(<EvalBar evaluation={evalOf({ cp: 0 })} thinking={false} />);
    expect(container.querySelector('.eval-scan')).toBeNull();
  });
});

describe('EngineLines', () => {
  const lines = [
    { depth: 18, pv: ['e2e4', 'e7e5', 'g1f3'], cp: 230 },
    { depth: 17, pv: ['d2d4', 'd7d5'], cp: 190 },
    { depth: 17, pv: ['c2c4', 'e7e5'], cp: 110 },
  ];

  it('renders one row per line with PV in SAN', () => {
    render(
      <EngineLines
        fen={START}
        evaluation={evalOf({ cp: 230, pv: ['e2e4', 'e7e5', 'g1f3'] })}
        thinking={false}
        lines={lines}
      />,
    );
    expect(screen.getByText('+2.3')).toBeTruthy();
    expect(screen.getByText('e4 e5 Nf3')).toBeTruthy();
    expect(screen.getByText('+1.9')).toBeTruthy();
    expect(screen.getByText('d4 d5')).toBeTruthy();
    expect(screen.getByText('+1.1')).toBeTruthy();
  });

  it('shows depth only on the primary line', () => {
    render(
      <EngineLines
        fen={START}
        evaluation={evalOf({ cp: 230, pv: ['e2e4'] })}
        thinking={false}
        lines={lines}
      />,
    );
    expect(screen.getAllByText('d18')).toHaveLength(1);
    expect(screen.queryByText('d17')).toBeNull();
  });

  it('renders a single row without lines (EvalReadout back-compat)', () => {
    render(<EvalReadout fen={START} evaluation={evalOf({ cp: 30 })} thinking={false} />);
    expect(screen.getByText('+0.3')).toBeTruthy();
    expect(screen.getByText('e4')).toBeTruthy();
  });

  it('truncates PVs longer than six moves with an ellipsis', () => {
    const longPv = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4'];
    render(
      <EngineLines fen={START} evaluation={evalOf({ cp: 30, pv: longPv })} thinking={false} />,
    );
    // Six moves render, the 7th is cut and replaced by the ellipsis.
    expect(screen.getByText(/Bb5 a6\s*…/)).toBeTruthy();
    expect(screen.queryByText(/Ba4/)).toBeNull();
  });
});

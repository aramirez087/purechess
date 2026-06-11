import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvalBar, whiteShare, formatScore } from '@/components/review/eval-panel';
import type { PositionEval } from '@/hooks/use-position-eval';

function evalOf(partial: Partial<PositionEval>): PositionEval {
  return { depth: 18, bestmove: 'e2e4', ...partial };
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
    expect(cap.className).toContain('text-[#10140f]');
  });

  it('pins the cap to the top (Black edge) when Black is winning, white orientation', () => {
    render(<EvalBar evaluation={evalOf({ cp: -140 })} orientation="white" />);
    const cap = screen.getByText('-1.4');
    expect(cap.className).toContain('top-1');
    expect(cap.className).not.toContain('bottom-1');
    // bone over the dark well
    expect(cap.className).toContain('text-[#e9e4d4]');
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
    expect(cap.className).toContain('text-[#e9e4d4]');
  });

  it('cap is decorative — score lives in the aria-label', () => {
    render(<EvalBar evaluation={evalOf({ cp: 140 })} />);
    expect(screen.getByText('+1.4').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Evaluation +1.4');
  });
});

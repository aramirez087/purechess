import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EvalGraph } from '@/components/review/eval-graph';

describe('EvalGraph', () => {
  it('renders without crashing with empty evals', () => {
    const { getByRole } = render(<EvalGraph evals={[]} currentPly={0} onSeek={() => {}} />);
    const svg = getByRole('img', { name: 'Evaluation graph' });
    expect(svg).toBeTruthy();
    expect(svg.querySelector('polyline')).toBeNull();
  });

  it('clamps evals beyond ±600cp without producing NaN coordinates', () => {
    const { getByRole } = render(
      <EvalGraph evals={[0, 1500, -2000, 9970]} currentPly={2} onSeek={() => {}} />,
    );
    const svg = getByRole('img', { name: 'Evaluation graph' });
    const points = svg.querySelector('polyline')?.getAttribute('points') ?? '';
    expect(points).not.toContain('NaN');
    // +1500 clamps to +600 → y 0; -2000 clamps to -600 → y 100.
    const ys = points.split(' ').map((p) => Number(p.split(',')[1]));
    expect(ys[1]).toBe(0);
    expect(ys[2]).toBe(100);
  });

  it('seeks to the nearest ply on click', () => {
    const onSeek = vi.fn();
    const { getByRole } = render(
      <EvalGraph evals={[0, 10, 20, 30, 40]} currentPly={0} onSeek={onSeek} />,
    );
    const svg = getByRole('img', { name: 'Evaluation graph' });
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

    fireEvent.click(svg, { clientX: 75, clientY: 24 });
    expect(onSeek).toHaveBeenCalledWith(3);
  });

  it('ignores clicks when the graph has no measurable width (jsdom default)', () => {
    const onSeek = vi.fn();
    const { getByRole } = render(<EvalGraph evals={[0, 10]} currentPly={0} onSeek={onSeek} />);
    fireEvent.click(getByRole('img', { name: 'Evaluation graph' }), { clientX: 10 });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

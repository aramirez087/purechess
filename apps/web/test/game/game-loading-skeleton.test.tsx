import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';

/**
 * The skeleton must paint a real contentful element (an SVG board silhouette),
 * not only background-coloured divs. The browser's FCP/LCP fire on text/image/
 * SVG paints and ignore background-color, so a content-less skeleton leaves
 * FCP/LCP waiting for the real board (~6 s under throttled load, S07). This
 * fails if the SVG silhouette is removed.
 */
describe('GameLoadingSkeleton', () => {
  it('renders a contentful SVG board silhouette', () => {
    const { container } = render(<GameLoadingSkeleton />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // 1 background rect + 32 dark checker cells = 33 rects
    expect(svg!.querySelectorAll('rect').length).toBe(33);
  });

  it('keeps the loading status label for screen readers', () => {
    const { getByRole } = render(<GameLoadingSkeleton />);
    expect(getByRole('status')).toHaveAttribute('aria-label', 'Loading game');
  });
});

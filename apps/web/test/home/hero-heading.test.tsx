import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, act } from '@testing-library/react';
import { HeroHeading } from '@/components/home/hero-heading';

/**
 * LCP fix (S04 §5.1 / S07): the hero h1 is the page's LCP element (verified via
 * PerformanceObserver). It must NEVER carry `animate-rise-*` — that class is
 * `fadeInUp ... both` (starts at opacity:0), which both (a) hides it in SSR and
 * (b) re-fades it from invisible on hydration, pushing the recorded LCP several
 * seconds out under throttled load. These assertions fail if any rise/fade
 * entrance animation is re-added to the headline.
 */
describe('HeroHeading', () => {
  it('carries no rise/fade entrance animation in SSR markup', () => {
    const html = renderToString(<HeroHeading />);
    expect(html).not.toMatch(/animate-rise/);
    expect(html).not.toMatch(/animate-fade/);
    // still the real heading — id + text preserved for aria-labelledby
    expect(html).toContain('id="hero-wordmark"');
    expect(html).toContain('the product.');
  });

  it('still carries no animation class after mount/hydration', () => {
    const { container } = render(<HeroHeading />);
    act(() => {});
    const h1 = container.querySelector('#hero-wordmark');
    expect(h1).not.toBeNull();
    expect(h1!.className).not.toMatch(/animate-rise/);
  });
});

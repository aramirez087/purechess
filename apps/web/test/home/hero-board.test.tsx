import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { HeroBoard } from '@/components/home/hero-board';

/**
 * The hero board's replay enhancement: static Immortal Game final position
 * by default; on first ~60% visibility it replays 22.Qf6+ Nxf6 23.Be7# and
 * settles back on the exact static markup. Reduced motion never animates.
 */

type IOEntry = { isIntersecting: boolean; intersectionRatio: number };
type IOCallback = (entries: IOEntry[]) => void;

let ioCallbacks: IOCallback[] = [];
let observedElements: Element[] = [];

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallbacks.push(cb);
  }
  observe(el: Element) {
    observedElements.push(el);
  }
  unobserve() {}
  disconnect() {}
}

const realMatchMedia = window.matchMedia;

function stubMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function pieceImgs(container: HTMLElement, piece?: string) {
  const selector = piece
    ? `img[src="/pieces/cburnett/${piece}.svg"]`
    : 'img[src^="/pieces/cburnett/"]';
  return container.querySelectorAll(selector);
}

/**
 * Advance fake time in small slices, each inside its own act(), so React
 * flushes effects between timer fires — the replay timeline chains
 * setTimeout/rAF through effects, which a single big advance never reaches.
 */
function runReplayToEnd(totalMs = 6000, sliceMs = 100) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += sliceMs) {
    act(() => {
      vi.advanceTimersByTime(sliceMs);
    });
  }
}

beforeEach(() => {
  ioCallbacks = [];
  observedElements = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.matchMedia = realMatchMedia;
});

describe('HeroBoard', () => {
  it('renders the static final position by default (white queen already sacrificed)', () => {
    const { container } = render(<HeroBoard />);
    // Final position has 23 pieces and no white queen (it died on f6).
    expect(pieceImgs(container).length).toBe(23);
    expect(pieceImgs(container, 'wQ').length).toBe(0);
    // Mating-move highlight + caption intact.
    expect(container.textContent).toContain('23.Be7#');
  });

  it('observes the board for the one-shot replay trigger', () => {
    render(<HeroBoard />);
    expect(ioCallbacks.length).toBe(1);
    expect(observedElements.length).toBe(1);
    expect(observedElements[0].tagName).toBe('FIGURE');
  });

  it('prefers-reduced-motion: skips the replay entirely and keeps the static position', () => {
    stubMatchMedia(true);
    const { container } = render(<HeroBoard />);
    // Never arms the observer — no replay can ever start.
    expect(ioCallbacks.length).toBe(0);
    expect(pieceImgs(container, 'wQ').length).toBe(0);
    expect(pieceImgs(container).length).toBe(23);
  });

  it('the stored animations-off preference also skips the replay', () => {
    // The persisted settings envelope is the real production signal — no
    // Chessboard (the data-no-animations emitter) mounts on the home page.
    window.localStorage.setItem(
      'purechess-settings',
      JSON.stringify({ state: { animations: false }, version: 0 }),
    );
    try {
      render(<HeroBoard />);
      expect(ioCallbacks.length).toBe(0);
    } finally {
      window.localStorage.removeItem('purechess-settings');
    }
  });

  it('animations left on (default) arms the replay', () => {
    window.localStorage.setItem(
      'purechess-settings',
      JSON.stringify({ state: { animations: true }, version: 0 }),
    );
    try {
      render(<HeroBoard />);
      expect(ioCallbacks.length).toBe(1);
    } finally {
      window.localStorage.removeItem('purechess-settings');
    }
  });

  it('rewinds to the pre-sacrifice position (after 21...Kd8) when scrolled into view', () => {
    const { container } = render(<HeroBoard />);
    act(() => {
      ioCallbacks[0]([{ isIntersecting: true, intersectionRatio: 0.65 }]);
    });
    // Pre-replay position: queen back on f3, knight back on g8 — 24 pieces.
    expect(pieceImgs(container, 'wQ').length).toBe(1);
    expect(pieceImgs(container).length).toBe(24);
  });

  it('plays the three ply and settles byte-identical to the static render', () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });

    // Reference: untouched static render.
    const staticRender = render(<HeroBoard />);
    const staticHtml = staticRender.container.innerHTML;
    staticRender.unmount();

    const { container } = render(<HeroBoard />);
    act(() => {
      ioCallbacks[ioCallbacks.length - 1]([{ isIntersecting: true, intersectionRatio: 0.65 }]);
    });
    expect(container.innerHTML).not.toBe(staticHtml); // replay rewound the board

    // Hold (700) + 2 × inter-ply (900) + mate slide/settle (300) < 6000.
    runReplayToEnd();

    expect(container.innerHTML).toBe(staticHtml);
    expect(pieceImgs(container, 'wQ').length).toBe(0);
    expect(pieceImgs(container).length).toBe(23);
  });

  it('triggers only once — later intersections do not restart the replay', () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    const { container } = render(<HeroBoard />);
    act(() => {
      ioCallbacks[0]([{ isIntersecting: true, intersectionRatio: 0.65 }]);
    });
    runReplayToEnd();
    expect(pieceImgs(container, 'wQ').length).toBe(0);

    // Fire again — the board must stay settled on the final position.
    act(() => {
      ioCallbacks[0]([{ isIntersecting: true, intersectionRatio: 0.9 }]);
    });
    expect(pieceImgs(container, 'wQ').length).toBe(0);
    expect(pieceImgs(container).length).toBe(23);
  });
});

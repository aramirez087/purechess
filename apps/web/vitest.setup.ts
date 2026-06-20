import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

// Some suites opt into fake timers (stockfish timeout, hero-board replay, clocks).
// Reset timer mode around every test so async TrainingSession flows never inherit
// a stale fake-timer environment from a prior file in the same worker.
beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
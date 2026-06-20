import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// Some suites (e.g. stockfish-client timeout) opt into fake timers — always
// restore real timers so async training-session flows don't flake in parallel.
afterEach(() => {
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

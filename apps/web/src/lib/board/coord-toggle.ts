import type { Orientation } from './types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function fileLabel(index: number, orientation: Orientation): string {
  if (orientation === 'white') return FILES[index] ?? '';
  return FILES[7 - index] ?? '';
}

export function rankLabel(index: number, orientation: Orientation): string {
  if (orientation === 'white') return RANKS[7 - index] ?? '';
  return RANKS[index] ?? '';
}

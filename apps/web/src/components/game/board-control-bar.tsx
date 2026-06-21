'use client';

import { FlipVertical2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameRailButton } from './game-rail-button';

export interface BoardControlBarProps {
  onFlip: () => void;
  /** Page-specific controls (Resign / New game / replay seek group). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Chromeless control row — no card border/background of its own so it can
 * dock flush inside a rail footer. Buttons keep their own chrome.
 */
export function BoardControlBar({ onFlip, children, className }: BoardControlBarProps) {
  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-2', className)}>
      <GameRailButton onClick={onFlip} aria-label="Flip board">
        <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
        Flip
      </GameRailButton>
      {children}
    </div>
  );
}
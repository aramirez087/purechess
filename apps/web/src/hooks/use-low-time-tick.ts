import { useEffect, useRef } from 'react';
import { soundEngine } from '@/lib/board/sound';

/**
 * Fires one tick-sound per second while your clock is between 0 and 10 s.
 * Pass `null` when it is not your turn or the game is not active.
 */
export function useLowTimeTick(yourTurnMs: number | null, lowTimeSoundEnabled: boolean): void {
  const lastTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (yourTurnMs === null || yourTurnMs <= 0 || yourTurnMs >= 10_000) {
      lastTickSecondRef.current = null;
      return;
    }
    const sec = Math.ceil(yourTurnMs / 1000);
    if (lastTickSecondRef.current !== sec) {
      lastTickSecondRef.current = sec;
      soundEngine.playTick(lowTimeSoundEnabled);
    }
  });
}

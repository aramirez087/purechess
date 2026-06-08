'use client';

import { useEffect, useRef, useState } from 'react';

export interface LiveAnnouncerProps {
  /** Last computer move in SAN notation, e.g. "Nf3". Null before first computer move. */
  lastComputerMoveSan: string | null;
  /** Human-readable result, e.g. "You won", "You lost", "Draw". Null while active. */
  gameResult: string | null;
}

export function LiveAnnouncer({ lastComputerMoveSan, gameResult }: LiveAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('');
  const prevSanRef = useRef<string | null>(null);

  useEffect(() => {
    const sanChanged = lastComputerMoveSan && lastComputerMoveSan !== prevSanRef.current;
    if (sanChanged) {
      prevSanRef.current = lastComputerMoveSan;
      const msg = gameResult
        ? `Computer played ${lastComputerMoveSan}. ${gameResult}.`
        : `Computer played ${lastComputerMoveSan}.`;
      setAnnouncement(msg);
    } else if (gameResult) {
      setAnnouncement(`Game over. ${gameResult}.`);
    }
  }, [lastComputerMoveSan, gameResult]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

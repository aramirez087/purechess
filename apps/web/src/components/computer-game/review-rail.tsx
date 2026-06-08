'use client';

import { PgnActions } from '@/components/review/pgn-actions';

interface ReviewRailProps {
  pgn: string;
  fen: string;
  gameId: string;
}

export function ReviewRail({ pgn, fen, gameId }: ReviewRailProps) {
  return (
    <div className="shrink-0">
      <PgnActions pgn={pgn} fen={fen} gameId={gameId} />
    </div>
  );
}

'use client';

import { Chessboard } from '@/components/board';
import { ReviewMetadata } from '@/components/review/review-metadata';
import { ReviewMoveList } from '@/components/review/review-move-list';
import { ReviewControls } from '@/components/review/review-controls';
import { PgnActions } from '@/components/review/pgn-actions';
import { ReportButton } from '@/components/reports/report-button';
import { useGameReview } from '@/hooks/use-game-review';
import type { GameReview } from '@/types/game-review';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface ReviewClientProps {
  game: GameReview;
  reportTarget?: { opponentId: string; opponentUsername: string } | null;
}

export function ReviewClient({ game, reportTarget }: ReviewClientProps) {
  const { ply, fen, lastMove, isCorrupt, goTo, goNext, goPrev, goStart, goEnd } = useGameReview(game);

  if (isCorrupt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <h2 className="text-xl font-semibold">Could not load this game</h2>
        <p className="text-muted-foreground max-w-sm">
          The game record appears to be corrupt. If this problem persists, please{' '}
          <a href="mailto:support@purechess.com" className="underline">contact support</a>.
        </p>
      </div>
    );
  }

  const displayFen = fen ?? STARTING_FEN;

  return (
    <div className="flex flex-col md:grid md:grid-cols-[1fr_320px] gap-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="w-full aspect-square max-w-lg mx-auto md:mx-0">
        <Chessboard
          position={displayFen}
          readOnly
          lastMove={lastMove ?? undefined}
          className="w-full h-full"
        />
      </div>

      <div className="flex flex-col gap-4">
        <ReviewMetadata game={game} />
        <ReviewMoveList moves={game.moves} currentPly={ply} onSeek={goTo} />
        <ReviewControls onStart={goStart} onPrev={goPrev} onNext={goNext} onEnd={goEnd} />
        <PgnActions pgn={game.pgn} gameId={game.id} />
        {reportTarget && (
          <ReportButton
            gameId={game.id}
            opponentId={reportTarget.opponentId}
            opponentUsername={reportTarget.opponentUsername}
          />
        )}
      </div>
    </div>
  );
}

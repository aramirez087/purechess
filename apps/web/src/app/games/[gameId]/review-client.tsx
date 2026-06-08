'use client';

import { useState } from 'react';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import {
  GameShell,
  BoardColumn,
  GameRail,
  MovePanel,
  BoardControlBar,
  type PlayerStripProps,
} from '@/components/game';
import { ReviewControls } from '@/components/review/review-controls';
import { PgnActions } from '@/components/review/pgn-actions';
import { ReportButton } from '@/components/reports/report-button';
import { useGameReview } from '@/hooks/use-game-review';
import { computeMaterial } from '@/lib/board/material';
import { GameResult, GameTermination } from '@purechess/shared';
import type { GameReview } from '@/types/game-review';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type Color = 'white' | 'black';

interface ReviewClientProps {
  game: GameReview;
  reportTarget?: { opponentId: string; opponentUsername: string } | null;
}

function formatResult(result: GameResult): string {
  switch (result) {
    case GameResult.WhiteWins:
      return '1 – 0';
    case GameResult.BlackWins:
      return '0 – 1';
    case GameResult.Draw:
      return '½ – ½';
  }
}

function formatTermination(t: GameTermination): string {
  switch (t) {
    case GameTermination.Checkmate:
      return 'Checkmate';
    case GameTermination.Resignation:
      return 'Resignation';
    case GameTermination.Timeout:
      return 'Timeout';
    case GameTermination.Stalemate:
      return 'Stalemate';
    case GameTermination.InsufficientMaterial:
      return 'Insufficient material';
    case GameTermination.ThreefoldRepetition:
      return 'Threefold repetition';
    case GameTermination.FiftyMoveRule:
      return 'Fifty-move rule';
    case GameTermination.DrawAgreement:
      return 'Draw agreement';
    case GameTermination.Abandonment:
      return 'Abandonment';
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-[#9da79c]">{label}</dt>
      <dd className="font-medium text-[#e7e3d6]">{value}</dd>
    </div>
  );
}

export function ReviewClient({ game, reportTarget }: ReviewClientProps) {
  const { ply, fen, lastMove, isCorrupt, goTo, goNext, goPrev, goStart, goEnd } = useGameReview(game);
  const [flipped, setFlipped] = useState(false);

  if (isCorrupt) {
    return (
      <main
        id="main-content"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d0b] p-8 text-center text-[#f1eee6]"
      >
        <h2 className="text-xl font-semibold">Could not load this game</h2>
        <p className="max-w-sm text-[#9da79c]">
          The game record appears to be corrupt. If this problem persists, please{' '}
          <a href="mailto:support@purechess.com" className="underline">
            contact support
          </a>
          .
        </p>
      </main>
    );
  }

  const displayFen = fen ?? STARTING_FEN;
  const orientation: Color = flipped ? 'black' : 'white';
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove: Color = displayFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const material = computeMaterial(displayFen);
  const date = new Date(game.startedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  function stripFor(color: Color): PlayerStripProps {
    const player = color === 'white' ? game.white : game.black;
    const captured = color === 'white' ? material.byWhite : material.byBlack;
    const capturedColor = color === 'white' ? 'b' : 'w';
    const advantage = color === 'white' ? material.advantage : -material.advantage;
    return {
      name: player.username,
      detail: String(player.rating),
      active: color === sideToMove,
      captured,
      capturedColor,
      advantage,
    };
  }

  return (
    <BoardSettingsProvider>
      <GameShell
        leftRail={
          <div className="flex flex-col gap-4">
            <GameRail title="Game">
              <dl className="divide-y divide-[#232a24] text-sm">
                <InfoRow label="Result" value={formatResult(game.result)} />
                <InfoRow label="By" value={formatTermination(game.termination)} />
                <InfoRow label="Time" value={game.timeControl.label} />
                <InfoRow label="Type" value={game.rated ? 'Rated' : 'Casual'} />
                <InfoRow label="Date" value={date} />
              </dl>
            </GameRail>
            <PgnActions pgn={game.pgn} gameId={game.id} />
            {reportTarget && (
              <ReportButton
                gameId={game.id}
                opponentId={reportTarget.opponentId}
                opponentUsername={reportTarget.opponentUsername}
              />
            )}
          </div>
        }
        board={
          <BoardColumn topPlayer={stripFor(topColor)} bottomPlayer={stripFor(bottomColor)}>
            <Chessboard
              position={displayFen}
              orientation={orientation}
              readOnly
              lastMove={lastMove ?? undefined}
              className="[&_[role=grid]]:overflow-hidden [&_[role=grid]]:rounded-[3px] [&_[role=grid]]:shadow-[inset_0_0_0_1px_rgba(11,13,11,0.28)]"
            />
          </BoardColumn>
        }
        rightRail={
          <div className="flex h-full min-h-0 flex-col gap-4">
            <GameRail
              title="Moves"
              aside={`${game.moves.length} ply`}
              className="min-h-0 flex-1"
              bodyClassName="flex-1"
            >
              <MovePanel
                moves={game.moves.map((m, i) => ({ san: m.san, ply: i + 1 }))}
                currentPly={ply}
                onSeek={goTo}
              />
            </GameRail>
            <BoardControlBar onFlip={() => setFlipped((f) => !f)}>
              <ReviewControls onStart={goStart} onPrev={goPrev} onNext={goNext} onEnd={goEnd} />
            </BoardControlBar>
          </div>
        }
      />
    </BoardSettingsProvider>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GameResult, GameTermination } from '@purechess/shared';
import type { GameReview } from '@/types/game-review';

interface ReviewMetadataProps {
  game: GameReview;
}

function formatResult(result: GameResult): string {
  switch (result) {
    case GameResult.WhiteWins: return '1 – 0';
    case GameResult.BlackWins: return '0 – 1';
    case GameResult.Draw: return '½ – ½';
  }
}

function formatTermination(t: GameTermination): string {
  switch (t) {
    case GameTermination.Checkmate: return 'Checkmate';
    case GameTermination.Resignation: return 'Resignation';
    case GameTermination.Timeout: return 'Timeout';
    case GameTermination.Stalemate: return 'Stalemate';
    case GameTermination.InsufficientMaterial: return 'Insufficient material';
    case GameTermination.ThreefoldRepetition: return 'Threefold repetition';
    case GameTermination.FiftyMoveRule: return 'Fifty-move rule';
    case GameTermination.DrawAgreement: return 'Draw agreement';
    case GameTermination.Abandonment: return 'Abandonment';
  }
}

export function ReviewMetadata({ game }: ReviewMetadataProps) {
  const date = new Date(game.startedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{game.white.username}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{game.white.rating}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono tabular-nums text-lg font-bold">{formatResult(game.result)}</span>
          <span className="text-xs text-muted-foreground">{formatTermination(game.termination)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{game.black.username}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{game.black.rating}</span>
        </div>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Badge variant="outline">{game.timeControl.label}</Badge>
          <Badge variant={game.rated ? 'default' : 'secondary'}>{game.rated ? 'Rated' : 'Casual'}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">{date}</span>
        </div>
      </CardContent>
    </Card>
  );
}

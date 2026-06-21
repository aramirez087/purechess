import type { ChessComOpeningMistakeDto, PuzzleDto } from '@purechess/shared';
import { displayOpeningLabel } from '@/lib/chess-com/opening-label';

/** 1-based move number and side from ply. */
export function plyMeta(ply: number): { moveNumber: number; color: 'w' | 'b' } {
  return {
    moveNumber: Math.ceil(ply / 2),
    color: ply % 2 === 1 ? 'w' : 'b',
  };
}

export function moveLabel(ply: number, san: string): string {
  const { moveNumber, color } = plyMeta(ply);
  return `${moveNumber}.${color === 'b' ? '..' : ''} ${san}`;
}

/** Beginner-friendly cost of the mistake. */
export function cpLossCoachLine(cpLoss: number): string {
  if (cpLoss >= 300) {
    return 'That was a serious blunder — you gave up roughly the value of a piece.';
  }
  if (cpLoss >= 180) {
    return 'That was a big mistake — you lost about two pawns worth of advantage.';
  }
  if (cpLoss >= 120) {
    return 'That cost you about a pawn of advantage — enough to matter in the opening.';
  }
  if (cpLoss >= 80) {
    return 'Your position got noticeably worse — the engine disagrees with this move.';
  }
  return 'A small slip, but in the opening these add up fast.';
}

export function chessComMistakeToPuzzle(mistake: ChessComOpeningMistakeDto): PuzzleDto {
  return {
    id: `${mistake.gameId}:${mistake.ply}`,
    fen: mistake.fen,
    moves: [mistake.bestUci],
    rating: 0,
    themes: [],
  };
}

export function mistakeCoachTitle(mistake: ChessComOpeningMistakeDto): string {
  return displayOpeningLabel(mistake.openingLabel);
}

export function mistakeCoachHref(mistake: Pick<ChessComOpeningMistakeDto, 'gameId' | 'ply'>): string {
  const params = new URLSearchParams({
    gameId: mistake.gameId,
    ply: String(mistake.ply),
  });
  return `/openings/mistake?${params.toString()}`;
}
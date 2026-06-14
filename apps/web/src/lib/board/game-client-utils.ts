import type { Square } from '@purechess/shared';

export type Color = 'white' | 'black';

export const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  resignation: 'Resignation',
  timeout: 'Timeout',
  stalemate: 'Stalemate',
  insufficient_material: 'Insufficient material',
  threefold_repetition: 'Threefold repetition',
  fifty_move_rule: 'Fifty-move rule',
  draw_agreement: 'Draw agreement',
  abandonment: 'Abandonment',
};

export function getSideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function parseLastMove(uci: string | null): { from: Square; to: Square } | undefined {
  if (!uci || uci.length < 4) return undefined;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

export function parsePgnMoves(pgn: string): string[] {
  if (!pgn.trim()) return [];
  const clean = pgn
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  return clean
    .split(/\s+/)
    .filter((t) => t && !/^\d+\./.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

/** Result label from the viewer's perspective (viewerColor = the color you play). */
export function getResultLabel(result: string | null, viewerColor: Color): string {
  if (!result) return '';
  if (result === 'draw') return 'Draw';
  const youWin =
    (result === 'white_wins' && viewerColor === 'white') ||
    (result === 'black_wins' && viewerColor === 'black');
  return youWin ? 'You won' : 'You lost';
}

/** Score-sheet result chip for a finished game, from this side's perspective. */
export function resultChipFor(result: string | null, color: Color): string | undefined {
  if (!result) return undefined;
  if (result === 'draw') return '½';
  return (result === 'white_wins') === (color === 'white') ? '1' : '0';
}

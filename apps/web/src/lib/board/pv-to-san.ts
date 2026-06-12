import { Chess } from 'chess.js';

/**
 * Converts a UCI PV sequence into SAN notation.
 * Returns as many moves as successfully convert — stops on the first invalid
 * move instead of throwing. Trims to `maxMoves` (default 6) to keep the
 * display compact.
 *
 * Pulls in chess.js like `rules.ts` does — never import this from the eager
 * board chunk; it's for analysis/review surfaces that already load chess.js.
 */
export function pvToSan(startFen: string, uciMoves: string[], maxMoves = 6): string[] {
  const san: string[] = [];
  let chess: Chess;
  try {
    chess = new Chess(startFen);
  } catch {
    return san;
  }
  for (const uci of uciMoves) {
    if (san.length >= maxMoves) break;
    if (typeof uci !== 'string' || uci.length < 4) break;
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!move) break;
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}

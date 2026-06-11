/**
 * Compatibility barrel. The implementation split in two:
 *  - `fen.ts`   — pure FEN parsing (eager-safe, no chess.js)
 *  - `rules.ts` — chess legality/derivations (chess.js; lazy via `rules-lazy.ts`)
 *
 * Importing THIS module statically pulls chess.js — fine for tests and
 * review/analyze surfaces, forbidden for the eager board chunk (chessboard,
 * board hooks, game clients): those import `fen.ts` directly and reach rules
 * through `rules-lazy.ts`.
 */
export { getPieceAt, fenToColorToMove, isPromotion, parseFenBoard } from './fen';
export {
  getLegalMovesForSquare,
  getLegalCapturesForSquare,
  isKingInCheck,
  getCheckSquare,
  getAllLegalMoves,
} from './rules';

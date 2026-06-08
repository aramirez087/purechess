import { Chess } from 'chess.js';
import type { PieceType, Color } from '@purechess/shared';

/** Captured pieces of one color, sorted by value (queen first), with their total point value. */
export interface CapturedSummary {
  /** Pieces of this color that are missing from the board, high value first. */
  pieces: PieceType[];
  /** Total standard point value of those pieces. */
  value: number;
}

export interface MaterialState {
  /** Black pieces White has captured (render as black glyphs). */
  byWhite: CapturedSummary;
  /** White pieces Black has captured (render as white glyphs). */
  byBlack: CapturedSummary;
  /** Signed material difference in points: positive = White ahead, negative = Black ahead. */
  advantage: number;
}

/** Count of each piece type in a full starting army (kings excluded from scoring below). */
const FULL: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** Standard piece point values; kings score 0. */
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Display order: most valuable first. */
const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

function emptySummary(): CapturedSummary {
  return { pieces: [], value: 0 };
}

function emptyMaterial(): MaterialState {
  return { byWhite: emptySummary(), byBlack: emptySummary(), advantage: 0 };
}

/**
 * Compute captured pieces and the material balance from a FEN.
 *
 * Captured pieces are derived as (full starting army − pieces currently on the
 * board) per color. This is the standard, intentionally-approximate display
 * used by chess sites: promotions can add a queen while removing a pawn, so a
 * "missing" count is clamped at 0 (we never report negative captures). Exact
 * promotion accounting from move history is out of scope and not needed for a
 * captured-material strip.
 */
export function computeMaterial(fen: string): MaterialState {
  const onBoard: Record<Color, Record<PieceType, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  try {
    const board = new Chess(fen).board();
    for (const row of board) {
      for (const sq of row) {
        if (sq) onBoard[sq.color as Color][sq.type as PieceType]++;
      }
    }
  } catch {
    return emptyMaterial();
  }

  const capturedFrom = (color: Color): CapturedSummary => {
    const pieces: PieceType[] = [];
    let value = 0;
    for (const type of ORDER) {
      const missing = Math.max(0, FULL[type] - onBoard[color][type]);
      for (let i = 0; i < missing; i++) {
        pieces.push(type);
        value += VALUE[type];
      }
    }
    return { pieces, value };
  };

  const byWhite = capturedFrom('b'); // White captured Black's missing pieces
  const byBlack = capturedFrom('w');

  return { byWhite, byBlack, advantage: byWhite.value - byBlack.value };
}

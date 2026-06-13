import type { Color, Piece, Square } from '@purechess/shared';
import { parseFenBoard } from './fen';

/**
 * Pure editor state ↔ FEN conversion — zero dependencies, no React, no chess.js.
 * The board editor is a position SETUP tool, not a game: any arrangement is
 * allowed (kings may be missing), so we never run legality checks here. Board
 * parsing reuses `parseFenBoard` from ./fen so there's a single FEN parser.
 */

export type EditorPiece = Piece;
export type BoardMap = Map<Square, EditorPiece>;

export interface EditorState {
  board: BoardMap;
  sideToMove: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: string | null;
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
/** Ranks top-to-bottom for rendering the grid (8 at the top). */
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

/** All 64 squares in board render order: a8..h8, a7..h7, …, a1..h1. */
export const SQUARES: Square[] = RANKS.flatMap((rank) =>
  FILES.map((file) => `${file}${rank}` as Square),
);

const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export const STARTING_EDITOR_STATE: EditorState = {
  board: parseFenBoard(START_PLACEMENT)!,
  sideToMove: 'w',
  castling: { wK: true, wQ: true, bK: true, bQ: true },
  enPassant: null,
};

/** Parse a full FEN string into EditorState. Returns null on malformed placement. */
export function fenToEditorState(fen: string): EditorState | null {
  const board = parseFenBoard(fen);
  if (!board) return null;

  const fields = fen.trim().split(/\s+/);
  const sideToMove: Color = fields[1] === 'b' ? 'b' : 'w';
  const rights = fields[2] ?? '-';
  const castling = {
    wK: rights.includes('K'),
    wQ: rights.includes('Q'),
    bK: rights.includes('k'),
    bQ: rights.includes('q'),
  };
  const ep = fields[3] ?? '-';
  const enPassant = ep === '-' || ep === '' ? null : ep;

  return { board, sideToMove, castling, enPassant };
}

/** Serialize EditorState back to a full FEN string (always structurally valid). */
export function editorStateToFen(state: EditorState): string {
  const placement = RANKS.map((rank) => {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const piece = state.board.get(`${file}${rank}` as Square);
      if (!piece) {
        empty++;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    if (empty > 0) row += String(empty);
    return row;
  }).join('/');

  const { wK, wQ, bK, bQ } = state.castling;
  const rights = `${wK ? 'K' : ''}${wQ ? 'Q' : ''}${bK ? 'k' : ''}${bQ ? 'q' : ''}` || '-';
  const ep = state.enPassant ?? '-';

  return `${placement} ${state.sideToMove} ${rights} ${ep} 0 1`;
}

/** Remove the piece (if any) on `square`, returning a new state. */
export function removeSquare(state: EditorState, square: Square): EditorState {
  if (!state.board.has(square)) return state;
  const board = new Map(state.board);
  board.delete(square);
  return { ...state, board };
}

/** Place `piece` on `square`, returning a new state. */
export function placePiece(state: EditorState, square: Square, piece: EditorPiece): EditorState {
  const board = new Map(state.board);
  board.set(square, piece);
  return { ...state, board };
}

/** Move a piece from one square to another, returning a new state. No-op if empty. */
export function movePiece(state: EditorState, from: Square, to: Square): EditorState {
  const piece = state.board.get(from);
  if (!piece || from === to) return state;
  const board = new Map(state.board);
  board.delete(from);
  board.set(to, piece);
  return { ...state, board };
}

/** Empty board, keeping side-to-move and castling. */
export function clearBoard(state: EditorState): EditorState {
  return { ...state, board: new Map(), enPassant: null };
}

/** Whether square is a light square (orientation-independent). */
export function isLightSquare(square: Square): boolean {
  const fileIdx = square.charCodeAt(0) - 97;
  const rankNum = Number(square[1]);
  return (fileIdx + (8 - rankNum)) % 2 === 0;
}

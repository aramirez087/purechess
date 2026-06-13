import { describe, it, expect } from 'vitest';
import {
  STARTING_EDITOR_STATE,
  SQUARES,
  editorStateToFen,
  fenToEditorState,
  type EditorState,
} from '@/lib/board/editor-state';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const ROUND_TRIP: string[] = [
  START_FEN,
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 1',
  '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
  '8/8/8/4k3/8/4K3/8/8 b - - 0 1',
];

describe('editor-state SQUARES', () => {
  it('lists 64 squares in a8..h1 render order', () => {
    expect(SQUARES).toHaveLength(64);
    expect(SQUARES[0]).toBe('a8');
    expect(SQUARES[7]).toBe('h8');
    expect(SQUARES[63]).toBe('h1');
  });
});

describe('fenToEditorState', () => {
  it('parses the starting position into a correct board map', () => {
    const state = fenToEditorState(START_FEN)!;
    expect(state.board.size).toBe(32);
    expect(state.board.get('e1')).toEqual({ type: 'k', color: 'w' });
    expect(state.board.get('e8')).toEqual({ type: 'k', color: 'b' });
    expect(state.board.get('a1')).toEqual({ type: 'r', color: 'w' });
    expect(state.board.get('e4')).toBeUndefined();
    expect(state.sideToMove).toBe('w');
    expect(state.castling).toEqual({ wK: true, wQ: true, bK: true, bQ: true });
    expect(state.enPassant).toBeNull();
  });

  it('returns null on malformed placement', () => {
    expect(fenToEditorState('not a fen')).toBeNull();
    expect(fenToEditorState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w - - 0 1')).toBeNull();
  });

  it('parses a custom position with en-passant and partial castling', () => {
    const state = fenToEditorState('r3k2r/8/8/8/8/8/8/R3K2R b KQq e3 0 1')!;
    expect(state.sideToMove).toBe('b');
    expect(state.castling).toEqual({ wK: true, wQ: true, bK: false, bQ: true });
    expect(state.enPassant).toBe('e3');
  });
});

describe('editorStateToFen', () => {
  it('serializes the starting state to the canonical start FEN', () => {
    expect(editorStateToFen(STARTING_EDITOR_STATE)).toBe(START_FEN);
  });

  it('serializes an empty board', () => {
    const empty: EditorState = {
      board: new Map(),
      sideToMove: 'w',
      castling: { wK: false, wQ: false, bK: false, bQ: false },
      enPassant: null,
    };
    expect(editorStateToFen(empty)).toBe(EMPTY_FEN);
  });
});

describe('round-trip', () => {
  it.each(ROUND_TRIP)('editorStateToFen(fenToEditorState(fen)) === fen for %s', (fen) => {
    expect(editorStateToFen(fenToEditorState(fen)!)).toBe(fen);
  });

  it('parses the empty FEN to a zero-size board', () => {
    expect(fenToEditorState(EMPTY_FEN)!.board.size).toBe(0);
  });
});

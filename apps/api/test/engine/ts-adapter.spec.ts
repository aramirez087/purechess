import { TsEngineAdapter } from '../../src/chess/engine/ts-adapter';
import { GameResult, GameTermination } from '@purechess/shared';

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
// Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
const SCHOLAR_MATE_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';

describe('TsEngineAdapter', () => {
  let adapter: TsEngineAdapter;

  beforeEach(() => {
    adapter = new TsEngineAdapter();
  });

  describe('validateMove', () => {
    it('returns correct outcome for 1.e4 from startpos', async () => {
      const r = await adapter.validateMove(STARTPOS, 'e2e4');
      expect(r.san).toBe('e4');
      expect(r.newFen).toBe(AFTER_E4);
      expect(r.uci).toBe('e2e4');
      expect(r.isCapture).toBe(false);
      expect(r.capturedPiece).toBeNull();
      expect(r.isCheck).toBe(false);
      expect(r.isMate).toBe(false);
    });

    it('rejects illegal move', async () => {
      await expect(adapter.validateMove(STARTPOS, 'e2e5')).rejects.toThrow();
    });

    it('sets isCheck on a checking move', async () => {
      // After 1.e4 e5 2.Bc4 Nc6 3.Qh5 — white to move, Qxf7+ is a checking move
      const qh5Fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 3 3';
      const r = await adapter.validateMove(qh5Fen, 'h5f7'); // Qxf7+
      expect(r.isCheck).toBe(true);
    });

    it('sets isMate for Scholar\'s-mate final move', async () => {
      // Position just before the final Qxf7#: Black played Nf6
      const beforeMate = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
      const r = await adapter.validateMove(beforeMate, 'h5f7');
      expect(r.isMate).toBe(true);
      expect(r.san).toBe('Qxf7#');
    });

    it('sets isCapture and capturedPiece on a capture', async () => {
      // 1.e4 e5 — white pawn on e4, black pawn on e5
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      // d2d4 is not a capture; use Nf3 from startpos after 1.e4 for a non-capture
      // Use a known capture: after 1.e4 d5, exd5
      const afterE4D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const r = await adapter.validateMove(afterE4D5, 'e4d5');
      expect(r.isCapture).toBe(true);
      expect(r.capturedPiece).toBe('p');
    });
  });

  describe('legalMoves', () => {
    it('startpos has 20 legal moves', async () => {
      const moves = await adapter.legalMoves(STARTPOS);
      expect(moves).toHaveLength(20);
    });

    it('moves have uci and san fields', async () => {
      const moves = await adapter.legalMoves(STARTPOS);
      for (const m of moves) {
        expect(m.uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        expect(typeof m.san).toBe('string');
        expect(m.san.length).toBeGreaterThan(0);
      }
    });

    it('returns empty array in checkmate position (no legal moves)', async () => {
      const moves = await adapter.legalMoves(SCHOLAR_MATE_FEN);
      expect(moves).toHaveLength(0);
    });
  });

  describe('detectResult', () => {
    it('returns null at startpos (game ongoing)', async () => {
      expect(await adapter.detectResult(STARTPOS)).toBeNull();
    });

    it('detects checkmate', async () => {
      const r = await adapter.detectResult(SCHOLAR_MATE_FEN);
      expect(r?.reason).toBe(GameTermination.Checkmate);
      expect(r?.result).toBe(GameResult.WhiteWins);
    });

    it('detects stalemate', async () => {
      // Black king stalemated: Ka8 (no moves, not in check), Qb6, Ka6 block all escapes
      const stalemate = 'k7/8/KQ6/8/8/8/8/8 b - - 0 1';
      const r = await adapter.detectResult(stalemate);
      expect(r?.reason).toBe(GameTermination.Stalemate);
      expect(r?.result).toBe(GameResult.Draw);
    });

    it('detects insufficient material (K vs K)', async () => {
      const kVsK = '8/8/8/3k4/3K4/8/8/8 w - - 0 1';
      const r = await adapter.detectResult(kVsK);
      expect(r?.reason).toBe(GameTermination.InsufficientMaterial);
    });

    it('detects 50-move rule', async () => {
      // halfmove clock at 100 with kings-only = also insufficient, test 50-move separately
      const fiftyMove = '8/8/8/4r3/8/8/8/K1k5 w - - 100 1';
      const r = await adapter.detectResult(fiftyMove);
      expect(r?.reason).toBe(GameTermination.FiftyMoveRule);
    });
  });

  describe('applyMoves', () => {
    it('replays 1.e4 e5 from startpos', async () => {
      const r = await adapter.applyMoves(STARTPOS, ['e2e4', 'e7e5']);
      expect(r.moves).toHaveLength(2);
      expect(r.moves[0]!.san).toBe('e4');
      expect(r.moves[1]!.san).toBe('e5');
      expect(r.result).toBeNull();
      expect(r.reason).toBeNull();
    });

    it('detects checkmate during replay', async () => {
      const r = await adapter.applyMoves(STARTPOS, [
        'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7',
      ]);
      expect(r.result).toBe(GameResult.WhiteWins);
      expect(r.reason).toBe(GameTermination.Checkmate);
    });

    it('stops at terminal position and does not apply further moves', async () => {
      const r = await adapter.applyMoves(STARTPOS, [
        'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7', 'e8e7', // extra move after mate
      ]);
      // Should stop at the 7th move (Qxf7#)
      expect(r.moves).toHaveLength(7);
      expect(r.reason).toBe(GameTermination.Checkmate);
    });

    it('returns terminal immediately when starting position is already finished', async () => {
      // SCHOLAR_MATE_FEN is already checkmate; any attempted move hits the preResult guard
      const r = await adapter.applyMoves(SCHOLAR_MATE_FEN, ['e8e7']);
      expect(r.moves).toHaveLength(0);
      expect(r.result).toBe(GameResult.WhiteWins);
      expect(r.reason).toBe(GameTermination.Checkmate);
    });

    it('detects threefold repetition during replay', async () => {
      // Knight shuffle: b1c3 b8c6 c3b1 c6b8 × 2 returns to startpos three times
      const r = await adapter.applyMoves(STARTPOS, [
        'b1c3', 'b8c6', 'c3b1', 'c6b8',
        'b1c3', 'b8c6', 'c3b1', 'c6b8',
      ]);
      expect(r.result).toBe(GameResult.Draw);
      expect(r.reason).toBe(GameTermination.ThreefoldRepetition);
    });
  });

  describe('toPgn', () => {
    it('generates valid PGN for a two-move game', async () => {
      const pgn = await adapter.toPgn(STARTPOS, ['e2e4', 'e7e5'], {
        white: 'Alice',
        black: 'Bob',
        result: '*',
      });
      expect(pgn).toContain('[White "Alice"]');
      expect(pgn).toContain('[Black "Bob"]');
      expect(pgn).toContain('1. e4 e5');
    });
  });

  describe('parseFen', () => {
    it('parses startpos correctly', async () => {
      const r = await adapter.parseFen(STARTPOS);
      expect(r.piecePlacement).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
      expect(r.activeColor).toBe('w');
      expect(r.castling).toBe('KQkq');
      expect(r.enPassant).toBeNull();
      expect(r.halfmoveClock).toBe(0);
      expect(r.fullmoveNumber).toBe(1);
    });

    it('parses en-passant square correctly', async () => {
      // chess.js 1.x omits en passant from FEN when no adjacent pawn can capture;
      // use a standard FEN that explicitly includes the en passant square.
      const fenWithEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const r = await adapter.parseFen(fenWithEp);
      expect(r.enPassant).toBe('e3');
      expect(r.activeColor).toBe('b');
    });
  });
});

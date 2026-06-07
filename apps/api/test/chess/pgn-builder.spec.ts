import { Chess } from 'chess.js';
import { EngineMove } from '@purchess/shared';
import { buildPgn } from '../../src/chess/engine/pgn-builder';

function makeMove(ply: number, san: string, by: 'w' | 'b'): EngineMove {
  return { ply, san, uci: '', fenAfter: '', clockAfterMs: 0, moveTimeMs: 0, by };
}

describe('pgn-builder', () => {
  const headers = {
    white: 'Alice',
    black: 'Bob',
    result: '1-0',
    event: 'Test',
    site: 'Purchess',
    date: '2026.06.06',
  };

  it('formats header tags correctly', () => {
    const pgn = buildPgn([], headers);
    expect(pgn).toContain('[Event "Test"]');
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Bob"]');
    expect(pgn).toContain('[Result "1-0"]');
  });

  it('includes result token at end of move list', () => {
    const moves = [makeMove(1, 'e4', 'w'), makeMove(2, 'e5', 'b')];
    const pgn = buildPgn(moves, headers);
    expect(pgn).toMatch(/1-0$/);
  });

  it('numbers moves correctly for complete pairs', () => {
    const moves = [
      makeMove(1, 'e4', 'w'),
      makeMove(2, 'e5', 'b'),
      makeMove(3, 'Nf3', 'w'),
      makeMove(4, 'Nc6', 'b'),
    ];
    const pgn = buildPgn(moves, headers);
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6');
  });

  it('adds black continuation prefix when first move is black', () => {
    const moves = [makeMove(2, 'e5', 'b'), makeMove(3, 'Nf3', 'w')];
    const pgn = buildPgn(moves, headers);
    expect(pgn).toContain('1... e5');
  });

  it('produces only headers and result for empty move list', () => {
    const pgn = buildPgn([], headers);
    const lines = pgn.split('\n');
    const moveLines = lines.filter((l) => !l.startsWith('[') && l.trim() !== '');
    expect(moveLines).toHaveLength(1);
    expect(moveLines[0]).toBe('1-0');
  });

  it('includes optional headers when provided', () => {
    const pgn = buildPgn([], {
      ...headers,
      timeControl: '300+3',
      whiteElo: 1800,
      blackElo: 1750,
      eco: 'C60',
    });
    expect(pgn).toContain('[TimeControl "300+3"]');
    expect(pgn).toContain('[WhiteElo "1800"]');
    expect(pgn).toContain('[BlackElo "1750"]');
    expect(pgn).toContain('[ECO "C60"]');
  });

  it('omits optional headers when not provided', () => {
    const pgn = buildPgn([], headers);
    expect(pgn).not.toContain('[TimeControl');
    expect(pgn).not.toContain('[WhiteElo');
    expect(pgn).not.toContain('[ECO');
  });

  it('round-trips through chess.js pgn loader', () => {
    const sanMoves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];
    const chessMoves: EngineMove[] = [];
    const sim = new Chess();
    for (let i = 0; i < sanMoves.length; i++) {
      const san = sanMoves[i]!;
      const move = sim.move(san);
      chessMoves.push({
        ply: i + 1,
        san: move.san,
        uci: `${move.from}${move.to}`,
        fenAfter: sim.fen(),
        clockAfterMs: 0,
        moveTimeMs: 0,
        by: move.color,
      });
    }

    const pgn = buildPgn(chessMoves, { ...headers, result: '*' });
    const loader = new Chess();
    loader.loadPgn(pgn);
    expect(loader.history()).toEqual(sanMoves);
  });
});

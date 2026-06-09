/**
 * Generates game-traces.json for the shadow-mode parity suite.
 *
 * Run from repo root (requires chess.js in apps/api node_modules):
 *   cd apps/api && npx ts-node ../../scripts/generate-traces.ts
 *
 * The output is written to:
 *   apps/api/src/chess/engine/__fixtures__/game-traces.json
 *
 * Trace composition (200 total):
 *   - 20 adversarial positions (hand-crafted FEN+UCI sequences)
 *   - 80 deterministic games from startpos (index-based move selection)
 *   - 100 partial traces: first N moves of each deterministic game
 */

import { Chess } from 'chess.js';
import * as fs from 'fs';
import * as path from 'path';

interface GameTrace {
  name: string;
  startFen: string;
  ucis: string[];
  terminalPly?: number;
  expectedResult?: { result: string; reason: string };
}

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function deterministicGame(startFen: string, maxPlies: number, seed: number): GameTrace {
  const chess = new Chess(startFen);
  const ucis: string[] = [];

  for (let i = 0; i < maxPlies; i++) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) break;
    const idx = (i * 7 + seed * 13) % moves.length;
    const m = moves[idx]!;
    chess.move(m);
    ucis.push(`${m.from}${m.to}${m.promotion ?? ''}`);
    if (chess.isGameOver()) break;
  }

  const trace: GameTrace = { name: '', startFen, ucis };
  if (chess.isGameOver()) {
    trace.terminalPly = ucis.length;
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'black_wins' : 'white_wins';
      trace.expectedResult = { result: winner, reason: 'checkmate' };
    } else if (chess.isStalemate()) {
      trace.expectedResult = { result: 'draw', reason: 'stalemate' };
    } else if (chess.isInsufficientMaterial()) {
      trace.expectedResult = { result: 'draw', reason: 'insufficient_material' };
    } else if (chess.isThreefoldRepetition()) {
      trace.expectedResult = { result: 'draw', reason: 'threefold_repetition' };
    } else if (chess.isDraw()) {
      trace.expectedResult = { result: 'draw', reason: 'fifty_move_rule' };
    }
  }

  return trace;
}

// --- Adversarial positions ---------------------------------------------------

const ADVERSARIAL: Array<Omit<GameTrace, 'name'>> = [
  // Scholar's mate (4 moves, checkmate in 4)
  {
    startFen: STARTPOS,
    ucis: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'a7a6', 'h5f7'],
    terminalPly: 7,
    expectedResult: { result: 'white_wins', reason: 'checkmate' },
  },
  // Fool's mate (fastest checkmate, 2 moves)
  {
    startFen: STARTPOS,
    ucis: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
    terminalPly: 4,
    expectedResult: { result: 'black_wins', reason: 'checkmate' },
  },
  // Kiwipete + 5 moves (tests complex position)
  {
    startFen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    ucis: ['e5d7', 'e6d7', 'e1c1', 'd8b8', 'f3e3'],
  },
  // En passant capture chain
  {
    startFen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
    ucis: ['e5d6', 'c8d7', 'd6d7', 'b8c6', 'd7c8q'],
  },
  // En passant on h-file
  {
    startFen: 'rnbqkb1r/pppppp1p/5n2/6pP/8/8/PPPPPPP1/RNBQKBNR w KQkq g6 0 3',
    ucis: ['h5g6'],
  },
  // En passant on a-file
  {
    startFen: 'rnbqkbnr/1ppppppp/8/pP6/8/8/P1PPPPPP/RNBQKBNR w KQkq a6 0 2',
    ucis: ['b5a6'],
  },
  // Queen promotion
  {
    startFen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    ucis: ['a7a8q'],
  },
  // Knight underpromotion
  {
    startFen: '8/4P3/8/8/8/8/8/4K2k w - - 0 1',
    ucis: ['e7e8n'],
  },
  // Rook underpromotion
  {
    startFen: '8/4P3/8/8/8/8/8/4K2k w - - 0 1',
    ucis: ['e7e8r'],
  },
  // 50-move rule brink (halfmove 98, 2 non-capture non-pawn moves → draw)
  {
    startFen: '4k3/8/4K3/8/8/8/8/4R3 w - - 98 50',
    ucis: ['e1e2', 'e8f8', 'e2e1'],
  },
  // Stalemate setup
  {
    startFen: '5k2/5P2/5K2/8/8/8/8/8 b - - 0 1',
    ucis: [],
  },
  // Insufficient material: K vs K
  {
    startFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    ucis: ['e1d1', 'e8d8', 'd1c1', 'd8c8', 'c1b1', 'c8b8'],
  },
  // Insufficient material: K+B vs K
  {
    startFen: '4k3/8/8/8/8/8/8/4KB2 w - - 0 1',
    ucis: ['e1d2', 'e8e7', 'd2c3', 'e7e8'],
  },
  // Threefold repetition setup (king shuffle)
  {
    startFen: '4k3/8/4K3/8/8/8/8/8 w - - 0 1',
    ucis: ['e6d6', 'e8f8', 'd6e6', 'f8e8', 'e6d6', 'e8f8', 'd6e6', 'f8e8', 'e6d6', 'e8f8', 'd6e6'],
  },
  // Castling — both sides
  {
    startFen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    ucis: ['e1g1', 'e8c8'],
  },
  // Double en passant stress (Kiwipete variant)
  {
    startFen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    ucis: ['g1h1', 'b2a1q', 'h1g1'],
  },
  // Checkmate by back rank
  {
    startFen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    ucis: ['d1d8'],
    terminalPly: 1,
    expectedResult: { result: 'white_wins', reason: 'checkmate' },
  },
  // Smothered mate setup
  {
    startFen: '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1',
    ucis: ['h6f7'],
    terminalPly: 1,
    expectedResult: { result: 'white_wins', reason: 'checkmate' },
  },
  // Promotion with check
  {
    startFen: '4k3/P7/4K3/8/8/8/8/8 w - - 0 1',
    ucis: ['a7a8q', 'e8d8', 'a8e4'],
  },
  // 50-move rule triggered exactly
  {
    startFen: '4k3/8/4K3/8/8/8/8/4R3 w - - 100 51',
    ucis: [],
  },
];

// --- Generate all traces ----------------------------------------------------

const traces: GameTrace[] = [];

// Adversarial (20)
ADVERSARIAL.forEach((t, i) => {
  traces.push({ ...t, name: `adversarial-${String(i + 1).padStart(2, '0')}` });
});

// Deterministic games from startpos (80 games with seeds 0-79)
for (let seed = 0; seed < 80; seed++) {
  const maxPlies = 15 + (seed % 50); // 15-64 plies
  const trace = deterministicGame(STARTPOS, maxPlies, seed);
  trace.name = `game-${String(seed + 1).padStart(3, '0')}`;
  traces.push(trace);
}

// Partial traces: first 5 plies of games 1-100 (100 short traces)
for (let seed = 0; seed < 100; seed++) {
  const full = deterministicGame(STARTPOS, 5 + (seed % 20), seed * 3);
  traces.push({
    name: `partial-${String(seed + 1).padStart(3, '0')}`,
    startFen: STARTPOS,
    ucis: full.ucis.slice(0, Math.min(full.ucis.length, 5 + (seed % 15))),
  });
}

// Write output
const outDir = path.resolve(__dirname, '../apps/api/src/chess/engine/__fixtures__');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'game-traces.json');
fs.writeFileSync(outPath, JSON.stringify(traces, null, 2));
console.error(`Written ${traces.length} traces to ${outPath}`);

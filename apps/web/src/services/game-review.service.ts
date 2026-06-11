import { Chess } from 'chess.js';
import { GameResult, GameTermination, TimeCategory } from '@purechess/shared';
import type { ComputerGameStateDto, PvpGameStateDto } from '@purechess/shared';
import type { AnalysisReview, GameReview } from '@/types/game-review';
import type { WireMove } from '@purechess/shared';

const MOCK_GAME_ID = 'demo-game-001';

const MOCK_REVIEW: GameReview = {
  id: MOCK_GAME_ID,
  white: { id: 'user-1', username: 'Magnus', rating: 2850 },
  black: { id: 'user-2', username: 'Hikaru', rating: 2800 },
  moves: [
    { ply: 1, san: 'e4', uci: 'e2e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', clockAfterMs: 180000, moveTimeMs: 1200, by: 'w' },
    { ply: 2, san: 'e5', uci: 'e7e5', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', clockAfterMs: 180000, moveTimeMs: 900, by: 'b' },
    { ply: 3, san: 'Nf3', uci: 'g1f3', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', clockAfterMs: 179000, moveTimeMs: 1000, by: 'w' },
    { ply: 4, san: 'Nc6', uci: 'b8c6', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', clockAfterMs: 179500, moveTimeMs: 500, by: 'b' },
    { ply: 5, san: 'Bb5', uci: 'f1b5', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', clockAfterMs: 178000, moveTimeMs: 1000, by: 'w' },
    { ply: 6, san: 'a6', uci: 'a7a6', fenAfter: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', clockAfterMs: 178500, moveTimeMs: 1000, by: 'b' },
  ],
  finalFen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
  pgn: '[Event "Purechess"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0',
  result: GameResult.WhiteWins,
  termination: GameTermination.Resignation,
  timeControl: { initialSeconds: 180, incrementSeconds: 0, category: TimeCategory.Blitz, label: '3 min' },
  rated: true,
  startedAt: '2026-06-06T10:00:00.000Z',
};

const RESULT_MAP: Record<string, GameResult> = {
  white_wins: GameResult.WhiteWins,
  black_wins: GameResult.BlackWins,
  draw: GameResult.Draw,
};

const TERM_MAP: Record<string, GameTermination> = {
  checkmate: GameTermination.Checkmate,
  resignation: GameTermination.Resignation,
  timeout: GameTermination.Timeout,
  stalemate: GameTermination.Stalemate,
  insufficient_material: GameTermination.InsufficientMaterial,
  threefold_repetition: GameTermination.ThreefoldRepetition,
  fifty_move_rule: GameTermination.FiftyMoveRule,
  draw_agreement: GameTermination.DrawAgreement,
  abandonment: GameTermination.Abandonment,
};

function buildMovesFromPgn(pgn: string): WireMove[] {
  if (!pgn.trim()) return [];
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    const replay = new Chess();
    return history.map((m, i) => {
      replay.move(m.san);
      return {
        ply: i + 1,
        san: m.san,
        uci: m.from + m.to + (m.promotion ?? ''),
        fenAfter: replay.fen(),
        clockAfterMs: 0,
        moveTimeMs: 0,
        by: m.color as 'w' | 'b',
      };
    });
  } catch {
    return [];
  }
}

function buildReviewFromComputerGame(
  state: ComputerGameStateDto,
  currentUser: { id: string; username: string } | null,
): GameReview {
  const humanColor = state.computerColor === 'white' ? 'black' : 'white';
  const human = {
    id: currentUser?.id ?? 'player',
    username: currentUser?.username ?? 'Player',
    rating: 0,
  };
  const computer = { id: 'computer', username: 'Computer', rating: state.computerLevel };

  const white = state.computerColor === 'white' ? computer : human;
  const black = state.computerColor === 'black' ? computer : human;

  return {
    id: state.gameId,
    white,
    black,
    moves: buildMovesFromPgn(state.pgn),
    finalFen: state.fen,
    pgn: state.pgn,
    result: RESULT_MAP[state.result ?? ''] ?? GameResult.Draw,
    termination: TERM_MAP[state.resultReason ?? ''] ?? GameTermination.Resignation,
    timeControl: {
      initialSeconds: 0,
      incrementSeconds: 0,
      category: TimeCategory.Rapid,
      label: state.clock ? 'Timed' : 'Untimed',
    },
    rated: false,
    // The computer-game DTO carries no start date — empty string means "omit".
    startedAt: '',
  };
}

async function getComputerGameReview(
  gameId: string,
  currentUser: { id: string; username: string } | null,
): Promise<GameReview | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/computer-games/${gameId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const state = (await res.json()) as ComputerGameStateDto;
    if (state.status !== 'completed') return null;
    return buildReviewFromComputerGame(state, currentUser);
  } catch {
    return null;
  }
}

function buildReviewFromPvpGame(state: PvpGameStateDto): GameReview {
  return {
    id: state.gameId,
    white: {
      id: state.white?.id ?? 'white',
      username: state.white?.username ?? 'White',
      rating: 0,
    },
    black: {
      id: state.black?.id ?? 'black',
      username: state.black?.username ?? 'Black',
      rating: 0,
    },
    moves: buildMovesFromPgn(state.pgn),
    finalFen: state.fen,
    pgn: state.pgn,
    result: RESULT_MAP[state.result ?? ''] ?? GameResult.Draw,
    termination: TERM_MAP[state.resultReason ?? ''] ?? GameTermination.Resignation,
    timeControl: {
      initialSeconds: state.timeControlSeconds,
      incrementSeconds: state.incrementSeconds,
      category: TimeCategory.Rapid,
      label:
        state.timeControlSeconds > 0
          ? `${Math.floor(state.timeControlSeconds / 60)}+${state.incrementSeconds}`
          : 'Untimed',
    },
    rated: false,
    startedAt: '',
  };
}

/** PvP state is player-scoped — forward the viewer's session cookie. */
async function getPvpGameReview(
  gameId: string,
  sessionCookie: string | null,
): Promise<GameReview | null> {
  if (!sessionCookie) return null;
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/games/${gameId}/state`, {
      cache: 'no-store',
      headers: { Cookie: `purechess_session=${sessionCookie}` },
    });
    if (!res.ok) return null;
    const state = (await res.json()) as PvpGameStateDto;
    if (state.status !== 'completed') return null;
    return buildReviewFromPvpGame(state);
  } catch {
    return null;
  }
}

// --- /analyze: synthesize a review from pasted PGN / FEN ----------------

const PGN_RESULT_MAP: Record<string, GameResult> = {
  '1-0': GameResult.WhiteWins,
  '0-1': GameResult.BlackWins,
  '1/2-1/2': GameResult.Draw,
};

const ANALYSIS_TIME_CONTROL = {
  initialSeconds: 0,
  incrementSeconds: 0,
  category: TimeCategory.Rapid,
  label: 'Analysis',
};

/** Verdict derivable from the position alone — anything else stays unknown. */
function detectVerdict(chess: Chess): {
  result?: GameResult;
  termination?: GameTermination;
} {
  if (chess.isCheckmate()) {
    return {
      result: chess.turn() === 'w' ? GameResult.BlackWins : GameResult.WhiteWins,
      termination: GameTermination.Checkmate,
    };
  }
  if (chess.isStalemate()) {
    return { result: GameResult.Draw, termination: GameTermination.Stalemate };
  }
  if (chess.isInsufficientMaterial()) {
    return { result: GameResult.Draw, termination: GameTermination.InsufficientMaterial };
  }
  return {};
}

/** chess.js fills unknown headers with "?" — treat those as absent. */
function headerName(value: string | undefined, fallback: string): string {
  return value && value !== '?' ? value : fallback;
}

/** PGN `[Date "2026.06.01"]` → ISO string; unknown/partial dates → '' (no date row). */
function parsePgnDate(value: string | undefined): string {
  if (!value || !/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return '';
  const iso = `${value.replaceAll('.', '-')}T00:00:00.000Z`;
  return Number.isNaN(new Date(iso).getTime()) ? '' : iso;
}

/**
 * Builds a reviewable analysis from a pasted PGN (custom `[FEN]` start
 * positions supported). Returns null when the PGN cannot be parsed.
 * The result/termination are only what the record honestly supports: a
 * terminal final position, else the PGN Result header, else unknown.
 */
export function buildReviewFromPgn(pgn: string): AnalysisReview | null {
  const text = pgn.trim();
  if (!text) return null;
  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch {
    return null;
  }
  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const verdict = detectVerdict(chess);
  return {
    id: 'analysis',
    white: { id: 'white', username: headerName(headers.White, 'White'), rating: 0 },
    black: { id: 'black', username: headerName(headers.Black, 'Black'), rating: 0 },
    moves: history.map((m, i) => ({
      ply: i + 1,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      fenAfter: m.after,
      clockAfterMs: 0,
      moveTimeMs: 0,
      by: m.color as 'w' | 'b',
    })),
    startFen: history[0]?.before ?? chess.fen(),
    finalFen: chess.fen(),
    pgn: chess.pgn(),
    result: verdict.result ?? PGN_RESULT_MAP[headers.Result ?? ''],
    termination: verdict.termination,
    timeControl: ANALYSIS_TIME_CONTROL,
    rated: false,
    startedAt: parsePgnDate(headers.Date),
  };
}

/**
 * Builds a single-position analysis from a pasted FEN (board shows the
 * position, move sheet stays empty). Returns null when the FEN is invalid.
 */
export function buildReviewFromFen(fen: string): AnalysisReview | null {
  const text = fen.trim();
  if (!text) return null;
  let chess: Chess;
  try {
    chess = new Chess(text);
  } catch {
    return null;
  }
  const normalized = chess.fen();
  const verdict = detectVerdict(chess);
  return {
    id: 'analysis',
    white: { id: 'white', username: 'White', rating: 0 },
    black: { id: 'black', username: 'Black', rating: 0 },
    moves: [],
    startFen: normalized,
    finalFen: normalized,
    // chess.js emits SetUp/FEN headers, so Copy PGN round-trips the position.
    pgn: chess.pgn(),
    result: verdict.result,
    termination: verdict.termination,
    timeControl: ANALYSIS_TIME_CONTROL,
    rated: false,
    startedAt: '',
  };
}

export async function getReview(
  gameId: string,
  currentUser?: { id: string; username: string } | null,
  sessionCookie?: string | null,
): Promise<GameReview | null> {
  if (gameId === MOCK_GAME_ID) {
    return MOCK_REVIEW;
  }

  const computer = await getComputerGameReview(gameId, currentUser ?? null);
  if (computer) return computer;

  return getPvpGameReview(gameId, sessionCookie ?? null);
}

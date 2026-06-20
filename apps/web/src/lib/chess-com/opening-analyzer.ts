import { Chess } from 'chess.js';
import type {
  ChessComGameDto,
  ChessComOpeningMistakeCandidateDto,
} from '@purechess/shared';
import { analyze } from '@/lib/engine/stockfish-client';
import { cpToWinPercent } from '@/lib/board/accuracy';
import { classify, normalizeEval } from '@/hooks/use-move-classifier';
import { lookupByFen } from '@/lib/openings';

/** Only analyze this many plies per game (opening phase). */
export const MAX_OPENING_PLY = 22;
/** Centipawn-loss floor — matches the server's persistence gate. */
export const OPENING_MISTAKE_CP = 80;
const MOVETIME_MS = 700;

function openingLabelFromPgn(pgn: string, fenAtMistake: string): string {
  const eco = lookupByFen(fenAtMistake);
  if (eco?.name) return eco.name;

  const openingTag = pgn.match(/\[Opening\s+"([^"]+)"\]/i)?.[1];
  if (openingTag) return openingTag;

  const ecoTag = pgn.match(/\[ECO\s+"([^"]+)"\]/i)?.[1];
  if (ecoTag) return ecoTag;

  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const moves = chess.history();
    if (moves.length >= 4) {
      return moves.slice(0, 4).join(' ');
    }
  } catch {
    // fall through
  }
  return 'your opening';
}

/**
 * Analyze the opening phase of one chess.com game for the linked user's moves.
 * Runs Stockfish in the browser — the server only stores the results.
 */
export async function analyzeChessComGameOpening(
  game: ChessComGameDto,
  signal?: { cancelled: boolean },
): Promise<ChessComOpeningMistakeCandidateDto[]> {
  if (!game.userColor || !game.pgn.trim()) return [];

  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch {
    return [];
  }

  const history = chess.history({ verbose: true });
  const replay = new Chess();
  const mistakes: ChessComOpeningMistakeCandidateDto[] = [];
  const userIsWhite = game.userColor === 'white';
  const playedAt = new Date(game.endTime * 1000).toISOString();

  for (let ply = 1; ply <= Math.min(history.length, MAX_OPENING_PLY); ply++) {
    if (signal?.cancelled) return mistakes;

    const move = history[ply - 1];
    const fenBefore = replay.fen();
    const whiteToMove = fenBefore.split(' ')[1] === 'w';
    const isUserMove = userIsWhite === whiteToMove;
    if (!isUserMove) {
      replay.move(move.san);
      continue;
    }

    const legalMoveCount = replay.moves().length;
    const line = await analyze(fenBefore, { movetimeMs: MOVETIME_MS });
    if (signal?.cancelled) return mistakes;

    const whitePovBefore =
      (whiteToMove ? 1 : -1) * normalizeEval(line.cp, line.mate);

    replay.move(move.san);
    const fenAfter = replay.fen();

    let whitePovAfter: number;
    if (replay.isGameOver()) {
      whitePovAfter = replay.isCheckmate()
        ? fenAfter.split(' ')[1] === 'w'
          ? -10000
          : 10000
        : 0;
    } else {
      const afterLine = await analyze(fenAfter, { movetimeMs: MOVETIME_MS });
      if (signal?.cancelled) return mistakes;
      const afterWhiteToMove = fenAfter.split(' ')[1] === 'w';
      whitePovAfter =
        (afterWhiteToMove ? 1 : -1) * normalizeEval(afterLine.cp, afterLine.mate);
    }

    const sign = whiteToMove ? 1 : -1;
    const moverBefore = sign * whitePovBefore;
    const moverAfter = sign * whitePovAfter;
    const cpLoss = Math.max(0, Math.round(moverBefore - moverAfter));
    const winLoss = Math.max(0, cpToWinPercent(moverBefore) - cpToWinPercent(moverAfter));
    const moveClass = classify(winLoss, legalMoveCount);

    const bestUci = line.bestmove;
    if (!bestUci || bestUci.length < 4) continue;
    if (cpLoss < OPENING_MISTAKE_CP && moveClass !== 'mistake' && moveClass !== 'blunder') {
      continue;
    }
    if (bestUci === move.from + move.to + (move.promotion ?? '')) continue;

    let bestSan: string | undefined;
    try {
      const probe = new Chess(fenBefore);
      const applied = probe.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci[4] as 'q' | 'r' | 'b' | 'n' | undefined,
      });
      bestSan = applied?.san;
    } catch {
      bestSan = undefined;
    }

    mistakes.push({
      gameId: game.id,
      gameUrl: game.url,
      ply,
      fen: fenBefore,
      playedUci: move.from + move.to + (move.promotion ?? ''),
      playedSan: move.san,
      bestUci,
      bestSan,
      cpLoss,
      openingLabel: openingLabelFromPgn(game.pgn, fenBefore),
      playedAt,
    });
  }

  return mistakes;
}
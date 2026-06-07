import { GameResult, GameTermination, TimeCategory } from '@purechess/shared';
import type { GameReview } from '@/types/game-review';

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

export async function getReview(gameId: string): Promise<GameReview | null> {
  if (gameId === MOCK_GAME_ID) {
    return MOCK_REVIEW;
  }

  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/games/${gameId}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as GameReview;
  } catch {
    return null;
  }
}

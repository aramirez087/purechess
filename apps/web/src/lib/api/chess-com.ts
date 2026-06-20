import type {
  ChessComGamesDto,
  ChessComLinkDto,
  ChessComOpeningMistakesDto,
  SaveChessComMistakesDto,
  SetChessComLinkDto,
} from '@purechess/shared';
import { API_BASE as API, ensureOk } from './client';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export async function fetchChessComLink(): Promise<ChessComLinkDto> {
  const res = await fetch(`${API}/api/chess-com/link`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'chess.com link');
  return res.json() as Promise<ChessComLinkDto>;
}

export async function setChessComLink(body: SetChessComLinkDto): Promise<ChessComLinkDto> {
  const res = await fetch(`${API}/api/chess-com/link`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'chess.com link set');
  return res.json() as Promise<ChessComLinkDto>;
}

export async function clearChessComLink(): Promise<ChessComLinkDto> {
  const res = await fetch(`${API}/api/chess-com/link`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'chess.com link clear');
  return res.json() as Promise<ChessComLinkDto>;
}

export async function fetchChessComGames(): Promise<ChessComGamesDto> {
  const res = await fetch(`${API}/api/chess-com/games`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'chess.com games');
  return res.json() as Promise<ChessComGamesDto>;
}

export async function fetchChessComMistakes(): Promise<ChessComOpeningMistakesDto> {
  const res = await fetch(`${API}/api/chess-com/opening-mistakes`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'chess.com mistakes');
  return res.json() as Promise<ChessComOpeningMistakesDto>;
}

export async function saveChessComMistakes(
  body: SaveChessComMistakesDto,
): Promise<ChessComOpeningMistakesDto> {
  const res = await fetch(`${API}/api/chess-com/opening-mistakes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'chess.com mistakes save');
  return res.json() as Promise<ChessComOpeningMistakesDto>;
}

export async function completeChessComSync(gamesScanned: number): Promise<ChessComLinkDto> {
  const res = await fetch(`${API}/api/chess-com/sync-complete`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ gamesScanned }),
  });
  await ensureOk(res, 'chess.com sync complete');
  return res.json() as Promise<ChessComLinkDto>;
}

export async function markChessComMistakeReviewed(gameId: string, ply: number): Promise<void> {
  const res = await fetch(
    `${API}/api/chess-com/opening-mistakes/${encodeURIComponent(gameId)}/${ply}/reviewed`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
  );
  await ensureOk(res, 'chess.com mistake reviewed');
}
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { PvpGameStateDto } from '@purechess/shared';
import { LiveGameClient } from './live-game-client';

export const metadata: Metadata = {
  title: 'Live game — Purechess',
  robots: 'noindex',
};

interface Props {
  params: { gameId: string };
}

/**
 * Server-side state fetch so the board streams as HTML and the piece images
 * become LCP candidates immediately — same pattern as /computer-game. Any
 * failure (no session, 404, network) resolves null and the client keeps its
 * original fetch-on-mount path, so this is purely an accelerator.
 */
async function fetchInitialGame(gameId: string): Promise<PvpGameStateDto | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('purechess_session');

  const apiUrl =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/games/${gameId}/state`, {
      headers: sessionCookie ? { Cookie: `purechess_session=${sessionCookie.value}` } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PvpGameStateDto;
  } catch {
    return null;
  }
}

export default async function LiveGamePage({ params }: Props) {
  const initialGame = await fetchInitialGame(params.gameId);
  return <LiveGameClient gameId={params.gameId} initialGame={initialGame} />;
}

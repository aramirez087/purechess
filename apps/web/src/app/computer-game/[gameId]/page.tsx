import { cookies } from 'next/headers';
import type { ComputerGameStateDto } from '@purechess/shared';
import { ComputerGameClient } from './computer-game-client';

interface Props {
  params: { gameId: string };
}

/**
 * Server-side state fetch so the board streams as HTML and the piece images
 * become LCP candidates immediately — the old client-only flow paid route JS
 * download + hydration + a client fetch before anything board-shaped painted.
 * Any failure (no session, 404, network) resolves null and the client keeps
 * its original fetch-on-mount path, so this is purely an accelerator.
 */
async function fetchInitialGame(gameId: string): Promise<ComputerGameStateDto | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('purechess_session');

  const apiUrl =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/computer-games/${gameId}`, {
      headers: sessionCookie ? { Cookie: `purechess_session=${sessionCookie.value}` } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ComputerGameStateDto;
  } catch {
    return null;
  }
}

export default async function ComputerGamePage({ params }: Props) {
  const initialGame = await fetchInitialGame(params.gameId);
  return <ComputerGameClient gameId={params.gameId} initialGame={initialGame} />;
}

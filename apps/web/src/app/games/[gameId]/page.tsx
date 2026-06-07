import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getReview } from '@/services/game-review.service';
import { buildMetadata } from '@/lib/seo';
import { ReviewClient } from './review-client';
import { AppShell } from '@/components/layout/AppShell';
import { GameResult } from '@purechess/shared';

interface Props {
  params: { gameId: string };
}

function formatResult(result: GameResult): string {
  switch (result) {
    case GameResult.WhiteWins: return '1-0';
    case GameResult.BlackWins: return '0-1';
    case GameResult.Draw: return '½-½';
  }
}

async function getCurrentUser(): Promise<{ id: string; username: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('purechess_session');
  if (!sessionCookie) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `purechess_session=${sessionCookie.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ id: string; username: string }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const review = await getReview(params.gameId);
  if (!review) return { title: 'Game not found — Purechess' };
  const resultLabel = formatResult(review.result);
  return buildMetadata({
    title: `Purechess — ${review.white.username} vs ${review.black.username}`,
    description: `Review this ${review.timeControl.label} ${review.rated ? 'rated' : 'casual'} game: ${resultLabel}.`,
    canonical: `/games/${review.id}`,
  });
}

export default async function GameReviewPage({ params }: Props) {
  const [review, currentUser] = await Promise.all([
    getReview(params.gameId),
    getCurrentUser(),
  ]);
  if (!review) notFound();

  let reportTarget: { opponentId: string; opponentUsername: string } | null = null;
  if (currentUser) {
    if (currentUser.id === review.white.id) {
      reportTarget = { opponentId: review.black.id, opponentUsername: review.black.username };
    } else if (currentUser.id === review.black.id) {
      reportTarget = { opponentId: review.white.id, opponentUsername: review.white.username };
    }
  }

  return (
    <AppShell>
      <ReviewClient game={review} reportTarget={reportTarget} />
    </AppShell>
  );
}

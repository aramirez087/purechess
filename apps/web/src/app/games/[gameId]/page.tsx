import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getReview } from '@/services/game-review.service';
import { buildMetadata } from '@/lib/seo';
import { ReviewClient } from './review-client';
import { AppShell } from '@/components/layout/AppShell';
import { GameResult } from '@purchess/shared';

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const review = await getReview(params.gameId);
  if (!review) return { title: 'Game not found — Purchess' };
  const resultLabel = formatResult(review.result);
  return buildMetadata({
    title: `Purchess — ${review.white.username} vs ${review.black.username}`,
    description: `Review this ${review.timeControl.label} ${review.rated ? 'rated' : 'casual'} game: ${resultLabel}.`,
    canonical: `/games/${review.id}`,
  });
}

export default async function GameReviewPage({ params }: Props) {
  const review = await getReview(params.gameId);
  if (!review) notFound();

  return (
    <AppShell>
      <ReviewClient game={review} />
    </AppShell>
  );
}

import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import type { ReviewDueDto, SafeUser } from '@purechess/shared';
import { ReviewClient } from './review-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Review — Purechess',
  description:
    'Spaced repetition for tactics. Puzzles you missed come back at growing intervals until they stick — the highest-yield habit in chess training.',
  canonical: '/puzzles/review',
});

const EMPTY_DUE: ReviewDueDto = { puzzles: [], dueCount: 0, nextDueAt: null };

export default async function PuzzleReviewPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx. Review
  // is a per-user queue, so it requires auth; signed-out users see a prompt.
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedIn = Boolean(me?.user);

  const due = signedIn
    ? ((await serverFetch<ReviewDueDto>('/api/puzzles/review/due', { withAuth: true })) ??
      EMPTY_DUE)
    : EMPTY_DUE;

  return <ReviewClient signedIn={signedIn} initialDue={due} />;
}

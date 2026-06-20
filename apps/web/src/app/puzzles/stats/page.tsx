import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import type { PuzzleHistoryDto, PuzzleThemeStatDto, SafeUser } from '@purechess/shared';
import { PuzzleStatsClient } from './stats-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Puzzle stats — Purechess',
  description:
    'Your puzzle rating over time and your accuracy by theme, weakest first — so every training session targets a real weakness.',
  canonical: '/puzzles/stats',
});

export default async function PuzzleStatsPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx. Stats are
  // entirely personal, so signed-out users get a sign-in prompt (no public data).
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', { withAuth: true });
  const signedIn = Boolean(me?.user);

  const [history, stats] = signedIn
    ? await Promise.all([
        serverFetch<PuzzleHistoryDto>('/api/puzzles/history', { withAuth: true }),
        serverFetch<PuzzleThemeStatDto[]>('/api/puzzles/stats', { withAuth: true }),
      ])
    : [null, null];

  return (
    <PuzzleStatsClient signedIn={signedIn} history={history} stats={stats ?? []} />
  );
}

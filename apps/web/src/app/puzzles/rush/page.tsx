import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import type { RushPersonalBestsDto, SafeUser } from '@purechess/shared';
import { RushClient } from './rush-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Puzzle Rush — Purechess',
  description:
    'Race the clock against escalating tactics. The single best drill against hanging pieces — train fast pattern recognition under pressure.',
  canonical: '/puzzles/rush',
});

const EMPTY_BESTS: RushPersonalBestsDto = { '3min': 0, '5strikes': 0 };

export default async function PuzzleRushPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx. Rush
  // requires auth to play (it writes a server-owned personal best); signed-out
  // users see a sign-in prompt.
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedIn = Boolean(me?.user);

  const bests = signedIn
    ? ((await serverFetch<RushPersonalBestsDto>('/api/puzzles/rush/pb', { withAuth: true })) ??
      EMPTY_BESTS)
    : EMPTY_BESTS;

  return (
    <AppShell>
      <RushClient signedIn={signedIn} initialBests={bests} />
    </AppShell>
  );
}

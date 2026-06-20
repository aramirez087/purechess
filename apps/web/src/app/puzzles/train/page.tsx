import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import type {
  PuzzleThemeDto,
  PuzzleThemeStatDto,
  SafeUser,
} from '@purechess/shared';
import { TrainClient } from './train-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Train by theme — Purechess',
  description:
    'Drill tactics by theme, calibrated to your rating. Your weakest themes surface first so every session targets real improvement.',
  canonical: '/puzzles/train',
});

type Props = {
  searchParams: Promise<{ theme?: string }>;
};

export default async function PuzzleTrainPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialTheme = typeof sp.theme === 'string' && sp.theme.length > 0 ? sp.theme : null;

  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx. The
  // selection grid is browsable signed-out (read-only); only accuracy + the
  // drill require auth. The daily puzzle stays the no-auth entry point.
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedIn = Boolean(me?.user);

  // Themes are public; stats need auth (null/empty when signed out).
  const themes = (await serverFetch<PuzzleThemeDto[]>('/api/puzzles/themes')) ?? [];
  const stats = signedIn
    ? (await serverFetch<PuzzleThemeStatDto[]>('/api/puzzles/stats', { withAuth: true })) ?? []
    : [];

  return (
    <TrainClient
      themes={themes}
      stats={stats}
      signedIn={signedIn}
      initialTheme={initialTheme}
    />
  );
}

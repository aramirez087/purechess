import type { Metadata } from 'next';
import type {
  InsightDto,
  SafeUser,
  TrainingPlanDto,
  TrainingStreakDto,
} from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { TrainClient } from './train-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Train — Purechess',
  description:
    'Your training hub: a focused 10-minute plan aimed at your weakest area, with puzzles, openings and endgames — and a streak that rewards showing up.',
  canonical: '/train',
});

export default async function TrainPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx.
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', { withAuth: true });
  const signedIn = Boolean(me?.user);

  // The hub's three signals are auth-gated; fetch them only when signed in. Each
  // is fetched defensively — a single failure degrades to null, never 500s the
  // page (the hub renders the parts it has).
  const [plan, streak, insight] = signedIn
    ? await Promise.all([
        serverFetch<TrainingPlanDto>('/api/train/plan', { withAuth: true }).catch(() => null),
        serverFetch<TrainingStreakDto>('/api/train/streak', { withAuth: true }).catch(() => null),
        serverFetch<InsightDto>('/api/train/insights', { withAuth: true }).catch(() => null),
      ])
    : [null, null, null];

  return (
    <AppShell>
      <TrainClient signedIn={signedIn} plan={plan} streak={streak} insight={insight} />
    </AppShell>
  );
}

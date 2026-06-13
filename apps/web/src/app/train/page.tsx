import type { Metadata } from 'next';
import { Target } from 'lucide-react';
import type { SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { TrainingPlaceholder } from '@/components/improve/training-placeholder';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Train — Purechess',
  description:
    'Your training hub: a focused 10-minute plan aimed at your weakest area, with puzzles, openings and endgames.',
  canonical: '/train',
});

export default async function TrainPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx.
  const result = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedOut = !result?.user;

  return (
    <AppShell>
      <TrainingPlaceholder
        icon={Target}
        eyebrow="Improve"
        title="Train"
        description="One place to get better: a daily plan that targets your weakest area, calibrated to your rating."
        upcoming={[
          'A 10-minute daily plan built from your weakest themes',
          'A puzzle trainer calibrated to your rating, with adaptive difficulty',
          'Spaced repetition of the puzzles you failed',
          'Tactics drawn from your own lost games',
          'Streaks, goals and a progress view that shows your rating moving',
        ]}
        signedOut={signedOut}
        related={[
          { href: '/puzzles', label: 'Daily puzzle' },
          { href: '/openings', label: 'Openings' },
          { href: '/endgames', label: 'Endgames' },
        ]}
      />
    </AppShell>
  );
}

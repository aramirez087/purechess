import type { Metadata } from 'next';
import { Castle } from 'lucide-react';
import type { SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { TrainingPlaceholder } from '@/components/improve/training-placeholder';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Endgames — Purechess',
  description:
    'Drill the endgames you actually reach — defend and convert against a perfect opponent until the technique is yours.',
  canonical: '/endgames',
});

export default async function EndgamesPage() {
  const result = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedOut = !result?.user;

  return (
    <AppShell>
      <TrainingPlaceholder
        icon={Castle}
        eyebrow="Improve"
        title="Endgames"
        description="Winning a won position is a skill you can train. Drill curated endgames against perfect play and learn the technique."
        upcoming={[
          'A curated set of must-know endgames, by family',
          'Convert and defend against tablebase-perfect play',
          'Clear pass/fail with the line you should have found',
          'Your weakest endgame family surfaced from your games',
        ]}
        signedOut={signedOut}
        related={[
          { href: '/train', label: 'Training hub' },
          { href: '/openings', label: 'Openings' },
        ]}
      />
    </AppShell>
  );
}

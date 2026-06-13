import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import type { SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { TrainingPlaceholder } from '@/components/improve/training-placeholder';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Openings — Purechess',
  description:
    'Build and drill your own opening repertoire — your lines, spaced for memory, with out-of-book detection.',
  canonical: '/openings',
});

export default async function OpeningsPage() {
  const result = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  const signedOut = !result?.user;

  return (
    <AppShell>
      <TrainingPlaceholder
        icon={BookOpen}
        eyebrow="Improve"
        title="Openings"
        description="Drill the openings you actually play. Import a repertoire, then practise your own lines until they are automatic."
        upcoming={[
          'A repertoire stored as a move tree, for White and Black',
          'Import from PGN or the opening explorer',
          'Spaced-repetition drilling of your own lines',
          'Out-of-book detection so you fix the move you actually forget',
        ]}
        signedOut={signedOut}
        related={[
          { href: '/train', label: 'Training hub' },
          { href: '/endgames', label: 'Endgames' },
        ]}
      />
    </AppShell>
  );
}

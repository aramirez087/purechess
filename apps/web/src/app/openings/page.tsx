import type { Metadata } from 'next';
import type { SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { OpeningsClient } from './openings-client';
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
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <OpeningsClient signedOut={signedOut} />
      </div>
    </AppShell>
  );
}

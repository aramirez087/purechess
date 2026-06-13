import type { Metadata } from 'next';
import type { SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { EndgamesClient } from './endgames-client';
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
      <EndgamesClient signedOut={signedOut} />
    </AppShell>
  );
}

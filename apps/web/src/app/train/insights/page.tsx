import type { Metadata } from 'next';
import type { InsightDto, SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { InsightsClient } from './insights-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'What to work on — Purechess',
  description:
    'Your weaknesses, ranked by what is costing you the most rating — each one linked to the exact drill that fixes it.',
  canonical: '/train/insights',
});

export default async function InsightsPage() {
  // /api/auth/me returns 200 {user: null} when signed out — not a 4xx. Insights
  // are entirely personal, so signed-out users get a sign-in prompt.
  const me = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', { withAuth: true });
  const signedIn = Boolean(me?.user);

  const insight = signedIn
    ? await serverFetch<InsightDto>('/api/train/insights', { withAuth: true })
    : null;

  return (
    <AppShell>
      <InsightsClient signedIn={signedIn} insight={insight} />
    </AppShell>
  );
}

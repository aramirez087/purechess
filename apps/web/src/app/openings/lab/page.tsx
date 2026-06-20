import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { OpeningLab } from '@/components/openings/opening-lab';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Opening Lab — Purechess',
  description:
    'Study named opening lines in depth — browse Italian, Fegatello, and 3,700+ variations with live explorer stats.',
  canonical: '/openings/lab',
});

type Props = {
  searchParams: Promise<{ q?: string; family?: string }>;
};

export default async function OpeningLabPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <AppShell>
      <Suspense>
        <OpeningLab initialQuery={sp.q ?? ''} initialFamily={sp.family ?? ''} />
      </Suspense>
    </AppShell>
  );
}
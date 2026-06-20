import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { RepertoireColorDto, SafeUser } from '@purechess/shared';
import { AppShell } from '@/components/layout/AppShell';
import { OpeningLabDrillClient } from './opening-lab-drill-client';
import { serverFetch } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Opening Lab Drill — Purechess',
    description: 'Spaced-repetition drill for every variation in an opening family.',
    canonical: '/openings/lab/drill',
  }),
  robots: 'noindex',
};

type Props = {
  searchParams: Promise<{ family?: string; color?: string }>;
};

export default async function OpeningLabDrillPage({ searchParams }: Props) {
  const result = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });
  if (!result?.user) {
    redirect('/login?return=/openings/lab');
  }

  const sp = await searchParams;
  const family = sp.family?.trim() ?? '';
  if (!family) {
    redirect('/openings/lab');
  }
  const color: RepertoireColorDto = sp.color === 'black' ? 'black' : 'white';

  return (
    <AppShell>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <Suspense>
          <OpeningLabDrillClient family={family} color={color} />
        </Suspense>
      </div>
    </AppShell>
  );
}
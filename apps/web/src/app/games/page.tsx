import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { serverFetch } from '@/lib/api';
import type { SafeUser } from '@purchess/shared';
import { GamesClient } from './games-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Games — Purchess',
  robots: 'noindex',
};

type Props = {
  searchParams: Promise<{ category?: string; isRated?: string }>;
};

export default async function GamesPage({ searchParams }: Props) {
  const result = await serverFetch<{ user: SafeUser }>('/api/auth/me', { withAuth: true });

  if (!result) {
    redirect('/login?return=/games');
  }

  const sp = await searchParams;
  const category = ['bullet', 'blitz', 'rapid'].includes(sp.category ?? '')
    ? (sp.category as 'bullet' | 'blitz' | 'rapid')
    : undefined;
  const isRated =
    sp.isRated === 'true' ? true : sp.isRated === 'false' ? false : undefined;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 w-full flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Game history</h1>
        <Suspense>
          <GamesClient
            username={result.user.username}
            initialCategory={category}
            initialIsRated={isRated}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}

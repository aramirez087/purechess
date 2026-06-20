import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Microscope } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { serverFetch } from '@/lib/api';
import type { SafeUser } from '@purechess/shared';
import { GamesClient } from './games-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Games — Purechess',
  robots: 'noindex',
};

type Props = {
  searchParams: Promise<{ category?: string; isRated?: string; vsComputer?: string }>;
};

export default async function GamesPage({ searchParams }: Props) {
  const result = await serverFetch<{ user: SafeUser | null }>('/api/auth/me', {
    withAuth: true,
  });

  // /api/auth/me returns 200 {user: null} when unauthenticated — not a 4xx.
  if (!result || !result.user) {
    redirect('/login?return=/games');
  }

  const sp = await searchParams;
  const category = ['bullet', 'blitz', 'rapid'].includes(sp.category ?? '')
    ? (sp.category as 'bullet' | 'blitz' | 'rapid')
    : undefined;
  const isRated =
    sp.isRated === 'true' ? true : sp.isRated === 'false' ? false : undefined;
  const isVsComputer =
    sp.vsComputer === 'true' ? true : sp.vsComputer === 'false' ? false : undefined;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-6">
        <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Archive</p>
            <h1 className="mt-1.5 font-display text-3xl tracking-[-0.01em] sm:text-4xl">
              Game history
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Every game you have played, ready for review — or paste any PGN to study.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="shrink-0 border-brass/50 text-brass-text hover:border-brass/70 hover:bg-brass/10 hover:text-brass-text"
          >
            <Link href="/analyze">
              <Microscope className="h-4 w-4" aria-hidden="true" />
              Analyze a game
            </Link>
          </Button>
        </header>
        <Suspense>
          <GamesClient
            username={result.user.username}
            initialCategory={category}
            initialIsRated={isRated}
            initialIsVsComputer={isVsComputer}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}

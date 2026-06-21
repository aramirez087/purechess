import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OpeningMistakeCoach } from '@/components/openings/opening-mistake-coach';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Opening mistake — Purechess',
  description: 'Coach-guided review of an opening mistake from your chess.com games.',
  canonical: '/openings/mistake',
});

type Props = {
  searchParams: Promise<{ gameId?: string; ply?: string }>;
};

export default async function OpeningMistakePage({ searchParams }: Props) {
  const sp = await searchParams;
  const gameId = sp.gameId?.trim() ?? '';
  const ply = Number(sp.ply);

  return (
    <Suspense>
      {gameId && Number.isFinite(ply) && ply > 0 ? (
        <OpeningMistakeCoach gameId={gameId} ply={ply} />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Missing mistake details — open this page from your openings mistake list.
        </p>
      )}
    </Suspense>
  );
}
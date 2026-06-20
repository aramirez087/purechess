'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { RepertoireColorDto } from '@purechess/shared';
import { OpeningDrill } from '@/components/openings/opening-drill';
import { fetchLabDrillLines } from '@/lib/api/opening-lab';

export function OpeningLabDrillClient({
  family,
  color,
}: {
  family: string;
  color: RepertoireColorDto;
}) {
  const router = useRouter();
  const drill = useQuery({
    queryKey: ['lab-drill', family, color],
    queryFn: () => fetchLabDrillLines(family, color),
    staleTime: 0,
    gcTime: 0,
  });

  if (drill.isLoading || !drill.data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading drill…</p>;
  }

  if (drill.isError) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">Could not load drill for this family.</p>
        <Link href="/openings/lab" className="text-sm text-brass-text underline-offset-2 hover:underline">
          Back to Opening Lab
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
      <OpeningDrill
        repertoireName={drill.data.family}
        drill={drill.data}
        labDrill={{ family: drill.data.family, color }}
        backLabel="Back to lab"
        onBack={() =>
          router.push(`/openings/lab?family=${encodeURIComponent(drill.data.family)}`)
        }
        onRestart={() => drill.refetch()}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {drill.data.totalLinesInFamily} variations in this family · spaced repetition tracks your
        progress separately from your personal repertoire
      </p>
    </div>
  );
}

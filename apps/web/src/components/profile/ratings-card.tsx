import { cn } from '@/lib/utils';
import type { RatingDto } from '@purechess/shared';

type RatingsCardProps = {
  ratings: RatingDto[];
};

const CATEGORIES: { value: 'bullet' | 'blitz' | 'rapid'; label: string }[] = [
  { value: 'bullet', label: 'Bullet' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'rapid', label: 'Rapid' },
];

export function RatingsCard({ ratings }: RatingsCardProps) {
  return (
    <section data-testid="user-rating" className="rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ratings
        </h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          Glicko-2
        </span>
      </header>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {CATEGORIES.map((cat) => {
          const r = ratings.find((x) => x.category === cat.value);
          const rating = r?.rating ?? 1500;
          const games = r?.gamesPlayed ?? 0;
          return (
            <div key={cat.value} className="flex flex-col gap-1 px-5 py-5 text-center">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {cat.label}
              </span>
              <span
                className={cn(
                  'text-3xl font-mono font-semibold tabular-nums leading-none',
                  games === 0 && 'text-muted-foreground/70',
                )}
              >
                {rating}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {games} {games === 1 ? 'game' : 'games'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

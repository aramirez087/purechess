import { cn } from '@/lib/utils';
import type { StatsDto } from '@purechess/shared';

type StatsCardProps = {
  stats: StatsDto;
};

const ITEMS = [
  { key: 'totalGames' as const, label: 'Games', accent: 'text-foreground' },
  { key: 'wins' as const, label: 'Wins', accent: 'text-emerald-500' },
  { key: 'losses' as const, label: 'Losses', accent: 'text-rose-500' },
  { key: 'draws' as const, label: 'Draws', accent: 'text-foreground' },
  { key: 'winRate' as const, label: 'Win %', accent: 'text-brass' },
];

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <section className="rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
      <header className="border-b border-border/60 px-5 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Statistics
        </h2>
      </header>
      <div className="grid grid-cols-5 divide-x divide-border/60">
        {ITEMS.map((item) => {
          const raw = stats[item.key];
          const value = item.key === 'winRate' ? `${raw.toFixed(1)}%` : String(raw);
          return (
            <div
              key={item.key}
              className="flex flex-col gap-1 px-3 py-5 text-center"
            >
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </span>
              <span
                className={cn(
                  'text-2xl font-mono font-semibold tabular-nums leading-none',
                  item.accent,
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

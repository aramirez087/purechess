'use client';

import { cn } from '@/lib/utils';

type Category = 'bullet' | 'blitz' | 'rapid';
type RatedFilter = 'rated' | 'casual';

type GameHistoryFiltersProps = {
  category: Category | undefined;
  isRated: boolean | undefined;
  onCategoryChange: (v: Category | undefined) => void;
  onRatedChange: (v: boolean | undefined) => void;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'bullet', label: 'Bullet' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'rapid', label: 'Rapid' },
];

const RATED_OPTIONS: { value: RatedFilter; label: string }[] = [
  { value: 'rated', label: 'Rated' },
  { value: 'casual', label: 'Casual' },
];

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-sm rounded border transition-colors',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function GameHistoryFilters({
  category,
  isRated,
  onCategoryChange,
  onRatedChange,
}: GameHistoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5" role="group" aria-label="Time control category">
        <FilterPill
          label="All"
          active={category === undefined}
          onClick={() => onCategoryChange(undefined)}
        />
        {CATEGORIES.map((c) => (
          <FilterPill
            key={c.value}
            label={c.label}
            active={category === c.value}
            onClick={() =>
              onCategoryChange(category === c.value ? undefined : c.value)
            }
          />
        ))}
      </div>

      <div className="w-px h-4 bg-border" aria-hidden="true" />

      <div className="flex items-center gap-1.5" role="group" aria-label="Game type">
        <FilterPill
          label="All"
          active={isRated === undefined}
          onClick={() => onRatedChange(undefined)}
        />
        {RATED_OPTIONS.map((o) => {
          const val = o.value === 'rated';
          return (
            <FilterPill
              key={o.value}
              label={o.label}
              active={isRated === val}
              onClick={() => onRatedChange(isRated === val ? undefined : val)}
            />
          );
        })}
      </div>
    </div>
  );
}

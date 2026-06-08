'use client';

import { cn } from '@/lib/utils';

type Category = 'bullet' | 'blitz' | 'rapid';
type RatedFilter = 'rated' | 'casual';

type GameHistoryFiltersProps = {
  category: Category | undefined;
  isRated: boolean | undefined;
  isVsComputer: boolean | undefined;
  onCategoryChange: (v: Category | undefined) => void;
  onRatedChange: (v: boolean | undefined) => void;
  onVsComputerChange: (v: boolean | undefined) => void;
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
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-brass/50 bg-brass/10 text-foreground shadow-inner-hairline'
          : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function GameHistoryFilters({
  category,
  isRated,
  isVsComputer,
  onCategoryChange,
  onRatedChange,
  onVsComputerChange,
}: GameHistoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <FilterGroup label="Time control">
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
      </FilterGroup>

      <span className="hidden h-5 w-px bg-border/60 sm:inline-block" aria-hidden />

      <FilterGroup label="Type">
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
      </FilterGroup>

      <span className="hidden h-5 w-px bg-border/60 sm:inline-block" aria-hidden />

      <FilterGroup label="Opponent">
        <FilterPill
          label="All"
          active={isVsComputer === undefined}
          onClick={() => onVsComputerChange(undefined)}
        />
        <FilterPill
          label="vs Computer"
          active={isVsComputer === true}
          onClick={() => onVsComputerChange(isVsComputer === true ? undefined : true)}
        />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

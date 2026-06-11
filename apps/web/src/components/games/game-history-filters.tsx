'use client';

import {
  SEGMENT_ACTIVE,
  SEGMENT_BASE,
  SEGMENT_GROUP,
  SEGMENT_INACTIVE,
} from '@/components/play/pill-styles';
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
      className={cn(SEGMENT_BASE, active ? SEGMENT_ACTIVE : SEGMENT_INACTIVE)}
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
      <div className={SEGMENT_GROUP}>{children}</div>
    </div>
  );
}

import { cn } from '@/lib/utils';

const STATEMENTS = ['Fast matchmaking', 'Clean board', 'Free to start', 'No distractions'];

export function TrustStrip() {
  return (
    <div
      role="list"
      className="flex flex-wrap justify-center text-sm text-muted-foreground py-8 px-6"
    >
      {STATEMENTS.map((s, i) => (
        <div
          key={s}
          role="listitem"
          className={cn('px-6 py-2', i > 0 && 'border-l border-border')}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

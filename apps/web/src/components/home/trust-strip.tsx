import { Clock, Crosshair, Sparkles, ShieldCheck } from 'lucide-react';

const STATEMENTS = [
  { icon: Clock, label: 'Fast matchmaking' },
  { icon: Crosshair, label: 'Clean board' },
  { icon: Sparkles, label: 'Free to start' },
  { icon: ShieldCheck, label: 'No distractions' },
];

export function TrustStrip() {
  return (
    <div
      role="list"
      className="border-y border-border/60 bg-surface/40"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-3 px-6 py-6 sm:grid-cols-4 sm:gap-y-0">
        {STATEMENTS.map(({ icon: Icon, label }, i) => (
          <div
            key={label}
            role="listitem"
            className={`flex items-center justify-center gap-2 sm:justify-start sm:gap-3 ${i > 0 ? 'sm:border-l sm:border-border/60 sm:pl-6' : ''}`}
          >
            <Icon className="h-3.5 w-3.5 text-brass" />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

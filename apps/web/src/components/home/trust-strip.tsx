const STATEMENTS = [
  'Fast matchmaking',
  'Clean board',
  'No ads, ever',
  'No distractions',
];

export function TrustStrip() {
  return (
    <div
      role="list"
      className="border-t border-border/60 bg-surface/40"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-3 px-6 py-6 sm:grid-cols-4 sm:gap-y-0">
        {STATEMENTS.map((label, i) => (
          <div
            key={label}
            role="listitem"
            className={`flex items-center justify-center gap-2 sm:justify-start sm:gap-3 ${i > 0 ? 'sm:border-l sm:border-border/60 sm:pl-6' : ''}`}
          >
            <span aria-hidden className="h-1 w-1 shrink-0 rotate-45 bg-brass" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface FairPlaySignalRow {
  id: string;
  signalType: string;
  score: number;
  payload: unknown;
}

const SIGNAL_LABELS: Record<string, string> = {
  low_variance_move_time: 'Low move-time variance',
  suspicious_accuracy: 'Suspicious accuracy',
  abnormal_streak: 'Abnormal streak',
  multi_account_ip: 'Shared IP (multi-account)',
  multi_account_fingerprint: 'Shared fingerprint (multi-account)',
};

function scoreBg(score: number): string {
  if (score > 0.7) return 'bg-rose-500';
  if (score >= 0.4) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function scoreTextColor(score: number): string {
  if (score > 0.7) return 'text-rose-600 dark:text-rose-400';
  if (score >= 0.4) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

interface FairplaySignalsProps {
  signals: FairPlaySignalRow[];
}

export function FairplaySignals({ signals }: FairplaySignalsProps) {
  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-surface/40 p-6 text-center text-sm text-muted-foreground">
        No signals recorded
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((s) => (
        <div
          key={s.id}
          className="rounded-md border border-border/70 bg-surface/60 p-3.5 shadow-elevated"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {SIGNAL_LABELS[s.signalType] ?? s.signalType}
            </span>
            <span
              className={`text-sm font-mono font-semibold tabular-nums ${scoreTextColor(s.score)}`}
            >
              {s.score.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-raised overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBg(s.score)} transition-all`}
              style={{ width: `${Math.min(s.score * 100, 100)}%` }}
            />
          </div>
          {s.payload !== null && typeof s.payload === 'object' && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(s.payload as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium">{k}</dt>
                  <dd>{String(v as string | number | boolean)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}

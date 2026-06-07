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

function scoreColor(score: number): string {
  if (score > 0.7) return 'bg-red-500';
  if (score >= 0.4) return 'bg-amber-400';
  return 'bg-green-500';
}

function scoreTextColor(score: number): string {
  if (score > 0.7) return 'text-red-600';
  if (score >= 0.4) return 'text-amber-600';
  return 'text-green-600';
}

interface FairplaySignalsProps {
  signals: FairPlaySignalRow[];
}

export function FairplaySignals({ signals }: FairplaySignalsProps) {
  if (signals.length === 0) {
    return <p className="text-sm text-muted-foreground">No signals recorded</p>;
  }

  return (
    <div className="space-y-2">
      {signals.map((s) => (
        <div key={s.id} className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {SIGNAL_LABELS[s.signalType] ?? s.signalType}
            </span>
            <span className={`text-sm font-mono font-semibold ${scoreTextColor(s.score)}`}>
              {s.score.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreColor(s.score)}`}
              style={{ width: `${Math.min(s.score * 100, 100)}%` }}
            />
          </div>
          {s.payload !== null && typeof s.payload === 'object' && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

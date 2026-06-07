import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RatingDto } from '@purechess/shared';

type RatingsCardProps = {
  ratings: RatingDto[];
};

const CATEGORY_LABELS: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
};

export function RatingsCard({ ratings }: RatingsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Ratings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {(['bullet', 'blitz', 'rapid'] as const).map((cat) => {
            const r = ratings.find((x) => x.category === cat);
            return (
              <div key={cat} className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                <span className="text-xl font-mono font-semibold tabular-nums">
                  {r?.rating ?? 1500}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r?.gamesPlayed ?? 0} games
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

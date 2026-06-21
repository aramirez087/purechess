import { accuracyBarColor } from '@/lib/board/accuracy';
import { moveGlyphStyle, type MoveGlyphClass } from '@/lib/board/move-glyph';
import type { ClassificationResult } from '@/hooks/use-move-classifier';
import { cn } from '@/lib/utils';

/** Classes shown in the tally, worst-to-best reading order, with glyph styling. */
const TALLY_ORDER: { key: MoveGlyphClass; label: string }[] = [
  { key: 'brilliant', label: 'Brilliant' },
  { key: 'mistake', label: 'Mistakes' },
  { key: 'blunder', label: 'Blunders' },
];

function countClass(
  result: ClassificationResult,
  side: 'w' | 'b',
  cls: MoveGlyphClass,
): number {
  // Use the move's own side (set from the position) — ply parity is wrong when
  // the game starts from a custom black-to-move FEN on /analyze.
  return result.moves.filter((m) => m.color === side && m.class === cls).length;
}

function SideColumn({
  result,
  side,
  accuracy,
}: {
  result: ClassificationResult;
  side: 'w' | 'b';
  accuracy: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={cn('font-mono text-2xl font-semibold tabular-nums', accuracyBarColor(accuracy))}>
        {Math.round(accuracy)}
        <span className="text-sm text-muted-foreground">%</span>
      </span>
      <div className="flex items-center gap-2">
        {TALLY_ORDER.map(({ key, label }) => {
          const n = countClass(result, side, key);
          if (n === 0) return null;
          const style = moveGlyphStyle(key);
          return (
            <span
              key={key}
              title={label}
              className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums"
              style={{ color: style?.bg }}
            >
              <span className="font-bold">{style?.symbol}</span>
              {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * chess.com-style game report: the headline number is per-player accuracy %,
 * with a tally of the moments that mattered (brilliants, mistakes, blunders).
 */
export function AccuracySummary({ result }: { result: ClassificationResult }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col items-center gap-0.5 rounded-[6px] bg-background/40 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          White
        </span>
        <SideColumn result={result} side="w" accuracy={result.whiteAccuracy} />
      </div>
      <div className="flex flex-col items-center gap-0.5 rounded-[6px] bg-background/40 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Black
        </span>
        <SideColumn result={result} side="b" accuracy={result.blackAccuracy} />
      </div>
    </div>
  );
}
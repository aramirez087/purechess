'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Play, Swords } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from '@/components/play/pill-styles';
import { ColorPicker, StrengthSection } from '@/components/play/time-control-picker';
import type { PieceColor, StrengthMode } from '@/components/play/time-control-picker';
import { createComputerGameFromFen } from '@/lib/api/computer-games';
import type { CreateFromFenDto } from '@purechess/shared';
import { cn } from '@/lib/utils';

// Presets fixed by spec — not shared TIME_CONTROL_PRESETS (those include untimed
// and others not wanted for a quick practice game).
const TIME_PRESETS: { key: string; initialSeconds: number; incrementSeconds: number }[] = [
  { key: '1+0', initialSeconds: 60, incrementSeconds: 0 },
  { key: '3+0', initialSeconds: 180, incrementSeconds: 0 },
  { key: '5+3', initialSeconds: 300, incrementSeconds: 3 },
  { key: '10+0', initialSeconds: 600, incrementSeconds: 0 },
  { key: '15+10', initialSeconds: 900, incrementSeconds: 10 },
];

interface PracticeFromFenDialogProps {
  fen: string;
  open: boolean;
  onClose: () => void;
}

export function PracticeFromFenDialog({ fen, open, onClose }: PracticeFromFenDialogProps) {
  const router = useRouter();
  const [color, setColor] = useState<PieceColor>('random');
  const [timeKey, setTimeKey] = useState<string>('5+3');
  const [strengthMode, setStrengthMode] = useState<StrengthMode>('level');
  const [level, setLevel] = useState<CreateFromFenDto['level']>(4);
  const [eloTarget, setEloTarget] = useState<number>(1500);
  const [isPending, setIsPending] = useState(false);

  // First two FEN fields (piece placement + side to move) ground the user in
  // exactly which position they're about to play from.
  const abbreviatedFen = fen.split(' ').slice(0, 2).join(' ');

  async function handleStart() {
    setIsPending(true);
    const preset = TIME_PRESETS.find((p) => p.key === timeKey) ?? TIME_PRESETS[2];
    try {
      const payload: CreateFromFenDto = {
        fen,
        color,
        timeControlSeconds: preset.initialSeconds,
        incrementSeconds: preset.incrementSeconds,
        level: strengthMode === 'elo' ? 4 : level,
        ...(strengthMode === 'elo' && { eloTarget }),
      };
      const result = await createComputerGameFromFen(payload);
      // Navigation unmounts the dialog — no explicit close needed on success.
      router.push('/computer-game/' + result.gameId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'please try again';
      toast.error("Couldn't start practice — " + message);
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
              <Swords className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base tracking-tight">
                Practice from this position
              </DialogTitle>
              <DialogDescription className="truncate font-mono text-[11px]">
                {abbreviatedFen}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Play as */}
          <div className="space-y-2.5">
            <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Play as
            </Label>
            <ColorPicker value={color} onChange={(c) => setColor(c)} />
          </div>

          {/* Time control */}
          <div className="space-y-2.5">
            <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Time Control
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setTimeKey(p.key)}
                  aria-pressed={timeKey === p.key}
                  aria-label={p.key}
                  className={cn(
                    PILL_BASE,
                    'h-10 font-mono text-[11px]',
                    timeKey === p.key ? PILL_ACTIVE : PILL_INACTIVE,
                  )}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {/* Strength */}
          <StrengthSection
            strengthMode={strengthMode}
            level={level}
            onModeChange={(m) => setStrengthMode(m)}
            onLevelChange={(l) => setLevel(l)}
            className="space-y-2.5"
            eloSection={
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={600}
                  max={2800}
                  step={50}
                  value={eloTarget}
                  onChange={(e) => {
                    const v = Math.max(600, Math.min(2800, Number(e.target.value)));
                    setEloTarget(v);
                  }}
                  aria-label="ELO target"
                  className="w-24 rounded-md border border-border/70 bg-raised/40 px-2 py-1 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">
                  Engine plays at approximately ELO {eloTarget}
                </span>
              </div>
            }
          />
        </div>

        <DialogFooter className="border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={isPending}
            className="h-11 bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
          >
            <Play className="mr-2 h-4 w-4" />
            {isPending ? 'Starting…' : 'Start practice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

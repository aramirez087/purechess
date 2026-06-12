'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/stores/settings-store';
import { BOARD_THEMES } from '@/lib/board/themes';
import { PIECE_SETS, pieceSetBase } from '@/lib/board/piece-sets';
import { prefersReducedMotion } from '@/lib/board/animations';
import { Monitor, Moon, Sun, Volume2, Move3D, Hash, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const APP_THEMES = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

export function SettingsForm() {
  const { setTheme } = useTheme();
  const settings = useSettingsStore();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  function handleAppTheme(value: string) {
    const theme = value as 'light' | 'dark' | 'system';
    settings.update({ appTheme: theme });
    setTheme(theme);
  }

  return (
    <div className="space-y-8">
      <Section
        title="Appearance"
        description="How Purechess looks on your device."
      >
        <SettingRow label="App theme" hint="Light or dark surfaces, or follow your system.">
          <SegmentedControl
            value={settings.appTheme}
            onValueChange={handleAppTheme}
            options={APP_THEMES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
          />
        </SettingRow>

        <Separator className="bg-border/60" />

        <SettingRow label="Board theme" hint="Pick a colour set for the chessboard.">
          <div className="flex flex-wrap gap-2">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => settings.update({ boardThemeId: theme.id })}
                aria-pressed={settings.boardThemeId === theme.id}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  settings.boardThemeId === theme.id
                    ? 'border-brass/60 bg-brass/10 shadow-inner-hairline'
                    : 'border-border/70 hover:border-foreground/40',
                )}
              >
                <span
                  className="inline-flex w-10 h-5 rounded overflow-hidden border border-border/80"
                  aria-hidden
                >
                  <span className="flex-1" style={{ background: theme.light }} />
                  <span className="flex-1" style={{ background: theme.dark }} />
                </span>
                <span className="font-medium">{theme.label}</span>
              </button>
            ))}
          </div>
        </SettingRow>

        <Separator className="bg-border/60" />

        <SettingRow label="Piece set" hint="How the pieces are drawn.">
          <div className="flex flex-wrap gap-2">
            {PIECE_SETS.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => settings.update({ pieceSet: set.id })}
                aria-pressed={pieceSetBase(settings.pieceSet) === set.base}
                title={set.description}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  pieceSetBase(settings.pieceSet) === set.base
                    ? 'border-brass/60 bg-brass/10 shadow-inner-hairline'
                    : 'border-border/70 hover:border-foreground/40',
                )}
              >
                <span
                  className="inline-flex h-8 w-14 items-center justify-center gap-0.5 rounded border border-border/80 bg-[hsl(var(--board-sq-light))]"
                  aria-hidden
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static preview sprite */}
                  <img src={`${set.base}/wN.svg`} alt="" className="h-7 w-7" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static preview sprite */}
                  <img src={`${set.base}/bN.svg`} alt="" className="h-7 w-7" draggable={false} />
                </span>
                <span className="font-medium">{set.label}</span>
              </button>
            ))}
          </div>
        </SettingRow>
      </Section>

      <Section title="Board" description="On-board information and movement.">
        <SettingRow
          label="Show coordinates"
          htmlFor="coordinates"
          hint="Display file and rank labels on the board edge."
          icon={Hash}
        >
          <Switch
            id="coordinates"
            checked={settings.coordinates}
            onCheckedChange={(v) => settings.update({ coordinates: v })}
          />
        </SettingRow>
        <Separator className="bg-border/60" />
        <SettingRow
          label="Animations"
          htmlFor="animations"
          hint={
            reducedMotion
              ? 'Disabled by the prefers-reduced-motion OS setting.'
              : 'Smooth piece movement and UI transitions.'
          }
          icon={Move3D}
        >
          <Switch
            id="animations"
            aria-label="Animations"
            checked={settings.animations}
            onCheckedChange={reducedMotion ? undefined : (v) => settings.update({ animations: v })}
            aria-disabled={reducedMotion ? 'true' : undefined}
          />
        </SettingRow>
      </Section>

      <Section title="Sound" description="Audio cues during play.">
        <SettingRow label="Sound effects" htmlFor="sound" hint="Moves, captures, and game start." icon={Volume2}>
          <Switch
            id="sound"
            checked={settings.sound}
            onCheckedChange={(v) => settings.update({ sound: v })}
          />
        </SettingRow>
        <Separator className="bg-border/60" />
        <SettingRow
          label="Low-time tick"
          htmlFor="lowTimeSound"
          hint="A subtle tick each second under 10s remaining."
          disabled={!settings.sound}
          icon={Square}
        >
          <Switch
            id="lowTimeSound"
            aria-label="Low-time tick"
            checked={settings.lowTimeSound}
            onCheckedChange={!settings.sound ? undefined : (v) => settings.update({ lowTimeSound: v })}
            aria-disabled={!settings.sound ? 'true' : undefined}
          />
        </SettingRow>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
        <div className="divide-y divide-border/60">{children}</div>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  htmlFor,
  hint,
  icon: Icon,
  disabled,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  icon?: typeof Volume2;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-disabled={disabled ? true : undefined}
      className="flex items-center justify-between gap-4 p-4"
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span aria-hidden="true" className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <div>
          <Label htmlFor={htmlFor} className={cn('text-sm font-medium', disabled && 'text-muted-foreground')}>
            {label}
          </Label>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className={cn('shrink-0', disabled && 'opacity-40 pointer-events-none')}>{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: string; icon?: typeof Volume2 }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border/70 bg-raised/50 p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onValueChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-elevated'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/stores/settings-store';
import { BOARD_THEMES } from '@/lib/board/themes';
import { prefersReducedMotion } from '@/lib/board/animations';

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
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium mb-3">Appearance</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">App theme</Label>
            <RadioGroup
              value={settings.appTheme}
              onValueChange={handleAppTheme}
              className="flex gap-3"
            >
              {(['light', 'dark', 'system'] as const).map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <RadioGroupItem value={t} id={`theme-${t}`} />
                  <Label htmlFor={`theme-${t}`} className="capitalize cursor-pointer">
                    {t}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Board theme</Label>
            <RadioGroup
              value={settings.boardThemeId}
              onValueChange={(v) => settings.update({ boardThemeId: v as 'classic' | 'mono' })}
              className="flex gap-3"
            >
              {BOARD_THEMES.map((theme) => (
                <div key={theme.id} className="flex items-center gap-2">
                  <RadioGroupItem value={theme.id} id={`board-${theme.id}`} />
                  <Label htmlFor={`board-${theme.id}`} className="flex items-center gap-2 cursor-pointer">
                    <span
                      className="inline-flex w-8 h-5 rounded overflow-hidden border border-border shrink-0"
                      aria-hidden
                    >
                      <span className="flex-1" style={{ background: theme.light }} />
                      <span className="flex-1" style={{ background: theme.dark }} />
                    </span>
                    {theme.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="text-sm font-medium mb-3">Board</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="coordinates" className="cursor-pointer">
              Show coordinates
            </Label>
            <Switch
              id="coordinates"
              checked={settings.coordinates}
              onCheckedChange={(v) => settings.update({ coordinates: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="animations" className="cursor-pointer">
                Animations
              </Label>
              {reducedMotion && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Overridden by prefers-reduced-motion
                </p>
              )}
            </div>
            <Switch
              id="animations"
              checked={settings.animations}
              onCheckedChange={(v) => settings.update({ animations: v })}
              disabled={reducedMotion}
            />
          </div>
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="text-sm font-medium mb-3">Sound</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="sound" className="cursor-pointer">
              Sound effects
            </Label>
            <Switch
              id="sound"
              checked={settings.sound}
              onCheckedChange={(v) => settings.update({ sound: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="lowTimeSound"
                className={settings.sound ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground'}
              >
                Low-time tick
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tick each second under 10s
              </p>
            </div>
            <Switch
              id="lowTimeSound"
              checked={settings.lowTimeSound}
              onCheckedChange={(v) => settings.update({ lowTimeSound: v })}
              disabled={!settings.sound}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

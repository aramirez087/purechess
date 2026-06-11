'use client';

import { AppShell } from '@/components/layout/AppShell';
import { SettingsForm } from '@/components/settings/settings-form';
import { useResetSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { RotateCcw, Settings2 } from 'lucide-react';

export function SettingsPageClient() {
  const reset = useResetSettings();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
              <Settings2 className="h-4 w-4" />
            </span>
            <div>
              <h1 className="font-display text-3xl tracking-[-0.01em] sm:text-4xl">Settings</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Tweak the look, sound, and feel of Purechess.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </header>
        <SettingsForm />
      </div>
    </AppShell>
  );
}

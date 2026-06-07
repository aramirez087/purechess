'use client';

import { AppShell } from '@/components/layout/AppShell';
import { SettingsForm } from '@/components/settings/settings-form';
import { useResetSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';

export function SettingsPageClient() {
  const reset = useResetSettings();

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Button variant="outline" size="sm" onClick={reset}>
            Reset to defaults
          </Button>
        </div>
        <SettingsForm />
      </div>
    </AppShell>
  );
}

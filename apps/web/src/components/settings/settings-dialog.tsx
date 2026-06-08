'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsForm } from './settings-form';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label="Open settings"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
              <Settings2 className="h-3.5 w-3.5" />
            </span>
            <DialogTitle className="text-base tracking-tight">Settings</DialogTitle>
          </div>
        </DialogHeader>
        <div className="py-4">
          <SettingsForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SettingsForm } from './settings-form';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Open settings"
        className="flex items-center justify-center w-8 h-8 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Settings2 size={16} />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SettingsForm />
      </DialogContent>
    </Dialog>
  );
}

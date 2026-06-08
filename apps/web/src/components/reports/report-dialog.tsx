'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { createReport } from '@/lib/api/reports';
import { posthog } from '@/lib/posthog';
import { Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const REASONS = [
  { value: 'cheating', label: 'Cheating / engine use' },
  { value: 'abuse', label: 'Abusive behavior' },
  { value: 'stalking', label: 'Stalking / harassment' },
  { value: 'multi_account', label: 'Multiple accounts' },
  { value: 'other', label: 'Other' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: string;
  opponentUsername: string;
  gameId: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  reportedUserId,
  opponentUsername,
  gameId,
}: ReportDialogProps) {
  const [reason, setReason] = useState('cheating');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createReport({ reportedUserId, gameId, reason, notes: notes.trim() || undefined }),
    onSuccess: (data) => {
      if (data.created) {
        toast.success('Report submitted');
        posthog.capture('report_filed', { reason });
      } else {
        toast.info('You already reported this game');
      }
      onOpenChange(false);
      setNotes('');
      setReason('cheating');
    },
    onError: () => {
      toast.error('Failed to submit report');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10 ring-1 ring-inset ring-rose-500/30 text-rose-600 dark:text-rose-400">
              <Flag className="h-3.5 w-3.5" />
            </span>
            <div>
              <DialogTitle className="text-base tracking-tight">
                Report {opponentUsername}
              </DialogTitle>
              <DialogDescription>
                Select a reason. Reports are reviewed by moderators.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Reason
            </Label>
            <div className="flex flex-col gap-1">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  htmlFor={`reason-${r.value}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-all',
                    'hover:border-foreground/40',
                    reason === r.value
                      ? 'border-brass/50 bg-brass/10 shadow-inner-hairline'
                      : 'border-border/70',
                  )}
                >
                  <input
                    type="radio"
                    id={`reason-${r.value}`}
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="h-3.5 w-3.5 accent-brass"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="notes"
              className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
            >
              Notes (optional)
            </Label>
            <textarea
              id="notes"
              className="w-full rounded-md border border-border/70 bg-raised/40 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              rows={3}
              placeholder="Additional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {mutation.isPending ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

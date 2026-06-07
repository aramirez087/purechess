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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createReport } from '@/lib/api/reports';

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
    mutationFn: () => createReport({ reportedUserId, gameId, reason, notes: notes.trim() || undefined }),
    onSuccess: (data) => {
      if (data.created) {
        toast.success('Report submitted');
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
        <DialogHeader>
          <DialogTitle>Report {opponentUsername}</DialogTitle>
          <DialogDescription>
            Select a reason. Reports are reviewed by moderators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                <Label htmlFor={`reason-${r.value}`}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              placeholder="Additional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { disableUser, enableUser } from '@/lib/api/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface DisableAccountDialogProps {
  userId: string;
  username: string;
  isDisabled: boolean;
}

export function DisableAccountDialog({ userId, username, isDisabled }: DisableAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      isDisabled ? enableUser(userId) : disableUser(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
      setOpen(false);
      setReason('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={isDisabled ? 'outline' : 'destructive'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isDisabled ? 'Enable account' : 'Disable account'}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDisabled ? `Enable ${username}?` : `Disable ${username}?`}
          </DialogTitle>
          <DialogDescription>
            {isDisabled
              ? 'This will restore access for the user.'
              : 'This will block the user from logging in and terminate all active sessions.'}
          </DialogDescription>
        </DialogHeader>
        {!isDisabled && (
          <div className="space-y-1.5">
            <Label
              htmlFor="reason"
              className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
            >
              Reason
            </Label>
            <Input
              id="reason"
              placeholder="Explain why this account is being disabled…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isDisabled ? 'default' : 'destructive'}
            disabled={mutation.isPending || (!isDisabled && !reason.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isDisabled ? 'Enable' : 'Disable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

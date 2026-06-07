'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { disableUser, enableUser } from '@/lib/api/admin';

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
      <DialogTrigger asChild>
        <Button variant={isDisabled ? 'outline' : 'destructive'} size="sm">
          {isDisabled ? 'Enable Account' : 'Disable Account'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDisabled ? 'Enable' : 'Disable'} {username}</DialogTitle>
          <DialogDescription>
            {isDisabled
              ? 'This will restore access for the user.'
              : 'This will block the user from logging in and terminate all active sessions.'}
          </DialogDescription>
        </DialogHeader>
        {!isDisabled && (
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Explain why this account is being disabled…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isDisabled ? 'default' : 'destructive'}
            disabled={mutation.isPending || (!isDisabled && !reason.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : isDisabled ? 'Enable' : 'Disable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

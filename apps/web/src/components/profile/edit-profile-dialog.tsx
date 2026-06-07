'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SafeUser } from '@purechess/shared';

type EditProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername: string;
  currentAvatarUrl: string | null;
};

export function EditProfileDialog({
  open,
  onOpenChange,
  currentUsername,
  currentAvatarUrl,
}: EditProfileDialogProps) {
  const [username, setUsername] = useState(currentUsername);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username !== currentUsername ? username : undefined,
          avatarUrl: avatarUrl !== (currentAvatarUrl ?? '') ? (avatarUrl || null) : undefined,
        }),
      });

      if (!res.ok) {
        const data: { message?: string | string[] } = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(msg ?? 'Failed to save. Please try again.');
        return;
      }

      const { user }: { user: SafeUser } = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['profile', currentUsername] });
      onOpenChange(false);

      if (user.username !== currentUsername) {
        router.replace(`/profile/${user.username}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-avatar-url">Avatar URL</Label>
            <Input
              id="edit-avatar-url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

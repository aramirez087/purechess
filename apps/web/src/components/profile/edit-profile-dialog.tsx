'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SafeUser } from '@purechess/shared';
import { Loader2 } from 'lucide-react';

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
        <DialogHeader className="border-b border-border/60 pb-4">
          <DialogTitle className="text-base tracking-tight">Edit profile</DialogTitle>
          <DialogDescription className="sr-only">
            Update your display name and profile details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-username" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Username
            </Label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-avatar-url" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Avatar URL
            </Label>
            <Input
              id="edit-avatar-url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Direct link to an image. Square crops render best.
            </p>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

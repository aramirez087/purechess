'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EditProfileDialog } from './edit-profile-dialog';

type ProfileHeaderProps = {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  isOwnProfile: boolean;
};

export function ProfileHeader({ username, avatarUrl, createdAt, isOwnProfile }: ProfileHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);

  const joinedLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(createdAt));

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={avatarUrl ?? undefined} alt={`${username}'s avatar`} />
        <AvatarFallback className="text-lg font-mono">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold truncate">{username}</h1>
        <p className="text-sm text-muted-foreground">Joined {joinedLabel}</p>
      </div>

      {isOwnProfile && (
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Edit profile
        </Button>
      )}

      {isOwnProfile && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          currentUsername={username}
          currentAvatarUrl={avatarUrl}
        />
      )}
    </div>
  );
}

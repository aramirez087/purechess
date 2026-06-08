'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EditProfileDialog } from './edit-profile-dialog';
import { Pencil } from 'lucide-react';

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
    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
      <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-1 ring-inset ring-border/80 shadow-elevated">
        <AvatarImage src={avatarUrl ?? undefined} alt={`${username}'s avatar`} />
        <AvatarFallback className="bg-raised text-xl font-semibold tracking-wide">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {username}
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Joined {joinedLabel}
        </p>
      </div>

      {isOwnProfile && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="border-border/70 hover:bg-raised"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit profile
          </Button>
          <EditProfileDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            currentUsername={username}
            currentAvatarUrl={avatarUrl}
          />
        </>
      )}
    </div>
  );
}

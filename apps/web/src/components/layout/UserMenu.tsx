'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';
import Link from 'next/link';

type UserAccount = {
  name: string;
  email: string;
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserMenu({ user }: { user: UserAccount | null }) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
      >
        <UserIcon className="h-3.5 w-3.5" />
        Sign in
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <button aria-label="Open user menu">
          <Avatar className="h-8 w-8 ring-1 ring-inset ring-border">
            <AvatarFallback className="text-[11px] font-semibold tracking-wide bg-raised">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="mt-1 text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          Account
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/games">Game history</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/logout" className="text-destructive focus:text-destructive">
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

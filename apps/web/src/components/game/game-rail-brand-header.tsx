import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';

export function GameRailBrandHeader() {
  return (
    <div className="flex min-h-[3.25rem] items-center justify-between border-b border-border px-3">
      <Link
        href="/"
        aria-label="PureChess home"
        className="rounded-[6px] text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Logo className="text-lg" />
      </Link>
      <SettingsDialog />
    </div>
  );
}
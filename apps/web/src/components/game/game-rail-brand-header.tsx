import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';

export function GameRailBrandHeader() {
  return (
    <div className="flex min-h-[3.25rem] items-center justify-between border-b border-[#2b332c] px-3">
      <Link
        href="/"
        aria-label="PureChess home"
        className="rounded-[6px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
      >
        <Logo className="text-lg text-[#f1eee6]" />
      </Link>
      <SettingsDialog />
    </div>
  );
}

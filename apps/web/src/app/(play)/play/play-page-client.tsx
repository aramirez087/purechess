'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { InviteCreate } from '@/components/play/invite-create';
import { ComputerGameSetup } from '@/components/play/computer-game-setup';
import { posthog } from '@/lib/posthog';

type PlayMode = 'select' | 'friend' | 'computer';

export function PlayPageClient() {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode>('select');

  if (mode === 'computer') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ComputerGameSetup
          onCancel={() => setMode('select')}
          onGameCreated={(gameId) => router.push(`/computer-game/${gameId}`)}
        />
      </div>
    );
  }

  if (mode === 'friend') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <InviteCreate onCancel={() => setMode('select')} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Play Chess</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            posthog.capture('play_clicked', { mode: 'computer' });
            setMode('computer');
          }}
        >
          Quick Match
        </Button>
        <Button size="lg" onClick={() => { posthog.capture('play_clicked', { mode: 'friend' }); setMode('friend'); }}>
          Play a Friend
        </Button>
      </div>
    </div>
  );
}

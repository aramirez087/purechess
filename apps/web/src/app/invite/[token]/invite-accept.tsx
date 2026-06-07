'use client';

import { InviteJoin } from '@/components/play/invite-join';

interface InviteAcceptProps {
  token: string;
}

export function InviteAccept({ token }: InviteAcceptProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <InviteJoin token={token} />
    </div>
  );
}

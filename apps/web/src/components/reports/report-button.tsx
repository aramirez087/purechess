'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReportDialog } from './report-dialog';

interface ReportButtonProps {
  gameId: string;
  opponentId: string;
  opponentUsername: string;
}

export function ReportButton({ gameId, opponentId, opponentUsername }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Report opponent
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        reportedUserId={opponentId}
        opponentUsername={opponentUsername}
        gameId={gameId}
      />
    </>
  );
}

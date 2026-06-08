'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-border/70 hover:bg-rose-500/5 hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400"
      >
        <Flag className="mr-1.5 h-3.5 w-3.5" />
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

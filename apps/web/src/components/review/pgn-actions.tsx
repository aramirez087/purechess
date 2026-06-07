'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PgnActionsProps {
  pgn: string;
  gameId: string;
}

export function PgnActions({ pgn, gameId }: PgnActionsProps) {
  function handleCopy() {
    navigator.clipboard.writeText(pgn).then(() => {
      toast.success('PGN copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy PGN');
    });
  }

  function handleDownload() {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchess-${gameId}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        Copy PGN
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        Download PGN
      </Button>
    </div>
  );
}

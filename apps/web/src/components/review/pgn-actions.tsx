'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PgnActionsProps {
  pgn: string;
  gameId: string;
  fen?: string;
}

export function PgnActions({ pgn, gameId, fen }: PgnActionsProps) {
  function handleCopy() {
    navigator.clipboard.writeText(pgn).then(() => {
      toast.success('PGN copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy PGN');
    });
  }

  function handleCopyFen() {
    navigator.clipboard.writeText(fen!).then(() => {
      toast.success('FEN copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy FEN');
    });
  }

  function handleDownload() {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purechess-${gameId}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        Copy PGN
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        Download PGN
      </Button>
      {fen && (
        <Button variant="outline" size="sm" onClick={handleCopyFen}>
          Copy FEN
        </Button>
      )}
    </div>
  );
}

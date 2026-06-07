'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ReviewControlsProps {
  onStart: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
}

export function ReviewControls({ onStart, onPrev, onNext, onEnd }: ReviewControlsProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'Home':
          e.preventDefault();
          if (e.key === 'Home') onStart(); else onPrev();
          break;
        case 'ArrowRight':
        case 'End':
          e.preventDefault();
          if (e.key === 'End') onEnd(); else onNext();
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          onStart();
          break;
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          onEnd();
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart, onPrev, onNext, onEnd]);

  return (
    <div className="flex items-center gap-2 justify-center">
      <Button variant="outline" size="sm" onClick={onStart} aria-label="Go to start">
        ⏮
      </Button>
      <Button variant="outline" size="sm" onClick={onPrev} aria-label="Previous move">
        ←
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} aria-label="Next move">
        →
      </Button>
      <Button variant="outline" size="sm" onClick={onEnd} aria-label="Go to end">
        ⏭
      </Button>
    </div>
  );
}

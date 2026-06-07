'use client';

import { useEffect, useRef, useState } from 'react';
import type { Square } from '@purchess/shared';
import { getAnimationSquares, prefersReducedMotion, MOVE_DURATION_MS } from '@/lib/board/animations';

interface AnimState {
  animating: Set<Square>;
  fading: Set<Square>;
}

export function useAnimations(position: string) {
  const prevPosition = useRef<string>(position);
  const [animState, setAnimState] = useState<AnimState>({ animating: new Set(), fading: new Set() });

  useEffect(() => {
    if (position === prevPosition.current) return;
    if (prefersReducedMotion()) {
      prevPosition.current = position;
      return;
    }

    const anim = getAnimationSquares(prevPosition.current, position);
    prevPosition.current = position;

    if (!anim) return;

    const animating = new Set<Square>([anim.from, anim.to]);
    if (anim.rookFrom) animating.add(anim.rookFrom);
    if (anim.rookTo) animating.add(anim.rookTo);

    const fading = new Set<Square>();
    if (anim.capturedAt && anim.capturedAt !== anim.to) {
      fading.add(anim.capturedAt);
    }

    setAnimState({ animating, fading });

    const timer = setTimeout(() => {
      setAnimState({ animating: new Set(), fading: new Set() });
    }, MOVE_DURATION_MS + 50);

    return () => clearTimeout(timer);
  }, [position]);

  return animState;
}

'use client';

import { useEffect, useRef } from 'react';

export function useBoardResize(containerRef: React.RefObject<HTMLElement | null>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      // The board's square wrapper (aspect-square) already shrinks its width to
      // fit the available height, so clientWidth is the correct side length —
      // reading clientHeight here would feed the grid's own height back in and
      // pin the size. Guard against a 0px first paint before layout settles.
      const size = Math.floor(el.clientWidth / 8);
      if (size > 0) el.style.setProperty('--board-sq-size', `${size}px`);
    }

    update();

    const observer = new ResizeObserver(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(update, 16);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [containerRef]);
}

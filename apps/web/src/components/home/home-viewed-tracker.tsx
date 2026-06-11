'use client';

import { useEffect } from 'react';

export function HomeViewedTracker() {
  useEffect(() => {
    import('@/lib/posthog').then(({ posthog }) => {
      posthog.capture('home_viewed');
    });
  }, []);

  return null;
}

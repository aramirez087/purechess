'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';

export function HomeViewedTracker() {
  useEffect(() => {
    posthog.capture('home_viewed');
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const eventId = Sentry.lastEventId();

  function handleCopy() {
    const text = eventId ?? error.digest ?? error.message;
    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  return (
    <html>
      <body style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Something went wrong. Refresh to try again.</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleCopy} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '0.375rem', background: 'white', cursor: 'pointer' }}>
            Copy error details
          </button>
          <button onClick={reset} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}

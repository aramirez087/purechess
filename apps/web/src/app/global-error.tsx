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
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#0b0d0b',
          color: '#f1eee6',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: '#9da79c',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Purechess
        </p>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ color: '#9da79c', fontSize: '0.875rem', margin: 0 }}>
          Refresh to try again.
        </p>
        {eventId && (
          <p
            style={{
              color: '#9da79c',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
              margin: 0,
            }}
          >
            {eventId}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #2b332c',
              borderRadius: '0.375rem',
              background: 'transparent',
              color: '#f1eee6',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Copy error details
          </button>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: '#f1eee6',
              color: '#0b0d0b',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}

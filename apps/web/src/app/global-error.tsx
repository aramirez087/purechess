'use client';

import { useEffect, useState } from 'react';
import { lazyCaptureException } from '@/lib/sentry-lazy';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The capture forces the lazy SDK load, so even a pre-idle crash reports.
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void lazyCaptureException(error).then((id) => {
      if (live) setEventId(id);
    });
    return () => {
      live = false;
    };
  }, [error]);

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
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#0b0d0b',
          color: '#f1eee6',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        {/* global-error renders without the root layout, so interactive states
            must be self-contained here. */}
        <style>{`
          .ge-btn { transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease; }
          .ge-btn:focus-visible { outline: 2px solid #d6b563; outline-offset: 2px; }
          .ge-btn-ghost:hover { background-color: #181c17; border-color: #3a443b; }
          .ge-btn-solid:hover { opacity: 0.9; }
        `}</style>
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
        <h2
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: 'italic',
            fontSize: '1.75rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Something broke.
        </h2>
        <div
          aria-hidden="true"
          style={{ height: 1, width: 40, background: 'rgba(214,181,99,0.6)' }}
        />
        <p style={{ color: '#9da79c', fontSize: '0.875rem', margin: 0 }}>Refresh to try again.</p>
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
            className="ge-btn ge-btn-ghost"
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
            className="ge-btn ge-btn-solid"
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

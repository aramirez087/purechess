/**
 * Client Sentry bootstrap — a tiny shim, NOT the SDK. withSentryConfig
 * prepends this file to the client entry; importing '@sentry/nextjs' here
 * statically is exactly what used to put the ~54 kB-gzip SDK core in the
 * shared-by-all chunk. Instead: buffer uncaught errors immediately, load +
 * init the SDK at idle (src/lib/sentry-lazy.ts), then replay the buffer.
 * Matches the semantics of Sentry's official Loader Script ("errors-only
 * until loaded"); pre-init breadcrumbs/instrumentation are knowingly lost.
 */

interface BufferedError {
  error: unknown;
}

const MAX_BUFFERED = 20;

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const buffer: BufferedError[] = [];

  const onError = (event: ErrorEvent) => {
    if (buffer.length < MAX_BUFFERED) buffer.push({ error: event.error ?? event.message });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (buffer.length < MAX_BUFFERED) buffer.push({ error: event.reason });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const init = () => {
    // Relative path on purpose — this file lives outside src/, where the
    // '@/' alias is not guaranteed to resolve for every tool that reads it.
    import('./src/lib/sentry-lazy')
      .then(({ loadSentry }) => loadSentry())
      .then((Sentry) => {
        // The SDK's own global handlers are live now.
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        for (const { error } of buffer.splice(0)) {
          Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
        }
      })
      .catch(() => {
        // SDK chunk unavailable (offline/ad-blocker) — eager init would have
        // been blocked the same way.
      });
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(init, { timeout: 3000 });
  } else {
    setTimeout(init, 500);
  }
}

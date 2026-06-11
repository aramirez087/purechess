/**
 * Lazy Sentry loader. NOTHING in the eager bundle may import '@sentry/nextjs'
 * statically — the SDK core is ~54 kB gzip and used to ship in the
 * shared-by-all chunk purely because sentry.client.config.ts (and the error
 * pages) imported it at module scope. This module is the only place the SDK
 * is loaded, and only via dynamic import.
 *
 * Init semantics mirror Sentry's official Loader-Script "errors-only until
 * loaded" model: the config shim buffers window errors until the idle-time
 * load completes; an explicit capture (error page / boundary) forces the
 * load so the error path itself never drops telemetry. Pre-init breadcrumbs
 * and instrumentation for the first ~1-3 s are knowingly lost.
 */

type SentryModule = typeof import('@sentry/nextjs');

let sentryPromise: Promise<SentryModule> | null = null;

export function loadSentry(): Promise<SentryModule> {
  if (sentryPromise) return sentryPromise;

  sentryPromise = import('@sentry/nextjs').then((Sentry) => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
        integrations: [Sentry.browserTracingIntegration()],
      });

      // Replay (rrweb, ~38 kB gzip) stays a second lazy hop after the core.
      // Keep calling the integration factory WITHOUT `new` (Do-Not-Repeat).
      Sentry.lazyLoadIntegration('replayIntegration')
        .then((replayIntegration) => {
          Sentry.addIntegration(
            replayIntegration({
              maskAllText: false,
              blockAllMedia: false,
              replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
              replaysOnErrorSampleRate: 1.0,
            }),
          );
        })
        .catch(() => {
          // Replay unavailable — non-critical, swallow.
        });
    }
    return Sentry;
  });

  return sentryPromise;
}

/**
 * Capture that forces the SDK load when needed. Resolves with the event id
 * (undefined if Sentry is unconfigured or the chunk failed to load — e.g.
 * blocked by an ad-blocker, where eager init would have been blocked too).
 */
export function lazyCaptureException(
  error: unknown,
  hint?: Parameters<SentryModule['captureException']>[1],
): Promise<string | undefined> {
  return loadSentry()
    .then((Sentry) => Sentry.captureException(error, hint))
    .catch(() => undefined);
}

/** Last event id, if the SDK has loaded and captured anything. */
export function lazyLastEventId(): Promise<string | undefined> {
  return loadSentry()
    .then((Sentry) => Sentry.lastEventId())
    .catch(() => undefined);
}

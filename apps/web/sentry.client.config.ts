import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
    // replaysSessionSampleRate/replaysOnErrorSampleRate wired in after idle load
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });

  // Load the rrweb-based Replay integration lazily so it is not bundled in the
  // initial shared chunk (saves ~38 kB gzip from every route). Error capture is
  // fully operational without Replay; recordings start once the idle callback
  // fires (typically < 2 s after DOMContentLoaded on a fast connection).
  const addReplay = () => {
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
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(addReplay, { timeout: 3000 });
  } else {
    setTimeout(addReplay, 500);
  }
}

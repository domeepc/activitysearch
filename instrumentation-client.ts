// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://f94846645c7f9eb7cd326cbffbd21bc6@o4510738181914624.ingest.de.sentry.io/4511129174409296",

  // Trace 10% of page loads; 100% sent a trace for every visit.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

// Session replay is ~50 KB gzipped, so fetch it once the page is idle instead of in the main bundle.
const loadReplay = () =>
  void Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => Sentry.addIntegration(replayIntegration()))
    .catch(() => {});
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(loadReplay, { timeout: 5000 });
} else {
  setTimeout(loadReplay, 3000);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

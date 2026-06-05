let sentryModule = null;
let posthogClient = null;

export function initMonitoring() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    import("@sentry/react").then((Sentry) => {
      sentryModule = Sentry;
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
      });
    });
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (posthogKey) {
    import("posthog-js").then(({ default: posthog }) => {
      posthogClient = posthog;
      posthog.init(posthogKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false,
        persistence: "localStorage",
      });
    });
  }
}

export function captureException(error, context = {}) {
  if (sentryModule) {
    sentryModule.captureException(error, { extra: context });
  }
}

export function trackPageView(path) {
  posthogClient?.capture("$pageview", { path });
}

export function identifyUser(user) {
  if (!posthogClient || !user?.id) return;
  posthogClient.identify(user.id, {
    email: user.email,
    name: user.name,
    username: user.username,
  });
}

export function resetAnalyticsUser() {
  posthogClient?.reset();
}

export function trackEvent(name, properties = {}) {
  posthogClient?.capture(name, properties);
}

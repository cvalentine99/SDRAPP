import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for client-side error tracking
 * Must be called before React renders
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn("[Sentry] DSN not configured, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Session replay for debugging
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
    
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter(
          (breadcrumb) => !breadcrumb.message?.includes("password")
        );
      }
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        app: "ettus-sdr-web",
        component: "client",
      },
    },
  });

  console.log("[Sentry] Client-side error tracking initialized");
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  Sentry.setUser(user);
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Create a transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startInactiveSpan({ name, op });
}

// Re-export Sentry components for React integration
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const withProfiler = Sentry.withProfiler;

// Re-export Sentry for advanced usage
export { Sentry };

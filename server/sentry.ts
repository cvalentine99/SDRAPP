import * as Sentry from "@sentry/node";
import { ENV } from "./_core/env";
import type { Express } from "express";
import { logger } from "./logger";

/**
 * Initialize Sentry for server-side error tracking
 * Must be called before any other imports in the main server file
 */
export function initSentry() {
  if (!ENV.sentryDsn) {
    logger.sentry.warn("DSN not configured, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: ENV.sentryDsn,
    environment: ENV.isProduction ? "production" : "development",
    
    // Performance monitoring
    tracesSampleRate: ENV.isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev
    
    // Set sampling rate for profiling
    profilesSampleRate: ENV.isProduction ? 0.1 : 1.0,
    
    // Capture unhandled promise rejections
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error", "warn"] }),
      Sentry.expressIntegration(),
    ],
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        app: "ettus-sdr-web",
        component: "server",
      },
    },
  });

  logger.sentry.info("Server-side error tracking initialized");
}

/**
 * Setup Sentry error handler for Express
 * Call this after all routes are registered
 */
export function setupSentryErrorHandler(app: Express) {
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Express error handler middleware for Sentry
 * Add this after all routes but before other error handlers
 */
export const sentryErrorHandler = Sentry.expressErrorHandler();

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
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Create a new scope for isolated error tracking
 */
export function withScope(callback: (scope: Sentry.Scope) => void) {
  Sentry.withScope(callback);
}

// Re-export Sentry for advanced usage
export { Sentry };

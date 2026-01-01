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

  // Sentry initialization logged via debug level
  if (import.meta.env.DEV) {
    console.debug("[Sentry] Client-side error tracking initialized");
  }
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

/**
 * Start a performance span for tracking operation duration
 * Returns a function to end the span
 */
export function startSpan(name: string, op: string): () => void {
  const span = Sentry.startInactiveSpan({ name, op });
  return () => span?.end();
}

/**
 * Wrap an async operation with performance tracking
 */
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => {
    return fn();
  });
}

/**
 * Wrap a sync operation with performance tracking
 */
export function withSpanSync<T>(
  name: string,
  op: string,
  fn: () => T
): T {
  return Sentry.startSpanManual({ name, op }, (span) => {
    try {
      const result = fn();
      span.end();
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: String(error) });
      span.end();
      throw error;
    }
  });
}

/**
 * SDR-specific performance spans
 */
export const sdrSpans = {
  /** Track FFT processing time */
  fftProcessing: (binCount: number) => startSpan(`FFT Processing (${binCount} bins)`, "sdr.fft"),
  
  /** Track waterfall rendering time */
  waterfallRender: () => startSpan("Waterfall Render", "sdr.render.waterfall"),
  
  /** Track spectrograph rendering time */
  spectrographRender: () => startSpan("Spectrograph Render", "sdr.render.spectrograph"),
  
  /** Track file upload time */
  fileUpload: (filename: string, size: number) => 
    startSpan(`Upload ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`, "sdr.upload"),
  
  /** Track scan operation time */
  scanOperation: (startFreq: number, stopFreq: number) => 
    startSpan(`Scan ${(startFreq / 1e6).toFixed(1)}-${(stopFreq / 1e6).toFixed(1)} MHz`, "sdr.scan"),
  
  /** Track recording operation time */
  recordingOperation: (duration: number) => 
    startSpan(`Recording ${duration}s`, "sdr.recording"),
  
  /** Track AI analysis time */
  aiAnalysis: () => startSpan("AI Spectrum Analysis", "sdr.ai.analysis"),
  
  /** Track WebSocket message processing */
  wsMessageProcess: () => startSpan("WebSocket Message", "sdr.websocket"),
};

// Re-export Sentry components for React integration
export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const withProfiler = Sentry.withProfiler;

// Re-export Sentry for advanced usage
export { Sentry };

import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface FallbackProps {
  error: unknown;
  componentStack: string | null;
  eventId: string | null;
  resetError: () => void;
}

/**
 * Fallback UI shown when an error is caught
 */
function ErrorFallback({ error, resetError }: FallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-red-500/10 rounded-full">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-muted-foreground">
            An unexpected error occurred. Our team has been notified and is working on a fix.
          </p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-left">
          <p className="text-sm font-mono text-muted-foreground break-all">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
        
        <div className="flex gap-3 justify-center">
          <Button onClick={resetError} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button 
            onClick={() => window.location.href = "/"} 
            variant="outline"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SentryErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Error boundary that captures errors to Sentry
 * Wrap components or pages to catch and report errors
 */
export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => <ErrorFallback {...props} />}
      beforeCapture={(scope) => {
        scope.setTag("component", "error-boundary");
        scope.setLevel("error");
      }}
      onError={(error, componentStack, eventId) => {
        console.error("[SentryErrorBoundary] Caught error:", error);
        console.error("[SentryErrorBoundary] Component stack:", componentStack);
        console.error("[SentryErrorBoundary] Event ID:", eventId);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

/**
 * Higher-order component to wrap a component with Sentry error boundary
 */
export function withSentryErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    return (
      <SentryErrorBoundary>
        <Component {...props} />
      </SentryErrorBoundary>
    );
  };
}

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /**
   * Error title (optional, defaults to "Error")
   */
  title?: string;

  /**
   * Error message to display
   */
  message: string;

  /**
   * Optional retry callback
   */
  onRetry?: () => void;

  /**
   * Show retry button (defaults to true if onRetry is provided)
   */
  showRetry?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Standardized error display component
 * 
 * Provides consistent error messaging across the application with optional retry functionality.
 * 
 * @example
 * ```tsx
 * <ErrorDisplay
 *   title="Failed to load data"
 *   message="Could not connect to server. Please check your connection."
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorDisplay({
  title = "Error",
  message,
  onRetry,
  showRetry = !!onRetry,
  className,
}: ErrorDisplayProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p className="text-sm">{message}</p>
          {showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try Again
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline error display (smaller, less prominent)
 */
export function InlineError({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className || ""}`}>
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

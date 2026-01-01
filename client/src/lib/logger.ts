/**
 * Client-side Structured Logger for SDR Web Application
 * 
 * Provides consistent logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured metadata
 * - Environment-aware output (disabled in production unless explicitly enabled)
 * - Sentry breadcrumb integration
 */

import * as Sentry from "@sentry/react";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  timestamps: boolean;
  /** Whether logging is enabled */
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default configuration based on environment
const defaultConfig: LoggerConfig = {
  minLevel: import.meta.env.PROD ? "warn" : "debug",
  timestamps: true,
  enabled: import.meta.env.VITE_LOG_ENABLED !== "false",
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  config = { ...config, ...options };
}

/**
 * Format log message
 */
function formatMessage(
  level: LogLevel,
  category: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = config.timestamps ? new Date().toISOString() : "";
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `${prefix} ${message}${contextStr}`;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  category: string,
  message: string,
  context?: LogContext
): void {
  if (!shouldLog(level)) return;
  
  const formatted = formatMessage(level, category, message, context);
  
  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      // Add Sentry breadcrumb for warnings
      Sentry.addBreadcrumb({
        category,
        message,
        level: "warning",
        data: context,
      });
      break;
    case "error":
      console.error(formatted);
      // Add Sentry breadcrumb for errors
      Sentry.addBreadcrumb({
        category,
        message,
        level: "error",
        data: context,
      });
      break;
  }
}

/**
 * Create a logger instance for a specific category
 */
export function createLogger(category: string) {
  return {
    debug: (message: string, context?: LogContext) => 
      log("debug", category, message, context),
    info: (message: string, context?: LogContext) => 
      log("info", category, message, context),
    warn: (message: string, context?: LogContext) => 
      log("warn", category, message, context),
    error: (message: string, context?: LogContext) => 
      log("error", category, message, context),
  };
}

// Pre-configured loggers for common categories
export const logger = {
  // UI loggers
  ui: createLogger("ui"),
  navigation: createLogger("navigation"),
  
  // SDR-specific loggers
  spectrum: createLogger("spectrum"),
  websocket: createLogger("websocket"),
  scanner: createLogger("scanner"),
  recording: createLogger("recording"),
  device: createLogger("device"),
  
  // Feature loggers
  bookmarks: createLogger("bookmarks"),
  ai: createLogger("ai"),
};

// Export default logger for quick access
export default logger;

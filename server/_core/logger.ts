/**
 * Structured logging utility for production-ready logging
 * Replaces console.log with proper log levels and context
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Set log level from environment, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.minLevel = envLevel && envLevel in LogLevel 
      ? LogLevel[envLevel as keyof typeof LogLevel] 
      : LogLevel.INFO;
  }

  private log(level: LogLevel, component: string, message: string, context?: LogContext) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const logEntry = {
      timestamp,
      level: levelName,
      component,
      message,
      ...context,
    };

    // Output as JSON for structured logging systems (e.g., CloudWatch, Datadog)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      // Human-readable format for development
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] ${levelName} [${component}] ${message}${contextStr}`);
    }
  }

  debug(component: string, message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, component, message, context);
  }

  info(component: string, message: string, context?: LogContext) {
    this.log(LogLevel.INFO, component, message, context);
  }

  warn(component: string, message: string, context?: LogContext) {
    this.log(LogLevel.WARN, component, message, context);
  }

  error(component: string, message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, component, message, context);
  }
}

// Singleton instance
export const logger = new Logger();

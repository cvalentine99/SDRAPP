/**
 * In-memory log storage for the log viewer
 * Stores recent logs with circular buffer behavior
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_LOGS = 1000; // Maximum number of logs to store
const logs: LogEntry[] = [];
let logIdCounter = 0;

/**
 * Add a log entry to storage
 */
export function addLogEntry(
  level: LogLevel,
  category: string,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    id: `log_${++logIdCounter}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    context,
  };

  logs.push(entry);

  // Remove oldest logs if we exceed the limit
  while (logs.length > MAX_LOGS) {
    logs.shift();
  }

  return entry;
}

/**
 * Get logs with optional filtering
 */
export function getLogs(options?: {
  level?: LogLevel;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): { logs: LogEntry[]; total: number } {
  let filtered = [...logs];

  // Filter by level
  if (options?.level) {
    const levelPriority: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    const minPriority = levelPriority[options.level];
    filtered = filtered.filter(
      (log) => levelPriority[log.level] >= minPriority
    );
  }

  // Filter by category
  if (options?.category) {
    filtered = filtered.filter((log) =>
      log.category.toLowerCase().includes(options.category!.toLowerCase())
    );
  }

  // Filter by search term
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.message.toLowerCase().includes(searchLower) ||
        log.category.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.context || {}).toLowerCase().includes(searchLower)
    );
  }

  // Sort by timestamp descending (newest first)
  filtered.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = filtered.length;

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 100;
  filtered = filtered.slice(offset, offset + limit);

  return { logs: filtered, total };
}

/**
 * Get unique categories from stored logs
 */
export function getCategories(): string[] {
  const categories = new Set<string>();
  logs.forEach((log) => categories.add(log.category));
  return Array.from(categories).sort();
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs.length = 0;
}

/**
 * Get log statistics
 */
export function getLogStats(): {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
} {
  const byLevel: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };
  const byCategory: Record<string, number> = {};

  logs.forEach((log) => {
    byLevel[log.level]++;
    byCategory[log.category] = (byCategory[log.category] || 0) + 1;
  });

  return {
    total: logs.length,
    byLevel,
    byCategory,
  };
}

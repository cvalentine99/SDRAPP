import { addBreadcrumb } from "./sentry";

/**
 * SDR-specific breadcrumb categories for Sentry debugging
 */

/**
 * Log frequency change action
 */
export function logFrequencyChange(
  frequency: number,
  previousFrequency?: number,
  source: "slider" | "input" | "bookmark" | "preset" = "input"
) {
  addBreadcrumb({
    category: "sdr.frequency",
    message: `Frequency changed to ${formatFrequency(frequency)}`,
    level: "info",
    data: {
      frequency,
      previousFrequency,
      source,
      changeAmount: previousFrequency ? frequency - previousFrequency : undefined,
    },
  });
}

/**
 * Log gain change action
 */
export function logGainChange(
  gain: number,
  previousGain?: number,
  source: "slider" | "input" | "preset" = "input"
) {
  addBreadcrumb({
    category: "sdr.gain",
    message: `Gain changed to ${gain} dB`,
    level: "info",
    data: {
      gain,
      previousGain,
      source,
    },
  });
}

/**
 * Log sample rate change action
 */
export function logSampleRateChange(sampleRate: number, previousSampleRate?: number) {
  addBreadcrumb({
    category: "sdr.sampleRate",
    message: `Sample rate changed to ${formatSampleRate(sampleRate)}`,
    level: "info",
    data: {
      sampleRate,
      previousSampleRate,
    },
  });
}

/**
 * Log recording start action
 */
export function logRecordingStart(config: {
  frequency: number;
  sampleRate: number;
  gain: number;
  duration?: number;
}) {
  addBreadcrumb({
    category: "sdr.recording",
    message: `Recording started at ${formatFrequency(config.frequency)}`,
    level: "info",
    data: {
      ...config,
      action: "start",
    },
  });
}

/**
 * Log recording stop action
 */
export function logRecordingStop(recordingId?: string, duration?: number) {
  addBreadcrumb({
    category: "sdr.recording",
    message: `Recording stopped${duration ? ` after ${duration}s` : ""}`,
    level: "info",
    data: {
      recordingId,
      duration,
      action: "stop",
    },
  });
}

/**
 * Log recording deletion
 */
export function logRecordingDelete(recordingId: string, filename?: string) {
  addBreadcrumb({
    category: "sdr.recording",
    message: `Recording deleted: ${filename || recordingId}`,
    level: "info",
    data: {
      recordingId,
      filename,
      action: "delete",
    },
  });
}

/**
 * Log scanner start action
 */
export function logScannerStart(config: {
  startFrequency: number;
  endFrequency: number;
  stepSize: number;
  dwellTime: number;
}) {
  addBreadcrumb({
    category: "sdr.scanner",
    message: `Scan started: ${formatFrequency(config.startFrequency)} - ${formatFrequency(config.endFrequency)}`,
    level: "info",
    data: {
      ...config,
      action: "start",
    },
  });
}

/**
 * Log scanner stop action
 */
export function logScannerStop(signalsFound?: number) {
  addBreadcrumb({
    category: "sdr.scanner",
    message: `Scan stopped${signalsFound !== undefined ? `, found ${signalsFound} signals` : ""}`,
    level: "info",
    data: {
      signalsFound,
      action: "stop",
    },
  });
}

/**
 * Log scanner signal detection
 */
export function logSignalDetected(signal: {
  frequency: number;
  power: number;
  bandwidth?: number;
  signalType?: string;
}) {
  addBreadcrumb({
    category: "sdr.scanner",
    message: `Signal detected at ${formatFrequency(signal.frequency)} (${signal.power.toFixed(1)} dBm)`,
    level: "info",
    data: {
      ...signal,
      action: "signal_detected",
    },
  });
}

/**
 * Log device connection status change
 */
export function logDeviceConnection(
  status: "connected" | "disconnected" | "error",
  deviceInfo?: { serial?: string; type?: string }
) {
  addBreadcrumb({
    category: "sdr.device",
    message: `Device ${status}${deviceInfo?.serial ? `: ${deviceInfo.serial}` : ""}`,
    level: status === "error" ? "error" : "info",
    data: {
      status,
      ...deviceInfo,
    },
  });
}

/**
 * Log streaming start/stop
 */
export function logStreamingChange(
  action: "start" | "stop",
  config?: { frequency?: number; sampleRate?: number }
) {
  addBreadcrumb({
    category: "sdr.streaming",
    message: `FFT streaming ${action}ed`,
    level: "info",
    data: {
      action,
      ...config,
    },
  });
}

/**
 * Log WebSocket connection status
 */
export function logWebSocketStatus(
  status: "connecting" | "connected" | "disconnected" | "error",
  url?: string
) {
  addBreadcrumb({
    category: "sdr.websocket",
    message: `WebSocket ${status}`,
    level: status === "error" ? "error" : "info",
    data: {
      status,
      url,
    },
  });
}

/**
 * Log bookmark action
 */
export function logBookmarkAction(
  action: "create" | "delete" | "load",
  bookmark: { name?: string; frequency?: number }
) {
  addBreadcrumb({
    category: "sdr.bookmark",
    message: `Bookmark ${action}: ${bookmark.name || formatFrequency(bookmark.frequency || 0)}`,
    level: "info",
    data: {
      action,
      ...bookmark,
    },
  });
}

/**
 * Log AI analysis request
 */
export function logAIAnalysis(
  action: "request" | "response" | "error",
  context?: { frequency?: number; signalType?: string }
) {
  addBreadcrumb({
    category: "sdr.ai",
    message: `AI analysis ${action}`,
    level: action === "error" ? "error" : "info",
    data: {
      action,
      ...context,
    },
  });
}

/**
 * Log page navigation
 */
export function logNavigation(page: string, previousPage?: string) {
  addBreadcrumb({
    category: "navigation",
    message: `Navigated to ${page}`,
    level: "info",
    data: {
      page,
      previousPage,
    },
  });
}

// Helper functions
function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz} Hz`;
}

function formatSampleRate(sps: number): string {
  if (sps >= 1e6) return `${(sps / 1e6).toFixed(2)} MSPS`;
  if (sps >= 1e3) return `${(sps / 1e3).toFixed(2)} kSPS`;
  return `${sps} SPS`;
}

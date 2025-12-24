import { TRPCError } from "@trpc/server";

/**
 * Standardized error handling utilities
 * Provides consistent error messages and codes across all routers
 */

/**
 * Error codes for different failure types
 */
export enum SDRErrorCode {
  // Hardware errors
  HARDWARE_NOT_FOUND = "HARDWARE_NOT_FOUND",
  HARDWARE_BUSY = "HARDWARE_BUSY",
  HARDWARE_TIMEOUT = "HARDWARE_TIMEOUT",
  HARDWARE_DISCONNECTED = "HARDWARE_DISCONNECTED",

  // Configuration errors
  INVALID_FREQUENCY = "INVALID_FREQUENCY",
  INVALID_SAMPLE_RATE = "INVALID_SAMPLE_RATE",
  INVALID_GAIN = "INVALID_GAIN",
  INVALID_DURATION = "INVALID_DURATION",

  // Operation errors
  SCAN_FAILED = "SCAN_FAILED",
  RECORDING_FAILED = "RECORDING_FAILED",
  CALIBRATION_FAILED = "CALIBRATION_FAILED",
  STREAM_FAILED = "STREAM_FAILED",

  // Storage errors
  UPLOAD_FAILED = "UPLOAD_FAILED",
  DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
  STORAGE_FULL = "STORAGE_FULL",

  // System errors
  DEMO_MODE_LIMITATION = "DEMO_MODE_LIMITATION",
  PRODUCTION_MODE_REQUIRED = "PRODUCTION_MODE_REQUIRED",
}

/**
 * Create a standardized TRPC error with actionable message
 */
export function createSDRError(
  code: SDRErrorCode,
  message: string,
  cause?: unknown
): TRPCError {
  const errorMessages: Record<SDRErrorCode, string> = {
    [SDRErrorCode.HARDWARE_NOT_FOUND]:
      "B210 hardware not detected. Please connect the device and restart the server.",
    [SDRErrorCode.HARDWARE_BUSY]:
      "Hardware is currently in use. Please wait for the current operation to complete.",
    [SDRErrorCode.HARDWARE_TIMEOUT]:
      "Hardware operation timed out. Check USB connection and try again.",
    [SDRErrorCode.HARDWARE_DISCONNECTED]:
      "Hardware disconnected during operation. Please reconnect and try again.",

    [SDRErrorCode.INVALID_FREQUENCY]:
      "Frequency out of range (70 MHz - 6 GHz). Please enter a valid frequency.",
    [SDRErrorCode.INVALID_SAMPLE_RATE]:
      "Sample rate out of range (200 kSPS - 61.44 MSPS). Please enter a valid sample rate.",
    [SDRErrorCode.INVALID_GAIN]:
      "Gain out of range (0 - 76 dB). Please enter a valid gain.",
    [SDRErrorCode.INVALID_DURATION]:
      "Duration out of range (1 - 3600 seconds). Please enter a valid duration.",

    [SDRErrorCode.SCAN_FAILED]:
      "Frequency scan failed. Check hardware connection and try again.",
    [SDRErrorCode.RECORDING_FAILED]:
      "IQ recording failed. Check available disk space and try again.",
    [SDRErrorCode.CALIBRATION_FAILED]:
      "Calibration failed. Ensure hardware is properly connected.",
    [SDRErrorCode.STREAM_FAILED]:
      "FFT streaming failed. Check WebSocket connection and try again.",

    [SDRErrorCode.UPLOAD_FAILED]:
      "Failed to upload file to S3. Check network connection and try again.",
    [SDRErrorCode.DOWNLOAD_FAILED]:
      "Failed to download file from S3. Check network connection and try again.",
    [SDRErrorCode.STORAGE_FULL]:
      "Storage is full. Please delete old recordings to free up space.",

    [SDRErrorCode.DEMO_MODE_LIMITATION]:
      "This feature is limited in demo mode. Some data may be simulated.",
    [SDRErrorCode.PRODUCTION_MODE_REQUIRED]:
      "This feature requires production mode with real B210 hardware. Please connect hardware and switch to production mode in Settings.",
  };

  const defaultMessage = errorMessages[code] || message;

  console.error(`[SDR Error] ${code}: ${message}`, cause);

  return new TRPCError({
    code: "BAD_REQUEST",
    message: `${defaultMessage}\n\nDetails: ${message}`,
    cause,
  });
}

/**
 * Wrap hardware operations with standardized error handling
 */
export async function withHardwareErrorHandling<T>(
  operation: () => Promise<T>,
  errorCode: SDRErrorCode,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw createSDRError(
      errorCode,
      `${operationName} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error
    );
  }
}

/**
 * Validate hardware is available before operation
 */
export function ensureHardwareAvailable(): void {
  // In demo mode, hardware is always "available"
  if (process.env.SDR_MODE !== "production") {
    return;
  }

  // In production mode, check if hardware is actually connected
  // This would typically check for the presence of the B210 device
  // For now, we assume it's available if we're in production mode
}

/**
 * Create a user-friendly error message from a caught error
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof TRPCError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred. Please try again.";
}

/**
 * Log error with context for debugging
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  console.error(`[${context}]`, {
    error: formatErrorMessage(error),
    metadata,
    timestamp: new Date().toISOString(),
  });
}

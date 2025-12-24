import { hardware } from "../hardware";

/**
 * Shared hardware utility functions
 * Consolidates common hardware interaction patterns
 */

/**
 * Get current SDR configuration and status in one call
 * Reduces duplicate code across routers
 */
export async function getSDRState() {
  const config = hardware.getConfig();
  const status = hardware.getStatus();

  return {
    config: {
      frequency: config.frequency,
      sampleRate: config.sampleRate,
      gain: config.gain,
    },
    status: {
      temperature: status.temperature,
      gpsLock: status.gpsLock,
      pllLock: status.pllLock,
    },
  };
}

/**
 * Convert frequency from Hz to MHz
 */
export function hzToMhz(hz: number): number {
  return hz / 1e6;
}

/**
 * Convert frequency from MHz to Hz
 */
export function mhzToHz(mhz: number): number {
  return mhz * 1e6;
}

/**
 * Convert sample rate from SPS to MSPS
 */
export function spsToMsps(sps: number): number {
  return sps / 1e6;
}

/**
 * Convert sample rate from MSPS to SPS
 */
export function mspsToSps(msps: number): number {
  return msps * 1e6;
}

/**
 * Format frequency for display
 * @example formatFrequency(2437000000) => "2437.000 MHz"
 */
export function formatFrequency(hz: number): string {
  const mhz = hzToMhz(hz);
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(3)} GHz`;
  }
  return `${mhz.toFixed(3)} MHz`;
}

/**
 * Format sample rate for display
 * @example formatSampleRate(10000000) => "10.00 MSPS"
 */
export function formatSampleRate(sps: number): string {
  const msps = spsToMsps(sps);
  if (msps >= 1) {
    return `${msps.toFixed(2)} MSPS`;
  }
  return `${(sps / 1e3).toFixed(2)} kSPS`;
}

/**
 * Calculate expected file size for IQ recording
 * @param sampleRate - Sample rate in samples per second
 * @param duration - Duration in seconds
 * @returns File size in bytes (complex float32: 8 bytes per sample)
 */
export function calculateRecordingSize(
  sampleRate: number,
  duration: number
): number {
  // Complex IQ: 2 floats (I and Q) * 4 bytes each = 8 bytes per sample
  return sampleRate * duration * 8;
}

/**
 * Format file size for display
 * @example formatFileSize(1048576) => "1.00 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) {
    return `${(bytes / 1e9).toFixed(2)} GB`;
  }
  if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(2)} MB`;
  }
  if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(2)} KB`;
  }
  return `${bytes} bytes`;
}

/**
 * Check if system is in production mode
 */
export function isProductionMode(): boolean {
  return process.env.SDR_MODE === "production";
}

/**
 * Check if system is in demo mode
 */
export function isDemoMode(): boolean {
  return !isProductionMode();
}

/**
 * Get current SDR mode
 */
export function getSDRMode(): "demo" | "production" {
  return isProductionMode() ? "production" : "demo";
}

/**
 * Validate hardware health and return warnings
 */
export function getHealthWarnings(): string[] {
  const status = hardware.getStatus();
  const warnings: string[] = [];

  if (status.temperature > 60) {
    warnings.push(
      `⚠️ High temperature: ${status.temperature}°C - Consider improving cooling`
    );
  }

  if (!status.gpsLock) {
    warnings.push("📡 No GPS lock - Frequency accuracy may be reduced");
  }

  if (!status.pllLock) {
    warnings.push("⚠️ PLL not locked - Check hardware connection");
  }

  return warnings;
}

/**
 * Generate SigMF metadata for IQ recording
 * @see https://github.com/gnuradio/SigMF
 */
export function generateSigMFMetadata(params: {
  frequency: number;
  sampleRate: number;
  gain: number;
  duration: number;
  dataUrl: string;
}) {
  return {
    global: {
      "core:datatype": "cf32_le", // Complex float32, little-endian
      "core:sample_rate": params.sampleRate,
      "core:version": "1.0.0",
      "core:description": `Ettus B210 IQ recording at ${formatFrequency(params.frequency)}`,
      "core:author": "Ettus SDR Web",
      "core:recorder": "ettus-sdr-web",
    },
    captures: [
      {
        "core:sample_start": 0,
        "core:frequency": params.frequency,
        "core:datetime": new Date().toISOString(),
      },
    ],
    annotations: [
      {
        "core:sample_start": 0,
        "core:sample_count": params.sampleRate * params.duration,
        "core:freq_lower_edge": params.frequency - params.sampleRate / 2,
        "core:freq_upper_edge": params.frequency + params.sampleRate / 2,
        "core:label": "IQ Recording",
      },
    ],
  };
}

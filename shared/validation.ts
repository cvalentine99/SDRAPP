import { z } from "zod";

/**
 * Shared validation schemas for SDR parameters
 * Used across multiple routers to ensure consistency
 */

// B210 hardware limits
export const B210_LIMITS = {
  FREQUENCY_MIN: 70e6, // 70 MHz
  FREQUENCY_MAX: 6e9, // 6 GHz
  SAMPLE_RATE_MIN: 200e3, // 200 kSPS
  SAMPLE_RATE_MAX: 61.44e6, // 61.44 MSPS
  GAIN_MIN: 0, // 0 dB
  GAIN_MAX: 76, // 76 dB
} as const;

/**
 * Frequency validation (in Hz)
 * Range: 70 MHz to 6 GHz (B210 limits)
 */
export const frequencySchema = z
  .number()
  .min(
    B210_LIMITS.FREQUENCY_MIN,
    `Frequency must be at least ${B210_LIMITS.FREQUENCY_MIN / 1e6} MHz`
  )
  .max(
    B210_LIMITS.FREQUENCY_MAX,
    `Frequency must be at most ${B210_LIMITS.FREQUENCY_MAX / 1e9} GHz`
  );

/**
 * Sample rate validation (in samples per second)
 * Range: 200 kSPS to 61.44 MSPS (B210 limits)
 */
export const sampleRateSchema = z
  .number()
  .min(
    B210_LIMITS.SAMPLE_RATE_MIN,
    `Sample rate must be at least ${B210_LIMITS.SAMPLE_RATE_MIN / 1e3} kSPS`
  )
  .max(
    B210_LIMITS.SAMPLE_RATE_MAX,
    `Sample rate must be at most ${B210_LIMITS.SAMPLE_RATE_MAX / 1e6} MSPS`
  );

/**
 * Gain validation (in dB)
 * Range: 0 to 76 dB (B210 limits)
 */
export const gainSchema = z
  .number()
  .min(B210_LIMITS.GAIN_MIN, `Gain must be at least ${B210_LIMITS.GAIN_MIN} dB`)
  .max(B210_LIMITS.GAIN_MAX, `Gain must be at most ${B210_LIMITS.GAIN_MAX} dB`);

/**
 * Duration validation (in seconds)
 * Range: 1 to 3600 seconds (1 hour max)
 */
export const durationSchema = z
  .number()
  .min(1, "Duration must be at least 1 second")
  .max(3600, "Duration must be at most 3600 seconds (1 hour)");

/**
 * Complete SDR configuration schema
 */
export const sdrConfigSchema = z.object({
  frequency: frequencySchema,
  sampleRate: sampleRateSchema,
  gain: gainSchema.optional().default(40),
});

/**
 * Recording parameters schema
 */
export const recordingParamsSchema = z.object({
  frequency: frequencySchema,
  sampleRate: sampleRateSchema,
  duration: durationSchema,
  gain: gainSchema.optional().default(40),
});

/**
 * Scanner parameters schema
 */
export const scannerParamsSchema = z.object({
  startFreq: frequencySchema,
  endFreq: frequencySchema,
  stepSize: z
    .number()
    .min(100e3, "Step size must be at least 100 kHz")
    .max(100e6, "Step size must be at most 100 MHz"),
  gain: gainSchema.optional().default(40),
});

/**
 * SDR mode validation
 */
export const sdrModeSchema = z.enum(["demo", "production"]);

/**
 * Type exports for use in TypeScript
 */
export type SDRConfig = z.infer<typeof sdrConfigSchema>;
export type RecordingParams = z.infer<typeof recordingParamsSchema>;
export type ScannerParams = z.infer<typeof scannerParamsSchema>;
export type SDRMode = z.infer<typeof sdrModeSchema>;

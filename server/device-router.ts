/**
 * device-router.ts - B210 Device Control tRPC Router
 * 
 * Exposes hardware-manager controls to frontend
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';
import { hardwareManager } from './hardware-manager-factory';
import { B210_LIMITS } from './hardware-types';

export const deviceRouter = router({
  /**
   * Get current device configuration
   */
  getConfig: publicProcedure.query(() => {
    return hardwareManager.getConfig();
  }),

  /**
   * Get hardware status (GPSDO, temperature, etc.)
   */
  getStatus: publicProcedure.query(() => {
    return {
      ...hardwareManager.getStatus(),
      isRunning: hardwareManager.isHardwareRunning(),
      limits: B210_LIMITS,
    };
  }),

  /**
   * Set center frequency
   */
  setFrequency: publicProcedure
    .input(z.object({
      frequency: z.number()
        .min(B210_LIMITS.MIN_FREQ, `Frequency must be >= ${B210_LIMITS.MIN_FREQ/1e6} MHz`)
        .max(B210_LIMITS.MAX_FREQ, `Frequency must be <= ${B210_LIMITS.MAX_FREQ/1e6} MHz`),
    }))
    .mutation(async ({ input }) => {
      await hardwareManager.setFrequency(input.frequency);
      return { success: true, frequency: input.frequency };
    }),

  /**
   * Set RX gain
   */
  setGain: publicProcedure
    .input(z.object({
      gain: z.number()
        .min(B210_LIMITS.MIN_RX_GAIN, `RX gain must be >= ${B210_LIMITS.MIN_RX_GAIN} dB`)
        .max(B210_LIMITS.MAX_RX_GAIN, `RX gain must be <= ${B210_LIMITS.MAX_RX_GAIN} dB`),
    }))
    .mutation(async ({ input }) => {
      await hardwareManager.setGain(input.gain);
      return { success: true, gain: input.gain };
    }),

  /**
   * Set sample rate
   */
  setSampleRate: publicProcedure
    .input(z.object({
      sampleRate: z.number()
        .min(200e3, 'Sample rate must be >= 200 kHz')
        .max(61.44e6, 'Sample rate must be <= 61.44 MHz'),
    }))
    .mutation(async ({ input }) => {
      await hardwareManager.setSampleRate(input.sampleRate);
      return { success: true, sampleRate: input.sampleRate };
    }),

  /**
   * Set bandwidth
   */
  setBandwidth: publicProcedure
    .input(z.object({
      bandwidth: z.number()
        .min(B210_LIMITS.MIN_BW, `Bandwidth must be >= ${B210_LIMITS.MIN_BW/1e6} MHz`)
        .max(B210_LIMITS.MAX_BW, `Bandwidth must be <= ${B210_LIMITS.MAX_BW/1e6} MHz`),
    }))
    .mutation(async ({ input }) => {
      await hardwareManager.setBandwidth(input.bandwidth);
      return { success: true, bandwidth: input.bandwidth };
    }),

  /**
   * Start hardware streaming
   */
  start: publicProcedure.mutation(async () => {
    await hardwareManager.start();
    return { success: true };
  }),

  /**
   * Stop hardware streaming
   */
  stop: publicProcedure.mutation(async () => {
    await hardwareManager.stop();
    return { success: true };
  }),
});

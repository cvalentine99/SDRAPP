/**
 * SDR Control Plane V2 Router
 * 
 * tRPC endpoints for the production-grade SDR control plane.
 * Exposes capability/policy information and atomic configuration.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getProductionControlPlane } from "./sdr-control-plane-v2";
import {
  type SDRConfig,
  type HardwareCapabilities,
  type OperationalPolicy,
  DEVICE_CAPABILITIES,
  loadPolicyFromEnv,
  getDeviceCapabilities,
} from "../shared/sdr-capabilities";
import {
  discoverCapabilities,
  listAvailableDevices,
  clearCapabilityCache,
} from "./capability-discovery";

// Zod schemas
const DeviceTypeSchema = z.enum([
  "b210", "b200", "x310", "simulator", "rtlsdr", "hackrf", "limesdr"
]);

const SDRConfigSchema = z.object({
  frequency: z.number(),
  sampleRate: z.number(),
  gain: z.number(),
  bandwidth: z.number(),
  antenna: z.string(),
  channel: z.number(),
});

const PolicyUpdateSchema = z.object({
  allowedFrequencyRange: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  maxSampleRate: z.number().optional(),
  maxGain: z.number().optional(),
  txEnabled: z.boolean().optional(),
  maxStreamDuration: z.number().optional(),
  maxConcurrentStreams: z.number().optional(),
  recordingEnabled: z.boolean().optional(),
  maxRecordingDuration: z.number().optional(),
  maxRecordingSize: z.number().optional(),
});

// Runtime policy storage (can be updated by admin)
let runtimePolicy: OperationalPolicy | null = null;

function getPolicy(): OperationalPolicy {
  if (!runtimePolicy) {
    runtimePolicy = loadPolicyFromEnv();
  }
  return runtimePolicy;
}

export const sdrControlV2Router = router({
  /**
   * Get current control plane context
   */
  getContext: publicProcedure.query(() => {
    const controlPlane = getProductionControlPlane();
    return controlPlane.getContext();
  }),

  /**
   * Get current state
   */
  getState: publicProcedure.query(() => {
    const controlPlane = getProductionControlPlane();
    return controlPlane.getState();
  }),

  /**
   * Get current configuration
   */
  getConfig: publicProcedure.query(() => {
    const controlPlane = getProductionControlPlane();
    return controlPlane.getConfig();
  }),

  /**
   * Get device capabilities
   */
  getCapabilities: publicProcedure.query(() => {
    const controlPlane = getProductionControlPlane();
    return controlPlane.getCapabilities();
  }),

  /**
   * Get operational policy
   */
  getPolicy: publicProcedure.query(() => {
    return getPolicy();
  }),

  /**
   * Get all available device capabilities (static definitions)
   */
  getAllDeviceCapabilities: publicProcedure.query(() => {
    return DEVICE_CAPABILITIES;
  }),

/**
   * Get capabilities for a specific device type (static)
   */
  getDeviceCapabilities: publicProcedure
    .input(z.object({ deviceType: DeviceTypeSchema }))
    .query(({ input }) => {
      return getDeviceCapabilities(input.deviceType);
    }),

  /**
   * Discover capabilities from actual hardware
   * Falls back to static definitions if hardware unavailable
   */
  discoverCapabilities: protectedProcedure
    .input(z.object({
      deviceType: DeviceTypeSchema,
      serial: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await discoverCapabilities(input.deviceType, input.serial);
    }),

  /**
   * List all available SDR devices
   */
  listAvailableDevices: publicProcedure.query(async () => {
    return await listAvailableDevices();
  }),

  /**
   * Clear capability cache (force re-discovery)
   */
  clearCapabilityCache: protectedProcedure.mutation(() => {
    clearCapabilityCache();
    return { success: true };
  }),

  /**
   * Get audit log
   */
  getAuditLog: publicProcedure.query(() => {
    const controlPlane = getProductionControlPlane();
    return controlPlane.getAuditLog();
  }),

  /**
   * Set device type
   */
  setDeviceType: protectedProcedure
    .input(z.object({ deviceType: DeviceTypeSchema }))
    .mutation(async ({ input }) => {
      const controlPlane = getProductionControlPlane();
      await controlPlane.setDeviceType(input.deviceType);
      return { success: true, context: controlPlane.getContext() };
    }),

  /**
   * Connect to device
   */
  connect: protectedProcedure
    .input(z.object({ serial: z.string().optional() }))
    .mutation(async ({ input }) => {
      const controlPlane = getProductionControlPlane();
      await controlPlane.connect(input.serial);
      return { success: true, context: controlPlane.getContext() };
    }),

  /**
   * Disconnect from device
   */
  disconnect: protectedProcedure.mutation(async () => {
    const controlPlane = getProductionControlPlane();
    await controlPlane.disconnect();
    return { success: true, context: controlPlane.getContext() };
  }),

  /**
   * Apply configuration (atomic)
   */
  applyConfig: protectedProcedure
    .input(SDRConfigSchema)
    .mutation(async ({ input }) => {
      const controlPlane = getProductionControlPlane();
      const result = await controlPlane.applyConfig(input as SDRConfig);
      return {
        validation: result,
        context: controlPlane.getContext(),
      };
    }),

  /**
   * Start RX stream
   */
  startStream: protectedProcedure.mutation(async () => {
    const controlPlane = getProductionControlPlane();
    await controlPlane.startStream();
    return { success: true, context: controlPlane.getContext() };
  }),

  /**
   * Stop RX stream
   */
  stopStream: protectedProcedure.mutation(async () => {
    const controlPlane = getProductionControlPlane();
    await controlPlane.stopStream();
    return { success: true, context: controlPlane.getContext() };
  }),

  /**
   * Update operational policy (admin only)
   */
  updatePolicy: protectedProcedure
    .input(PolicyUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can update operational policy");
      }

      const currentPolicy = getPolicy();
      
      // Merge updates into current policy
      runtimePolicy = {
        ...currentPolicy,
        ...(input.allowedFrequencyRange && {
          allowedFrequencyRange: input.allowedFrequencyRange,
        }),
        ...(input.maxSampleRate !== undefined && {
          maxSampleRate: input.maxSampleRate,
        }),
        ...(input.maxGain !== undefined && {
          maxGain: input.maxGain,
        }),
        ...(input.txEnabled !== undefined && {
          txEnabled: input.txEnabled,
        }),
        ...(input.maxStreamDuration !== undefined && {
          maxStreamDuration: input.maxStreamDuration,
        }),
        ...(input.maxConcurrentStreams !== undefined && {
          maxConcurrentStreams: input.maxConcurrentStreams,
        }),
        ...(input.recordingEnabled !== undefined && {
          recordingEnabled: input.recordingEnabled,
        }),
        ...(input.maxRecordingDuration !== undefined && {
          maxRecordingDuration: input.maxRecordingDuration,
        }),
        ...(input.maxRecordingSize !== undefined && {
          maxRecordingSize: input.maxRecordingSize,
        }),
      };

      return { success: true, policy: runtimePolicy };
    }),

  /**
   * Reset policy to defaults
   */
  resetPolicy: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can reset operational policy");
    }

    runtimePolicy = loadPolicyFromEnv();
    return { success: true, policy: runtimePolicy };
  }),
});

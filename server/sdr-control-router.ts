/**
 * SDR Control Plane Router
 * 
 * Implements the SDR lifecycle state machine and control plane commands.
 * This is the AUTHORITATIVE source of SDR state.
 * 
 * LIFECYCLE:
 *   UNINITIALIZED → IDLE (device opened)
 *   IDLE → CONFIGURING → IDLE (config applied)
 *   IDLE → STREAMING (RX started)
 *   STREAMING → IDLE (RX stopped)
 *   ANY → UNINITIALIZED (device closed)
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { EventEmitter } from "events";
import { logger } from "./logger";
import {
  type SDRLifecycleState,
  type SDRDeviceType,
  type SDRBackend,
  type SDRRuntimeState,
  type RXConfig,
  type AuditEvent,
  type AuditEventType,
  type ConfigValidationResult,
  INITIAL_SDR_STATE,
  DEFAULT_RX_CONFIG,
  validateRXConfig,
} from "../shared/sdr-control-plane";
import { getHardwareManager } from "./hardware";

// Singleton state manager
class SDRControlPlane extends EventEmitter {
  private state: SDRRuntimeState = { ...INITIAL_SDR_STATE };
  private auditLog: AuditEvent[] = [];

  constructor() {
    super();
    logger.hardware.info("SDR Control Plane initialized", { state: this.state.lifecycle });
  }

  getState(): SDRRuntimeState {
    return { ...this.state };
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private setState(updates: Partial<SDRRuntimeState>): void {
    const previousState = this.state.lifecycle;
    this.state = {
      ...this.state,
      ...updates,
      timestamp: Date.now(),
    };
    
    if (previousState !== this.state.lifecycle) {
      logger.hardware.info("SDR lifecycle transition", {
        from: previousState,
        to: this.state.lifecycle,
      });
    }
    
    this.emit("stateChange", this.state);
  }

  private addAuditEvent(type: AuditEventType, message: string, data?: Record<string, unknown>): void {
    const event: AuditEvent = {
      type,
      timestamp: Date.now(),
      message,
      data,
    };
    this.auditLog.push(event);
    
    // Keep only last 100 events
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-100);
    }
    
    logger.hardware.info(`[AUDIT] ${type}: ${message}`, data);
    this.emit("auditEvent", event);
  }

  /**
   * Set device type (validation context only, does NOT connect)
   */
  async setDeviceType(deviceType: SDRDeviceType): Promise<void> {
    // This only sets the device type for validation context
    // It does NOT connect to hardware
    this.setState({ deviceType });
    this.addAuditEvent("device_type_set", `Device type set to ${deviceType}`, { deviceType });
  }

  /**
   * Connect to device (UNINITIALIZED → IDLE)
   */
  async connectDevice(params: { deviceType: SDRDeviceType; serial?: string }): Promise<void> {
    if (this.state.lifecycle !== "UNINITIALIZED" && this.state.lifecycle !== "ERROR") {
      throw new Error(`Cannot connect: current state is ${this.state.lifecycle}`);
    }

    try {
      const sdrMode = process.env.SDR_MODE || "demo";
      const backend: SDRBackend = params.deviceType === "simulator" ? "simulator" : 
                                  ["b210", "b200", "x310"].includes(params.deviceType) ? "uhd" : "soapysdr";

      // In demo mode, we simulate connection
      if (sdrMode === "demo" || params.deviceType === "simulator") {
        logger.hardware.info("Connecting in demo/simulator mode", { deviceType: params.deviceType });
        
        this.setState({
          lifecycle: "IDLE",
          deviceType: params.deviceType,
          backend: "simulator",
          serial: params.serial || "DEMO-" + Math.random().toString(36).substring(7).toUpperCase(),
          config: { ...DEFAULT_RX_CONFIG },
          lastError: null,
        });
        
        this.addAuditEvent("device_opened", `Connected to ${params.deviceType} (simulator)`, {
          deviceType: params.deviceType,
          backend: "simulator",
        });
        return;
      }

      // Production mode: attempt real hardware connection
      logger.hardware.info("Connecting to real hardware", { deviceType: params.deviceType, serial: params.serial });
      
      const hardware = getHardwareManager();
      
      // For production hardware, start() opens the device
      if ("start" in hardware && typeof hardware.start === "function") {
        await hardware.start();
      }

      this.setState({
        lifecycle: "IDLE",
        deviceType: params.deviceType,
        backend,
        serial: params.serial || "unknown",
        config: { ...DEFAULT_RX_CONFIG },
        lastError: null,
      });

      this.addAuditEvent("device_opened", `Connected to ${params.deviceType}`, {
        deviceType: params.deviceType,
        backend,
        serial: params.serial,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      this.setState({
        lifecycle: "ERROR",
        lastError: errorMessage,
      });
      this.addAuditEvent("error_occurred", `Connection failed: ${errorMessage}`, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Disconnect device (ANY → UNINITIALIZED)
   */
  async disconnectDevice(): Promise<void> {
    try {
      // Stop streaming if active
      if (this.state.lifecycle === "STREAMING") {
        await this.stopStream();
      }

      const sdrMode = process.env.SDR_MODE || "demo";
      
      // In production mode, stop hardware
      if (sdrMode === "production") {
        const hardware = getHardwareManager();
        if ("stop" in hardware && typeof hardware.stop === "function") {
          await hardware.stop();
        }
      }

      const previousDevice = this.state.deviceType;
      this.setState({ ...INITIAL_SDR_STATE });
      
      this.addAuditEvent("device_closed", `Disconnected from ${previousDevice || "device"}`, {
        previousDevice,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown disconnect error";
      logger.hardware.error("Disconnect error", { error: errorMessage });
      // Force state to uninitialized even on error
      this.setState({ ...INITIAL_SDR_STATE, lastError: errorMessage });
      this.addAuditEvent("device_closed", `Disconnected with error: ${errorMessage}`);
    }
  }

  /**
   * Apply RX configuration (IDLE → CONFIGURING → IDLE)
   */
  async setConfig(config: RXConfig): Promise<ConfigValidationResult> {
    if (this.state.lifecycle !== "IDLE") {
      throw new Error(`Cannot configure: current state is ${this.state.lifecycle}. Must be IDLE.`);
    }

    // Validate configuration
    const validation = validateRXConfig(config);
    
    if (!validation.valid) {
      this.addAuditEvent("config_rejected", `Configuration rejected: ${validation.errors.join(", ")}`, {
        config,
        errors: validation.errors,
      });
      return validation;
    }

    try {
      this.setState({ lifecycle: "CONFIGURING" });

      // Apply auto-corrections
      let finalConfig = { ...config };
      for (const correction of validation.autoCorrections) {
        (finalConfig as Record<string, unknown>)[correction.field] = correction.corrected;
      }

      // Apply to hardware
      const hardware = getHardwareManager();
      await hardware.setFrequency(finalConfig.frequency);
      await hardware.setSampleRate(finalConfig.sampleRate);
      await hardware.setGain(finalConfig.gain);

      this.setState({
        lifecycle: "IDLE",
        config: finalConfig,
      });

      this.addAuditEvent("config_applied", "Configuration applied successfully", {
        config: finalConfig,
        autoCorrections: validation.autoCorrections,
        warnings: validation.warnings,
      });

      return validation;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown config error";
      this.setState({
        lifecycle: "IDLE", // Return to IDLE, not ERROR
        lastError: errorMessage,
      });
      this.addAuditEvent("config_rejected", `Configuration failed: ${errorMessage}`, { error: errorMessage });
      
      return {
        valid: false,
        errors: [errorMessage],
        warnings: [],
        autoCorrections: [],
      };
    }
  }

  /**
   * Start RX stream (IDLE → STREAMING)
   */
  async startStream(): Promise<void> {
    if (this.state.lifecycle !== "IDLE") {
      throw new Error(`Cannot start stream: current state is ${this.state.lifecycle}. Must be IDLE.`);
    }

    if (!this.state.config) {
      throw new Error("Cannot start stream: no configuration applied");
    }

    try {
      // In demo mode, streaming is simulated via the hardware manager's FFT emission
      // In production mode, the hardware manager handles the actual streaming
      
      this.setState({ lifecycle: "STREAMING" });
      
      this.addAuditEvent("stream_started", "RX stream started", {
        config: this.state.config,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown stream error";
      this.setState({
        lifecycle: "ERROR",
        lastError: errorMessage,
      });
      this.addAuditEvent("error_occurred", `Stream start failed: ${errorMessage}`, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop RX stream (STREAMING → IDLE)
   */
  async stopStream(): Promise<void> {
    if (this.state.lifecycle !== "STREAMING") {
      logger.hardware.warn("Stop stream called but not streaming", { state: this.state.lifecycle });
      return;
    }

    try {
      this.setState({ lifecycle: "IDLE" });
      
      this.addAuditEvent("stream_stopped", "RX stream stopped");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown stop error";
      logger.hardware.error("Stop stream error", { error: errorMessage });
      // Force to IDLE even on error
      this.setState({ lifecycle: "IDLE", lastError: errorMessage });
      this.addAuditEvent("stream_stopped", `Stream stopped with error: ${errorMessage}`);
    }
  }

  /**
   * Recover from error state
   */
  async recoverFromError(): Promise<void> {
    if (this.state.lifecycle !== "ERROR") {
      return;
    }

    this.setState({ ...INITIAL_SDR_STATE });
    this.addAuditEvent("error_recovered", "Recovered from error state");
  }
}

// Singleton instance
let controlPlane: SDRControlPlane | null = null;

function getControlPlane(): SDRControlPlane {
  if (!controlPlane) {
    controlPlane = new SDRControlPlane();
  }
  return controlPlane;
}

// Zod schemas
const DeviceTypeSchema = z.enum(["b210", "b200", "x310", "simulator", "rtlsdr", "hackrf", "limesdr"]);

const RXConfigSchema = z.object({
  frequency: z.number().min(50e6).max(6e9),
  sampleRate: z.number().min(200e3).max(61.44e6),
  gain: z.number().min(0).max(76),
  bandwidth: z.number().optional(),
  antenna: z.string().optional(),
});

const ConnectDeviceSchema = z.object({
  deviceType: DeviceTypeSchema,
  serial: z.string().optional(),
});

// Router
export const sdrControlRouter = router({
  /**
   * Get current SDR runtime state
   */
  getState: publicProcedure.query(() => {
    return getControlPlane().getState();
  }),

  /**
   * Get audit log
   */
  getAuditLog: publicProcedure.query(() => {
    return getControlPlane().getAuditLog();
  }),

  /**
   * Set device type (validation context only)
   */
  setDeviceType: protectedProcedure
    .input(z.object({ deviceType: DeviceTypeSchema }))
    .mutation(async ({ input }) => {
      await getControlPlane().setDeviceType(input.deviceType);
      return { success: true };
    }),

  /**
   * Connect to device
   */
  connectDevice: protectedProcedure
    .input(ConnectDeviceSchema)
    .mutation(async ({ input }) => {
      await getControlPlane().connectDevice(input);
      return getControlPlane().getState();
    }),

  /**
   * Disconnect device
   */
  disconnectDevice: protectedProcedure
    .mutation(async () => {
      await getControlPlane().disconnectDevice();
      return getControlPlane().getState();
    }),

  /**
   * Apply RX configuration
   */
  setConfig: protectedProcedure
    .input(RXConfigSchema)
    .mutation(async ({ input }) => {
      const result = await getControlPlane().setConfig(input);
      return {
        validation: result,
        state: getControlPlane().getState(),
      };
    }),

  /**
   * Start RX stream
   */
  startStream: protectedProcedure
    .mutation(async () => {
      await getControlPlane().startStream();
      return getControlPlane().getState();
    }),

  /**
   * Stop RX stream
   */
  stopStream: protectedProcedure
    .mutation(async () => {
      await getControlPlane().stopStream();
      return getControlPlane().getState();
    }),

  /**
   * Recover from error
   */
  recoverFromError: protectedProcedure
    .mutation(async () => {
      await getControlPlane().recoverFromError();
      return getControlPlane().getState();
    }),
});

export { getControlPlane };

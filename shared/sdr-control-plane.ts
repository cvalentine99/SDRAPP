/**
 * SDR Control Plane Types and State Machine
 * 
 * Defines the authoritative SDR lifecycle states and transitions.
 * UI must RESPECT this lifecycle - it is a PURE CLIENT of the control plane.
 * 
 * LIFECYCLE:
 *   UNINITIALIZED → IDLE (device opened)
 *   IDLE → CONFIGURING → IDLE (config applied)
 *   IDLE → STREAMING (RX started)
 *   STREAMING → IDLE (RX stopped)
 *   ANY → UNINITIALIZED (device closed)
 * 
 * NON-NEGOTIABLE RULES:
 * - DO NOT auto-connect hardware
 * - DO NOT auto-start streaming
 * - DO NOT enable TX
 * - UI is a PASSIVE CLIENT
 */

/**
 * SDR Lifecycle States
 */
export type SDRLifecycleState = 
  | "UNINITIALIZED"  // No device connected
  | "IDLE"           // Device connected, configured, not streaming
  | "CONFIGURING"    // Applying configuration (transient)
  | "STREAMING"      // RX active
  | "ERROR";         // Error state, requires recovery

/**
 * Device type selection (validation context only)
 */
export type SDRDeviceType = 
  | "b210"
  | "b200"
  | "x310"
  | "simulator"
  | "rtlsdr"
  | "hackrf"
  | "limesdr";

/**
 * Backend type
 */
export type SDRBackend = "uhd" | "soapysdr" | "simulator";

/**
 * Device availability status
 */
export interface DeviceAvailability {
  deviceType: SDRDeviceType;
  detected: boolean;
  serial?: string;
  backend: SDRBackend;
}

/**
 * RX Configuration
 */
export interface RXConfig {
  frequency: number;      // Hz
  sampleRate: number;     // SPS
  gain: number;           // dB (0-76)
  bandwidth?: number;     // Hz (optional)
  antenna?: string;       // "TX/RX" | "RX2"
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: {
    field: keyof RXConfig;
    original: number;
    corrected: number;
    reason: string;
  }[];
}

/**
 * SDR Runtime State (authoritative)
 */
export interface SDRRuntimeState {
  lifecycle: SDRLifecycleState;
  deviceType: SDRDeviceType | null;
  backend: SDRBackend | null;
  serial: string | null;
  config: RXConfig | null;
  lastError: string | null;
  timestamp: number;
}

/**
 * Audit event types
 */
export type AuditEventType =
  | "device_type_set"
  | "device_opened"
  | "device_closed"
  | "config_applied"
  | "config_rejected"
  | "stream_started"
  | "stream_stopped"
  | "error_occurred"
  | "error_recovered";

/**
 * Audit event
 */
export interface AuditEvent {
  type: AuditEventType;
  timestamp: number;
  data?: Record<string, unknown>;
  message: string;
}

/**
 * Control plane commands (UI → Backend)
 */
export interface ControlPlaneCommands {
  /** Set device type (validation context only, does NOT connect) */
  setDeviceType: (deviceType: SDRDeviceType) => Promise<void>;
  
  /** Connect to device (UNINITIALIZED → IDLE) */
  connectDevice: (params: {
    deviceType: SDRDeviceType;
    serial?: string;
  }) => Promise<void>;
  
  /** Disconnect device (ANY → UNINITIALIZED) */
  disconnectDevice: () => Promise<void>;
  
  /** Apply RX configuration (IDLE → CONFIGURING → IDLE) */
  setConfig: (config: RXConfig) => Promise<ConfigValidationResult>;
  
  /** Start RX stream (IDLE → STREAMING) */
  startStream: () => Promise<void>;
  
  /** Stop RX stream (STREAMING → IDLE) */
  stopStream: () => Promise<void>;
}

/**
 * Control plane events (Backend → UI)
 */
export interface ControlPlaneEvents {
  /** State changed */
  onStateChange: (state: SDRRuntimeState) => void;
  
  /** Audit event occurred */
  onAuditEvent: (event: AuditEvent) => void;
  
  /** Error occurred */
  onError: (error: string) => void;
}

/**
 * UI state derived from SDR runtime state
 */
export interface UIControlState {
  // Button states
  connectEnabled: boolean;
  disconnectEnabled: boolean;
  configEnabled: boolean;
  applyConfigEnabled: boolean;
  startStreamEnabled: boolean;
  stopStreamEnabled: boolean;
  
  // Visual indicators
  isConnected: boolean;
  isStreaming: boolean;
  isConfiguring: boolean;
  hasError: boolean;
  
  // Status text
  statusText: string;
  statusColor: "default" | "success" | "warning" | "error";
}

/**
 * Derive UI control state from SDR runtime state
 * This is the ONLY source of truth for UI button states
 */
export function deriveUIControlState(state: SDRRuntimeState): UIControlState {
  const { lifecycle, lastError } = state;
  
  switch (lifecycle) {
    case "UNINITIALIZED":
      return {
        connectEnabled: true,
        disconnectEnabled: false,
        configEnabled: false,
        applyConfigEnabled: false,
        startStreamEnabled: false,
        stopStreamEnabled: false,
        isConnected: false,
        isStreaming: false,
        isConfiguring: false,
        hasError: false,
        statusText: "Disconnected",
        statusColor: "default",
      };
      
    case "IDLE":
      return {
        connectEnabled: false,
        disconnectEnabled: true,
        configEnabled: true,
        applyConfigEnabled: true,
        startStreamEnabled: true,
        stopStreamEnabled: false,
        isConnected: true,
        isStreaming: false,
        isConfiguring: false,
        hasError: false,
        statusText: "Connected - Ready",
        statusColor: "success",
      };
      
    case "CONFIGURING":
      return {
        connectEnabled: false,
        disconnectEnabled: false,
        configEnabled: false,
        applyConfigEnabled: false,
        startStreamEnabled: false,
        stopStreamEnabled: false,
        isConnected: true,
        isStreaming: false,
        isConfiguring: true,
        hasError: false,
        statusText: "Configuring...",
        statusColor: "warning",
      };
      
    case "STREAMING":
      return {
        connectEnabled: false,
        disconnectEnabled: true,
        configEnabled: false,
        applyConfigEnabled: false,
        startStreamEnabled: false,
        stopStreamEnabled: true,
        isConnected: true,
        isStreaming: true,
        isConfiguring: false,
        hasError: false,
        statusText: "Streaming (RX)",
        statusColor: "success",
      };
      
    case "ERROR":
      return {
        connectEnabled: true,
        disconnectEnabled: true,
        configEnabled: false,
        applyConfigEnabled: false,
        startStreamEnabled: false,
        stopStreamEnabled: false,
        isConnected: false,
        isStreaming: false,
        isConfiguring: false,
        hasError: true,
        statusText: lastError || "Error",
        statusColor: "error",
      };
      
    default:
      return {
        connectEnabled: false,
        disconnectEnabled: false,
        configEnabled: false,
        applyConfigEnabled: false,
        startStreamEnabled: false,
        stopStreamEnabled: false,
        isConnected: false,
        isStreaming: false,
        isConfiguring: false,
        hasError: true,
        statusText: "Unknown State",
        statusColor: "error",
      };
  }
}

/**
 * Initial SDR runtime state
 */
export const INITIAL_SDR_STATE: SDRRuntimeState = {
  lifecycle: "UNINITIALIZED",
  deviceType: null,
  backend: null,
  serial: null,
  config: null,
  lastError: null,
  timestamp: Date.now(),
};

/**
 * Default RX configuration
 */
export const DEFAULT_RX_CONFIG: RXConfig = {
  frequency: 915e6,      // 915 MHz
  sampleRate: 10e6,      // 10 MSPS
  gain: 50,              // 50 dB
  bandwidth: 10e6,       // 10 MHz
  antenna: "TX/RX",
};

/**
 * B210 hardware limits
 */
export const B210_LIMITS = {
  frequency: { min: 50e6, max: 6e9 },
  sampleRate: { min: 200e3, max: 61.44e6 },
  gain: { min: 0, max: 76 },
  bandwidth: { min: 200e3, max: 56e6 },
};

/**
 * Validate RX configuration against hardware limits
 */
export function validateRXConfig(config: RXConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const autoCorrections: ConfigValidationResult["autoCorrections"] = [];
  
  // Frequency validation
  if (config.frequency < B210_LIMITS.frequency.min) {
    errors.push(`Frequency ${config.frequency / 1e6} MHz below minimum ${B210_LIMITS.frequency.min / 1e6} MHz`);
  }
  if (config.frequency > B210_LIMITS.frequency.max) {
    errors.push(`Frequency ${config.frequency / 1e6} MHz above maximum ${B210_LIMITS.frequency.max / 1e6} MHz`);
  }
  
  // Sample rate validation
  if (config.sampleRate < B210_LIMITS.sampleRate.min) {
    errors.push(`Sample rate ${config.sampleRate / 1e6} MSPS below minimum ${B210_LIMITS.sampleRate.min / 1e6} MSPS`);
  }
  if (config.sampleRate > B210_LIMITS.sampleRate.max) {
    errors.push(`Sample rate ${config.sampleRate / 1e6} MSPS above maximum ${B210_LIMITS.sampleRate.max / 1e6} MSPS`);
  }
  
  // Gain validation
  if (config.gain < B210_LIMITS.gain.min) {
    autoCorrections.push({
      field: "gain",
      original: config.gain,
      corrected: B210_LIMITS.gain.min,
      reason: "Gain below minimum, auto-corrected",
    });
  }
  if (config.gain > B210_LIMITS.gain.max) {
    autoCorrections.push({
      field: "gain",
      original: config.gain,
      corrected: B210_LIMITS.gain.max,
      reason: "Gain above maximum, auto-corrected",
    });
  }
  
  // USB bandwidth warning
  if (config.sampleRate > 30e6) {
    warnings.push("Sample rate > 30 MSPS requires USB 3.0 for reliable operation");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    autoCorrections,
  };
}

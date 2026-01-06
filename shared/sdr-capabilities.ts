/**
 * SDR Hardware Capabilities and Operational Policy
 * 
 * This module implements the Capability vs Policy separation:
 * 
 * CAPABILITY: What the hardware CAN do (immutable, derived from device)
 * POLICY: What this deployment ALLOWS (immutable at runtime, from config)
 * 
 * These are NEVER modified after initialization.
 * Validation MUST check both before allowing any configuration.
 */

/**
 * Hardware Capabilities - What the device CAN do
 * Derived from SoapySDR/UHD device queries or explicit definition
 * IMMUTABLE at runtime
 */
export interface HardwareCapabilities {
  readonly deviceType: string;
  readonly backend: "uhd" | "soapysdr" | "simulator";
  
  // Frequency range (Hz)
  readonly frequencyRange: {
    readonly min: number;
    readonly max: number;
  };
  
  // Sample rate range (SPS)
  readonly sampleRateRange: {
    readonly min: number;
    readonly max: number;
  };
  
  // Gain range (dB)
  readonly gainRange: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  };
  
  // Bandwidth range (Hz)
  readonly bandwidthRange: {
    readonly min: number;
    readonly max: number;
  };
  
  // Available antennas
  readonly antennas: readonly string[];
  
  // Channel count
  readonly rxChannels: number;
  readonly txChannels: number;
  
  // TX capability (false for RX-only devices like RTL-SDR)
  readonly hasTx: boolean;
  
  // Full duplex capability
  readonly fullDuplex: boolean;
  
  // USB speed requirements
  readonly minUsbSpeed: "usb2" | "usb3" | "none";
  
  // Reference clock options
  readonly clockSources: readonly string[];
  readonly timeSources: readonly string[];
}

/**
 * Operational Policy - What this deployment ALLOWS
 * Loaded from environment or config file at startup
 * IMMUTABLE at runtime
 */
export interface OperationalPolicy {
  // Frequency restrictions (may be narrower than hardware capability)
  readonly allowedFrequencyRange: {
    readonly min: number;
    readonly max: number;
  };
  
  // Sample rate restrictions
  readonly maxSampleRate: number;
  
  // Gain restrictions
  readonly maxGain: number;
  
  // TX enabled (can be disabled even if hardware supports it)
  readonly txEnabled: boolean;
  
  // Streaming restrictions
  readonly maxStreamDuration: number; // seconds, 0 = unlimited
  readonly maxConcurrentStreams: number;
  
  // Recording restrictions
  readonly recordingEnabled: boolean;
  readonly maxRecordingDuration: number; // seconds
  readonly maxRecordingSize: number; // bytes
  
  // Operational mode
  readonly mode: "demo" | "development" | "production";
  
  // Safety limits
  readonly requireExplicitConnect: boolean;
  readonly requireExplicitStreamStart: boolean;
  readonly autoDisconnectOnIdle: number; // seconds, 0 = disabled
}

/**
 * Pre-defined hardware capabilities for known devices
 */
export const DEVICE_CAPABILITIES: Record<string, HardwareCapabilities> = {
  b210: {
    deviceType: "b210",
    backend: "uhd",
    frequencyRange: { min: 50e6, max: 6e9 },
    sampleRateRange: { min: 200e3, max: 61.44e6 },
    gainRange: { min: 0, max: 76, step: 1 },
    bandwidthRange: { min: 200e3, max: 56e6 },
    antennas: ["TX/RX", "RX2"],
    rxChannels: 2,
    txChannels: 2,
    hasTx: true,
    fullDuplex: true,
    minUsbSpeed: "usb3",
    clockSources: ["internal", "external"],
    timeSources: ["none", "external", "gpsdo"],
  },
  
  b200: {
    deviceType: "b200",
    backend: "uhd",
    frequencyRange: { min: 50e6, max: 6e9 },
    sampleRateRange: { min: 200e3, max: 61.44e6 },
    gainRange: { min: 0, max: 76, step: 1 },
    bandwidthRange: { min: 200e3, max: 56e6 },
    antennas: ["TX/RX", "RX2"],
    rxChannels: 1,
    txChannels: 1,
    hasTx: true,
    fullDuplex: true,
    minUsbSpeed: "usb3",
    clockSources: ["internal", "external"],
    timeSources: ["none", "external", "gpsdo"],
  },
  
  x310: {
    deviceType: "x310",
    backend: "uhd",
    frequencyRange: { min: 10e6, max: 6e9 },
    sampleRateRange: { min: 200e3, max: 200e6 },
    gainRange: { min: 0, max: 31.5, step: 0.5 },
    bandwidthRange: { min: 200e3, max: 160e6 },
    antennas: ["TX/RX", "RX2"],
    rxChannels: 2,
    txChannels: 2,
    hasTx: true,
    fullDuplex: true,
    minUsbSpeed: "none", // Ethernet
    clockSources: ["internal", "external", "gpsdo"],
    timeSources: ["none", "external", "gpsdo"],
  },
  
  rtlsdr: {
    deviceType: "rtlsdr",
    backend: "soapysdr",
    frequencyRange: { min: 24e6, max: 1.766e9 },
    sampleRateRange: { min: 225.001e3, max: 3.2e6 },
    gainRange: { min: 0, max: 49.6, step: 0.1 },
    bandwidthRange: { min: 0, max: 3.2e6 },
    antennas: ["RX"],
    rxChannels: 1,
    txChannels: 0,
    hasTx: false,
    fullDuplex: false,
    minUsbSpeed: "usb2",
    clockSources: ["internal"],
    timeSources: ["none"],
  },
  
  hackrf: {
    deviceType: "hackrf",
    backend: "soapysdr",
    frequencyRange: { min: 1e6, max: 6e9 },
    sampleRateRange: { min: 2e6, max: 20e6 },
    gainRange: { min: 0, max: 62, step: 1 },
    bandwidthRange: { min: 1.75e6, max: 28e6 },
    antennas: ["TX/RX"],
    rxChannels: 1,
    txChannels: 1,
    hasTx: true,
    fullDuplex: false, // Half-duplex only
    minUsbSpeed: "usb2",
    clockSources: ["internal", "external"],
    timeSources: ["none"],
  },
  
  limesdr: {
    deviceType: "limesdr",
    backend: "soapysdr",
    frequencyRange: { min: 100e3, max: 3.8e9 },
    sampleRateRange: { min: 100e3, max: 61.44e6 },
    gainRange: { min: 0, max: 73, step: 1 },
    bandwidthRange: { min: 1.4e6, max: 130e6 },
    antennas: ["LNAH", "LNAL", "LNAW"],
    rxChannels: 2,
    txChannels: 2,
    hasTx: true,
    fullDuplex: true,
    minUsbSpeed: "usb3",
    clockSources: ["internal", "external"],
    timeSources: ["none"],
  },
  
  simulator: {
    deviceType: "simulator",
    backend: "simulator",
    frequencyRange: { min: 1e6, max: 10e9 },
    sampleRateRange: { min: 1e3, max: 100e6 },
    gainRange: { min: 0, max: 100, step: 0.1 },
    bandwidthRange: { min: 1e3, max: 100e6 },
    antennas: ["SIM_RX", "SIM_TX"],
    rxChannels: 2,
    txChannels: 2,
    hasTx: true,
    fullDuplex: true,
    minUsbSpeed: "none",
    clockSources: ["internal"],
    timeSources: ["none"],
  },
};

/**
 * Default operational policy
 */
export const DEFAULT_POLICY: OperationalPolicy = {
  allowedFrequencyRange: { min: 50e6, max: 6e9 },
  maxSampleRate: 56e6,
  maxGain: 76,
  txEnabled: false, // TX disabled by default for safety
  maxStreamDuration: 0, // Unlimited
  maxConcurrentStreams: 1,
  recordingEnabled: true,
  maxRecordingDuration: 3600, // 1 hour
  maxRecordingSize: 10 * 1024 * 1024 * 1024, // 10 GB
  mode: "demo",
  requireExplicitConnect: true,
  requireExplicitStreamStart: true,
  autoDisconnectOnIdle: 0, // Disabled
};

/**
 * Load operational policy from environment
 */
export function loadPolicyFromEnv(): OperationalPolicy {
  const mode = (process.env.SDR_MODE || "demo") as "demo" | "development" | "production";
  
  return {
    allowedFrequencyRange: {
      min: parseFloat(process.env.SDR_MIN_FREQUENCY || "50000000"),
      max: parseFloat(process.env.SDR_MAX_FREQUENCY || "6000000000"),
    },
    maxSampleRate: parseFloat(process.env.SDR_MAX_SAMPLE_RATE || "56000000"),
    maxGain: parseFloat(process.env.SDR_MAX_GAIN || "76"),
    txEnabled: process.env.SDR_TX_ENABLED === "true",
    maxStreamDuration: parseInt(process.env.SDR_MAX_STREAM_DURATION || "0", 10),
    maxConcurrentStreams: parseInt(process.env.SDR_MAX_CONCURRENT_STREAMS || "1", 10),
    recordingEnabled: process.env.SDR_RECORDING_ENABLED !== "false",
    maxRecordingDuration: parseInt(process.env.SDR_MAX_RECORDING_DURATION || "3600", 10),
    maxRecordingSize: parseInt(process.env.SDR_MAX_RECORDING_SIZE || "10737418240", 10),
    mode,
    requireExplicitConnect: process.env.SDR_REQUIRE_EXPLICIT_CONNECT !== "false",
    requireExplicitStreamStart: process.env.SDR_REQUIRE_EXPLICIT_STREAM_START !== "false",
    autoDisconnectOnIdle: parseInt(process.env.SDR_AUTO_DISCONNECT_IDLE || "0", 10),
  };
}

/**
 * Get capabilities for a device type
 */
export function getDeviceCapabilities(deviceType: string): HardwareCapabilities | null {
  return DEVICE_CAPABILITIES[deviceType] || null;
}

/**
 * Validation error types
 */
export type ValidationErrorType = 
  | "CAPABILITY_VIOLATION"
  | "POLICY_VIOLATION"
  | "STATE_VIOLATION"
  | "INVALID_TRANSITION";

/**
 * Structured validation error
 */
export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  requested: number | string;
  limit: number | string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * SDR Configuration (normalized, complete, validated as a whole)
 */
export interface SDRConfig {
  frequency: number;      // Hz
  sampleRate: number;     // SPS
  gain: number;           // dB
  bandwidth: number;      // Hz
  antenna: string;
  channel: number;
}

/**
 * SDR State enum
 */
export type SDRState = "Idle" | "Configured" | "Running" | "Reconfiguring";

/**
 * Validate configuration against capability and policy
 * 
 * This is the ONLY validation function that should be used.
 * It validates the ENTIRE configuration atomically.
 * 
 * @param config - The complete configuration to validate
 * @param state - Current SDR state
 * @param capability - Hardware capabilities
 * @param policy - Operational policy
 * @returns Validation result with errors if invalid
 */
export function validateConfig(
  config: SDRConfig,
  state: SDRState,
  capability: HardwareCapabilities,
  policy: OperationalPolicy
): ConfigValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // STATE VALIDATION: Check if reconfiguration is allowed
  if (state === "Running") {
    errors.push({
      type: "STATE_VIOLATION",
      field: "state",
      message: "Cannot reconfigure while streaming. Stop stream first.",
      requested: "reconfigure",
      limit: "Idle or Configured",
    });
  }

  // CAPABILITY VALIDATION: Check hardware limits
  
  // Frequency
  if (config.frequency < capability.frequencyRange.min) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "frequency",
      message: `Frequency ${config.frequency / 1e6} MHz below device minimum ${capability.frequencyRange.min / 1e6} MHz`,
      requested: config.frequency,
      limit: capability.frequencyRange.min,
    });
  }
  if (config.frequency > capability.frequencyRange.max) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "frequency",
      message: `Frequency ${config.frequency / 1e6} MHz above device maximum ${capability.frequencyRange.max / 1e6} MHz`,
      requested: config.frequency,
      limit: capability.frequencyRange.max,
    });
  }

  // Sample Rate
  if (config.sampleRate < capability.sampleRateRange.min) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "sampleRate",
      message: `Sample rate ${config.sampleRate / 1e6} MSPS below device minimum ${capability.sampleRateRange.min / 1e6} MSPS`,
      requested: config.sampleRate,
      limit: capability.sampleRateRange.min,
    });
  }
  if (config.sampleRate > capability.sampleRateRange.max) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "sampleRate",
      message: `Sample rate ${config.sampleRate / 1e6} MSPS above device maximum ${capability.sampleRateRange.max / 1e6} MSPS`,
      requested: config.sampleRate,
      limit: capability.sampleRateRange.max,
    });
  }

  // Gain
  if (config.gain < capability.gainRange.min) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "gain",
      message: `Gain ${config.gain} dB below device minimum ${capability.gainRange.min} dB`,
      requested: config.gain,
      limit: capability.gainRange.min,
    });
  }
  if (config.gain > capability.gainRange.max) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "gain",
      message: `Gain ${config.gain} dB above device maximum ${capability.gainRange.max} dB`,
      requested: config.gain,
      limit: capability.gainRange.max,
    });
  }

  // Bandwidth
  if (config.bandwidth < capability.bandwidthRange.min) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "bandwidth",
      message: `Bandwidth ${config.bandwidth / 1e6} MHz below device minimum ${capability.bandwidthRange.min / 1e6} MHz`,
      requested: config.bandwidth,
      limit: capability.bandwidthRange.min,
    });
  }
  if (config.bandwidth > capability.bandwidthRange.max) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "bandwidth",
      message: `Bandwidth ${config.bandwidth / 1e6} MHz above device maximum ${capability.bandwidthRange.max / 1e6} MHz`,
      requested: config.bandwidth,
      limit: capability.bandwidthRange.max,
    });
  }

  // Antenna
  if (!capability.antennas.includes(config.antenna)) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "antenna",
      message: `Antenna "${config.antenna}" not available. Options: ${capability.antennas.join(", ")}`,
      requested: config.antenna,
      limit: capability.antennas.join(", "),
    });
  }

  // Channel
  if (config.channel < 0 || config.channel >= capability.rxChannels) {
    errors.push({
      type: "CAPABILITY_VIOLATION",
      field: "channel",
      message: `Channel ${config.channel} invalid. Device has ${capability.rxChannels} RX channel(s).`,
      requested: config.channel,
      limit: capability.rxChannels - 1,
    });
  }

  // POLICY VALIDATION: Check deployment restrictions

  // Frequency policy
  if (config.frequency < policy.allowedFrequencyRange.min) {
    errors.push({
      type: "POLICY_VIOLATION",
      field: "frequency",
      message: `Frequency ${config.frequency / 1e6} MHz below policy minimum ${policy.allowedFrequencyRange.min / 1e6} MHz`,
      requested: config.frequency,
      limit: policy.allowedFrequencyRange.min,
    });
  }
  if (config.frequency > policy.allowedFrequencyRange.max) {
    errors.push({
      type: "POLICY_VIOLATION",
      field: "frequency",
      message: `Frequency ${config.frequency / 1e6} MHz above policy maximum ${policy.allowedFrequencyRange.max / 1e6} MHz`,
      requested: config.frequency,
      limit: policy.allowedFrequencyRange.max,
    });
  }

  // Sample rate policy
  if (config.sampleRate > policy.maxSampleRate) {
    errors.push({
      type: "POLICY_VIOLATION",
      field: "sampleRate",
      message: `Sample rate ${config.sampleRate / 1e6} MSPS exceeds policy maximum ${policy.maxSampleRate / 1e6} MSPS`,
      requested: config.sampleRate,
      limit: policy.maxSampleRate,
    });
  }

  // Gain policy
  if (config.gain > policy.maxGain) {
    errors.push({
      type: "POLICY_VIOLATION",
      field: "gain",
      message: `Gain ${config.gain} dB exceeds policy maximum ${policy.maxGain} dB`,
      requested: config.gain,
      limit: policy.maxGain,
    });
  }

  // WARNINGS (non-blocking)
  
  // USB bandwidth warning
  if (config.sampleRate > 30e6 && capability.minUsbSpeed === "usb3") {
    warnings.push(`Sample rate > 30 MSPS requires USB 3.0 for reliable operation`);
  }

  // High gain warning
  if (config.gain > 60) {
    warnings.push(`High gain (${config.gain} dB) may cause ADC clipping with strong signals`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate state transition
 */
export function validateStateTransition(
  from: SDRState,
  to: SDRState
): { valid: boolean; error?: string } {
  // Idle → Running is NOT allowed (must configure first)
  const validTransitions: Record<SDRState, SDRState[]> = {
    Idle: ["Configured"],
    Configured: ["Idle", "Running", "Reconfiguring"],
    Running: ["Idle", "Configured"],
    Reconfiguring: ["Configured"],
  };

  if (!validTransitions[from].includes(to)) {
    return {
      valid: false,
      error: `Invalid state transition: ${from} → ${to}. Allowed: ${validTransitions[from].join(", ")}`,
    };
  }

  return { valid: true };
}

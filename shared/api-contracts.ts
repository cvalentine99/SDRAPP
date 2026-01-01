/**
 * ETTUS SDR WEB APPLICATION - API CONTRACTS
 * ==========================================
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all frontend-backend communication.
 * Both frontend and backend MUST conform to these contracts exactly.
 * 
 * Last Updated: Dec 24, 2025
 */

import { z } from "zod";

// =============================================================================
// COMMON TYPES
// =============================================================================

/** Frequency in Hz (always use Hz internally, convert to MHz only for display) */
export type FrequencyHz = number;

/** Sample rate in samples per second */
export type SampleRate = number;

/** Gain in dB */
export type GainDb = number;

/** Timestamp in milliseconds since epoch (UTC) */
export type TimestampMs = number;

// =============================================================================
// DEVICE API CONTRACT
// =============================================================================

export const DeviceInfoSchema = z.object({
  serial: z.string(),
  name: z.string(),
  product: z.string(),
  firmwareVersion: z.string(),
  fpgaVersion: z.string(),
  gpsdo: z.string().nullable(),
  usbSpeed: z.enum(["USB 2.0", "USB 3.0"]),
  freqRange: z.object({
    min: z.number(), // Hz
    max: z.number(), // Hz
  }),
  sampleRateRange: z.object({
    min: z.number(), // SPS
    max: z.number(), // SPS
  }),
});
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

export const DeviceStatusSchema = z.object({
  isRunning: z.boolean(),
  temperature: z.number(), // Celsius
  gpsLock: z.boolean(),
  pllLock: z.boolean(),
});
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const DeviceConfigSchema = z.object({
  frequency: z.number(), // Hz
  sampleRate: z.number(), // SPS
  gain: z.number(), // dB
  antenna: z.string(),
  clockSource: z.enum(["internal", "external", "gpsdo"]),
  agcEnabled: z.boolean(),
});
export type DeviceConfig = z.infer<typeof DeviceConfigSchema>;

export const SetFrequencyInputSchema = z.object({
  frequency: z.number().min(50e6).max(6e9), // 50 MHz - 6 GHz
});
export type SetFrequencyInput = z.infer<typeof SetFrequencyInputSchema>;

export const SetGainInputSchema = z.object({
  gain: z.number().min(0).max(76), // 0 - 76 dB
});
export type SetGainInput = z.infer<typeof SetGainInputSchema>;

export const SetSampleRateInputSchema = z.object({
  sampleRate: z.number().min(200e3).max(61.44e6), // 200 kSPS - 61.44 MSPS
});
export type SetSampleRateInput = z.infer<typeof SetSampleRateInputSchema>;

export const CalibrateInputSchema = z.object({
  type: z.enum(["dc_offset", "iq_balance", "full"]),
});
export type CalibrateInput = z.infer<typeof CalibrateInputSchema>;

export const CalibrateResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  calibrationData: z.object({
    dcOffsetI: z.number().optional(),
    dcOffsetQ: z.number().optional(),
    iqPhase: z.number().optional(),
    iqAmplitude: z.number().optional(),
  }).optional(),
});
export type CalibrateResult = z.infer<typeof CalibrateResultSchema>;

/** Device API Contract */
export interface DeviceAPI {
  /** Get device hardware information */
  getInfo: () => Promise<DeviceInfo>;
  
  /** Get current device operational status */
  getStatus: () => Promise<DeviceStatus>;
  
  /** Get current device configuration */
  getConfig: () => Promise<DeviceConfig>;
  
  /** Set center frequency */
  setFrequency: (input: SetFrequencyInput) => Promise<{ frequency: number }>;
  
  /** Set RX gain */
  setGain: (input: SetGainInput) => Promise<{ gain: number }>;
  
  /** Set sample rate */
  setSampleRate: (input: SetSampleRateInput) => Promise<{ sampleRate: number }>;
  
  /** Run calibration procedure */
  calibrate: (input: CalibrateInput) => Promise<CalibrateResult>;
}

// =============================================================================
// SCANNER API CONTRACT
// =============================================================================

export const ScanInputSchema = z.object({
  startFreq: z.number().min(50e6).max(6e9), // Hz
  stopFreq: z.number().min(50e6).max(6e9), // Hz
  stepSize: z.number().min(1e3).max(100e6), // Hz (1 kHz - 100 MHz)
  dwellTime: z.number().min(10).max(10000).default(100), // ms
  gain: z.number().min(0).max(76).default(50), // dB
});
export type ScanInput = z.infer<typeof ScanInputSchema>;

export const ScanResultSchema = z.object({
  frequency: z.number(), // Hz
  power: z.number(), // dBm
  timestamp: z.number(), // ms since epoch
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

export const ScanResponseSchema = z.object({
  results: z.array(ScanResultSchema),
  startTime: z.number(),
  endTime: z.number(),
  peakFrequency: z.number(),
  peakPower: z.number(),
  averagePower: z.number(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

/** Scanner API Contract */
export interface ScannerAPI {
  /** Execute frequency scan */
  scan: (input: ScanInput) => Promise<ScanResponse>;
}

// =============================================================================
// RECORDING API CONTRACT
// =============================================================================

export const RecordingSchema = z.object({
  id: z.number(),
  filename: z.string(),
  frequency: z.number(), // Hz
  sampleRate: z.number(), // SPS
  gain: z.number(), // dB
  duration: z.number(), // seconds
  fileSize: z.number(), // bytes
  s3Url: z.string().nullable(),
  createdAt: z.number(), // ms since epoch
  status: z.enum(["recording", "completed", "failed", "uploading"]),
});
export type Recording = z.infer<typeof RecordingSchema>;

export const StartRecordingInputSchema = z.object({
  duration: z.number().min(1).max(3600), // 1 second to 1 hour
  filename: z.string().optional(),
});
export type StartRecordingInput = z.infer<typeof StartRecordingInputSchema>;

export const StartRecordingResponseSchema = z.object({
  id: z.number(),
  filename: z.string(),
  estimatedSize: z.number(), // bytes
  startTime: z.number(), // ms since epoch
});
export type StartRecordingResponse = z.infer<typeof StartRecordingResponseSchema>;

export const DeleteRecordingInputSchema = z.object({
  id: z.number(),
});
export type DeleteRecordingInput = z.infer<typeof DeleteRecordingInputSchema>;

/** Recording API Contract */
export interface RecordingAPI {
  /** List all recordings */
  list: () => Promise<Recording[]>;
  
  /** Start a new recording */
  start: (input: StartRecordingInput) => Promise<StartRecordingResponse>;
  
  /** Delete a recording */
  delete: (input: DeleteRecordingInput) => Promise<{ success: boolean }>;
}

// =============================================================================
// TELEMETRY API CONTRACT
// =============================================================================

export const TelemetryMetricsSchema = z.object({
  temperature: z.number(), // Celsius
  powerConsumption: z.number(), // Watts
  usbBandwidth: z.number(), // MB/s
  bufferUsage: z.number(), // percentage 0-100
  cpuUsage: z.number(), // percentage 0-100
  gpsLock: z.boolean(),
  pllLock: z.boolean(),
  overruns: z.number(),
  underruns: z.number(),
  droppedPackets: z.number(),
});
export type TelemetryMetrics = z.infer<typeof TelemetryMetricsSchema>;

/** Telemetry API Contract */
export interface TelemetryAPI {
  /** Get current telemetry metrics */
  getMetrics: () => Promise<TelemetryMetrics>;
}

// =============================================================================
// SETTINGS API CONTRACT
// =============================================================================

export const SDRModeSchema = z.enum(["demo", "production"]);
export type SDRMode = z.infer<typeof SDRModeSchema>;

export const SettingsModeResponseSchema = z.object({
  mode: SDRModeSchema,
});
export type SettingsModeResponse = z.infer<typeof SettingsModeResponseSchema>;

export const SetModeInputSchema = z.object({
  mode: SDRModeSchema,
});
export type SetModeInput = z.infer<typeof SetModeInputSchema>;

/** Settings API Contract */
export interface SettingsAPI {
  /** Get current SDR mode */
  getMode: () => Promise<SettingsModeResponse>;
  
  /** Set SDR mode */
  setMode: (input: SetModeInput) => Promise<SettingsModeResponse>;
}

// =============================================================================
// AI ASSISTANT API CONTRACT
// =============================================================================

export const AIMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AIChatInputSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    frequency: z.number().optional(),
    sampleRate: z.number().optional(),
    gain: z.number().optional(),
  }).optional(),
});
export type AIChatInput = z.infer<typeof AIChatInputSchema>;

export const AIChatResponseSchema = z.object({
  response: z.string(),
  suggestedActions: z.array(z.string()).optional(),
});
export type AIChatResponse = z.infer<typeof AIChatResponseSchema>;

export const AIAnalyzeSpectrumResponseSchema = z.object({
  frequency: z.number(),
  sampleRate: z.number(),
  gain: z.number(),
  signalType: z.string(),
  description: z.string(),
  confidence: z.number(), // 0-1
  suggestedQuestions: z.array(z.string()),
  insights: z.array(z.object({
    type: z.enum(["info", "warning", "suggestion"]),
    message: z.string(),
  })),
});
export type AIAnalyzeSpectrumResponse = z.infer<typeof AIAnalyzeSpectrumResponseSchema>;

/** AI Assistant API Contract */
export interface AIAPI {
  /** Send chat message */
  chat: (input: AIChatInput) => Promise<AIChatResponse>;
  
  /** Analyze current spectrum */
  analyzeSpectrum: () => Promise<AIAnalyzeSpectrumResponse>;
}

// =============================================================================
// DEVICE LIST API CONTRACT
// =============================================================================

export const DetectedDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  driver: z.string(), // "uhd" | "soapy"
  serial: z.string(),
  product: z.string(),
  available: z.boolean(),
});
export type DetectedDevice = z.infer<typeof DetectedDeviceSchema>;

export const SelectedDeviceSchema = z.object({
  deviceId: z.string().nullable(),
  backend: z.enum(["uhd", "soapy"]).nullable(),
});
export type SelectedDevice = z.infer<typeof SelectedDeviceSchema>;

export const SetSelectedDeviceInputSchema = z.object({
  deviceId: z.string(),
  backend: z.enum(["uhd", "soapy"]),
});
export type SetSelectedDeviceInput = z.infer<typeof SetSelectedDeviceInputSchema>;

/** Device List API Contract */
export interface DeviceListAPI {
  /** List all detected SDR devices */
  listDevices: () => Promise<DetectedDevice[]>;
  
  /** Get currently selected device */
  getSelectedDevice: () => Promise<SelectedDevice>;
  
  /** Set selected device */
  setSelectedDevice: (input: SetSelectedDeviceInput) => Promise<SelectedDevice>;
}

// =============================================================================
// WEBSOCKET FFT STREAMING CONTRACT
// =============================================================================

export const FFTDataSchema = z.object({
  timestamp: z.number(), // ms since epoch
  centerFreq: z.number(), // Hz
  sampleRate: z.number(), // SPS
  fftSize: z.number(),
  data: z.array(z.number()), // Power values in dBm, length = fftSize
});
export type FFTData = z.infer<typeof FFTDataSchema>;

export const WebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fft"),
    payload: FFTDataSchema,
  }),
  z.object({
    type: z.literal("status"),
    payload: DeviceStatusSchema,
  }),
  z.object({
    type: z.literal("error"),
    payload: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
]);
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * WebSocket FFT Streaming Contract
 * 
 * Endpoint: ws://[host]/ws/fft
 * 
 * Messages from server:
 * - { type: "fft", payload: FFTData } - FFT data at 60 FPS
 * - { type: "status", payload: DeviceStatus } - Status updates at 1 Hz
 * - { type: "error", payload: { code, message } } - Error notifications
 * 
 * Messages from client:
 * - { type: "subscribe" } - Start receiving FFT data
 * - { type: "unsubscribe" } - Stop receiving FFT data
 */
export interface WebSocketFFTContract {
  /** Server sends FFT data at 60 FPS */
  fftData: FFTData;
  
  /** Server sends status updates at 1 Hz */
  statusUpdate: DeviceStatus;
}

// =============================================================================
// COMPLETE API CONTRACT
// =============================================================================

/** Complete API Contract for the SDR Web Application */
export interface SDRAPIContract {
  device: DeviceAPI;
  scanner: ScannerAPI;
  recording: RecordingAPI;
  telemetry: TelemetryAPI;
  settings: SettingsAPI;
  ai: AIAPI;
  deviceList: DeviceListAPI;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/** Validate frequency is within B210 range */
export function validateFrequency(freq: number): boolean {
  return freq >= 50e6 && freq <= 6e9;
}

/** Validate sample rate is within B210 range */
export function validateSampleRate(rate: number): boolean {
  return rate >= 200e3 && rate <= 61.44e6;
}

/** Validate gain is within B210 range */
export function validateGain(gain: number): boolean {
  return gain >= 0 && gain <= 76;
}

/** Format frequency for display */
export function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz} Hz`;
}

/** Format sample rate for display */
export function formatSampleRate(sps: number): string {
  if (sps >= 1e6) return `${(sps / 1e6).toFixed(2)} MSPS`;
  if (sps >= 1e3) return `${(sps / 1e3).toFixed(2)} kSPS`;
  return `${sps} SPS`;
}

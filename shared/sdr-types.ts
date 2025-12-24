/**
 * SDR-specific TypeScript types
 * Ensures type consistency for SDR operations across frontend and backend
 */

/**
 * SDR operating mode
 */
export type SDRMode = "demo" | "production";

/**
 * SDR configuration
 */
export interface SDRConfig {
  frequency: number; // Hz
  sampleRate: number; // Samples per second
  gain: number; // dB
}

/**
 * SDR hardware status
 */
export interface SDRStatus {
  temperature: number; // Celsius
  gpsLock: boolean;
  pllLock: boolean;
}

/**
 * Complete SDR state (config + status)
 */
export interface SDRState {
  config: SDRConfig;
  status: SDRStatus;
}

/**
 * FFT data point
 */
export interface FFTData {
  frequency: number; // Hz
  magnitude: number; // dB
  bins: number[];
  timestamp: number;
}

/**
 * Scan result from frequency scanner
 */
export interface ScanResult {
  frequency: number; // Hz
  power: number; // dBm
  timestamp: number;
}

/**
 * Device information
 */
export interface DeviceInfo {
  serial: string;
  model: string;
  firmwareVersion: string;
  fpgaVersion: string;
  gpsdo: string | null;
}

/**
 * Telemetry metrics
 */
export interface TelemetryMetrics {
  cpu: number; // Percentage
  memory: number; // Percentage
  temperature: number; // Celsius
  uptime: number; // Seconds
  fftRate: number; // FFT/s
}

/**
 * Signal analysis result
 */
export interface SignalAnalysis {
  frequency: number;
  sampleRate: number;
  gain: number;
  signalType: string;
  description: string;
  confidence: number;
  suggestedQuestions: string[];
  insights: string[];
  status: SDRStatus;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

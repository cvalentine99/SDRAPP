/**
 * hardware-types.ts - Shared types for hardware managers
 */

// B210 hardware limits (must match C++ constants)
export const B210_LIMITS = {
  MIN_FREQ: 50e6,      // 50 MHz
  MAX_FREQ: 6000e6,    // 6000 MHz
  MIN_RX_GAIN: 0.0,    // 0 dB
  MAX_RX_GAIN: 76.0,   // 76 dB
  MIN_TX_GAIN: 0.0,    // 0 dB
  MAX_TX_GAIN: 89.8,   // 89.8 dB
  MIN_BW: 200e3,       // 200 kHz
  MAX_BW: 56e6,        // 56 MHz
};

export interface FFTData {
  type: 'fft';
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  peakPower: number;
  peakBin: number;
  data: number[];
}

export interface StatusData {
  type: 'status';
  frames: number;
  gpsLocked: boolean;
  gpsTime: string;
  gpsServo: number;
  rxTemp: number;
  txTemp: number;
}

export type HardwareMessage = FFTData | StatusData;

export interface HardwareConfig {
  frequency: number;
  sampleRate: number;
  gain: number;
  bandwidth: number;
  fftSize: number;
  useGPSDO: boolean;
}

export interface HardwareStatus {
  type: 'status';
  frames: number;
  gpsLocked: boolean;
  gpsTime: string;
  gpsServo: number;
  rxTemp: number;
  txTemp: number;
  isRunning: boolean;
  isConnected: boolean;
  lastFFTTime: number | null;
  droppedFrames: number;
  error: string | null;
}

/**
 * Common interface for both Demo and Production hardware managers
 */
export interface IHardwareManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  updateConfig(newConfig: { freq?: number; rate?: number; gain?: number; bw?: number; fftSize?: number }): Promise<void>;
  setFrequency(freq: number): Promise<void>;
  setGain(gain: number): Promise<void>;
  setSampleRate(rate: number): Promise<void>;
  setBandwidth(bw: number): Promise<void>;
  getConfig(): HardwareConfig;
  getStatus(): HardwareStatus;
  isHardwareRunning(): boolean;
  on(event: 'fft', listener: (data: FFTData) => void): this;
  on(event: 'status', listener: (data: StatusData) => void): this;
  emit(event: 'fft', data: FFTData): boolean;
  emit(event: 'status', data: StatusData): boolean;
}

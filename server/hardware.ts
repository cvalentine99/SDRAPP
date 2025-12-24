// Simple hardware manager for SDR control
import { EventEmitter } from "events";

export interface HardwareConfig {
  frequency: number;
  sampleRate: number;
  gain: number;
}

export interface HardwareStatus {
  isRunning: boolean;
  temperature: number;
  gpsLock: boolean;
  pllLock: boolean;
}

class HardwareManager extends EventEmitter {
  constructor() {
    super();
    // Start emitting FFT data at 60 FPS in demo mode
    this.startFFTStream();
  }

  private startFFTStream() {
    setInterval(() => {
      this.emit("fft", this.generateSimulatedFFT());
    }, 1000 / 60); // 60 FPS
  }

  private generateSimulatedFFT() {
    const fftSize = 2048;
    const fftData = new Array(fftSize).fill(0).map(() => -100 + Math.random() * 20);
    
    // Add simulated signal peaks
    const peakIndices = [512, 1024, 1536];
    peakIndices.forEach(idx => {
      for (let i = -10; i <= 10; i++) {
        if (idx + i >= 0 && idx + i < fftSize) {
          fftData[idx + i] = -40 + Math.random() * 10;
        }
      }
    });

    return {
      timestamp: Date.now(),
      centerFreq: this.config.frequency,
      sampleRate: this.config.sampleRate,
      fftSize,
      fftData
    };
  }
  private config: HardwareConfig = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
  };

  private status: HardwareStatus = {
    isRunning: true,
    temperature: 45.2,
    gpsLock: true,
    pllLock: true,
  };

  getConfig(): HardwareConfig {
    return { ...this.config };
  }

  getStatus(): HardwareStatus {
    return { ...this.status };
  }

  async setFrequency(frequency: number): Promise<void> {
    this.config.frequency = frequency;
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    this.config.sampleRate = sampleRate;
  }

  async setGain(gain: number): Promise<void> {
    this.config.gain = gain;
  }
}

export const hardware = new HardwareManager();

export function getHardwareManager(): HardwareManager {
  return hardware;
}

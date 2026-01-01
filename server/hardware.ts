// Simple hardware manager for SDR control
import { EventEmitter } from "events";
import { ProductionHardwareManager } from "./production-hardware";

export interface HardwareConfig {
  frequency: number;
  sampleRate: number;
  gain: number;
  antenna: string;
  clockSource: "internal" | "external" | "gpsdo";
  agcEnabled: boolean;
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
    antenna: "TX/RX",
    clockSource: "internal",
    agcEnabled: false,
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

// Factory function to create hardware manager based on SDR_MODE environment variable
let hardwareInstance: HardwareManager | ProductionHardwareManager | null = null;

export function getHardwareManager(): HardwareManager | ProductionHardwareManager {
  if (!hardwareInstance) {
    const sdrMode = process.env.SDR_MODE || "demo";
    
    if (sdrMode === "production") {
      console.log("[HW-FACTORY] Creating PRODUCTION hardware manager for B210");
      hardwareInstance = new ProductionHardwareManager();
      // Auto-start production mode
      (hardwareInstance as ProductionHardwareManager).start().catch(err => {
        console.error("[HW-FACTORY] Failed to start production hardware:", err);
      });
    } else {
      console.log("[HW-FACTORY] Creating DEMO hardware manager (simulated data)");
      hardwareInstance = new HardwareManager();
    }
  }
  
  return hardwareInstance;
}

// Legacy export for backward compatibility
export const hardware = getHardwareManager();

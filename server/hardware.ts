// Simple hardware manager for SDR control
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

class HardwareManager {
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

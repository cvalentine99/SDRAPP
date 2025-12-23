/**
 * demo-hardware-manager.ts - DEMO MODE ONLY
 * 
 * Simulated B210 hardware for testing without physical device
 * Generates realistic FFT data, status updates, and telemetry
 */

import { EventEmitter } from 'events';
import { B210_LIMITS, FFTData, StatusData } from './hardware-types';

const logger = {
  info: (...args: any[]) => console.log('[DEMO]', ...args),
  warn: (...args: any[]) => console.warn('[DEMO]', ...args),
  error: (...args: any[]) => console.error('[DEMO]', ...args),
};

export class DemoHardwareManager extends EventEmitter {
  private isRunning = false;
  private config = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
    bandwidth: 10e6,
    fftSize: 2048,
    useGPSDO: false,
  };
  
  private status: StatusData = {
    type: 'status',
    frames: 0,
    gpsLocked: false,
    gpsTime: 'unavailable',
    gpsServo: 0,
    rxTemp: 45.2,
    txTemp: 42.8,
  };

  private fftInterval: NodeJS.Timeout | null = null;
  private statusInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    logger.info('Demo Hardware Manager initialized (SIMULATED DATA)');
  }

  /**
   * Start simulated FFT streaming
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Demo hardware already running');
      return;
    }

    logger.info('Starting demo hardware simulation', { config: this.config });
    this.isRunning = true;

    // Emit FFT data at 60 FPS
    this.fftInterval = setInterval(() => {
      const fftData = this.generateSimulatedFFT();
      this.emit('fft', fftData);
    }, 1000 / 60);

    // Emit status updates every 5 seconds
    this.statusInterval = setInterval(() => {
      this.status.frames += 300; // 60 FPS * 5 seconds
      this.status.rxTemp = 45 + Math.random() * 2;
      this.status.txTemp = 42 + Math.random() * 2;
      this.emit('status', this.status);
    }, 5000);

    logger.info('Demo hardware simulation started');
  }

  /**
   * Stop simulated streaming
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping demo hardware simulation');
    
    if (this.fftInterval) {
      clearInterval(this.fftInterval);
      this.fftInterval = null;
    }
    
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    this.isRunning = false;
    logger.info('Demo hardware simulation stopped');
  }

  /**
   * Update configuration (demo mode - instant, no hardware restart)
   */
  async updateConfig(newConfig: { freq?: number; rate?: number; gain?: number; bw?: number; fftSize?: number }): Promise<void> {
    logger.info('Updating demo configuration', newConfig);
    
    if (newConfig.freq !== undefined) this.config.frequency = newConfig.freq;
    if (newConfig.rate !== undefined) this.config.sampleRate = newConfig.rate;
    if (newConfig.gain !== undefined) this.config.gain = newConfig.gain;
    if (newConfig.bw !== undefined) this.config.bandwidth = newConfig.bw;
    if (newConfig.fftSize !== undefined) this.config.fftSize = newConfig.fftSize;
    
    this.validateConfig();
    logger.info('Demo configuration updated (no hardware restart needed)');
  }

  async setFrequency(freq: number): Promise<void> {
    if (freq < B210_LIMITS.MIN_FREQ || freq > B210_LIMITS.MAX_FREQ) {
      throw new Error(`Frequency ${freq/1e6} MHz out of range [${B210_LIMITS.MIN_FREQ/1e6}-${B210_LIMITS.MAX_FREQ/1e6} MHz]`);
    }
    await this.updateConfig({ freq });
  }

  async setGain(gain: number): Promise<void> {
    if (gain < B210_LIMITS.MIN_RX_GAIN || gain > B210_LIMITS.MAX_RX_GAIN) {
      throw new Error(`RX gain ${gain} dB out of range [${B210_LIMITS.MIN_RX_GAIN}-${B210_LIMITS.MAX_RX_GAIN} dB]`);
    }
    await this.updateConfig({ gain });
  }

  async setSampleRate(rate: number): Promise<void> {
    await this.updateConfig({ rate });
  }

  async setBandwidth(bw: number): Promise<void> {
    if (bw < B210_LIMITS.MIN_BW || bw > B210_LIMITS.MAX_BW) {
      throw new Error(`Bandwidth ${bw/1e6} MHz out of range [${B210_LIMITS.MIN_BW/1e6}-${B210_LIMITS.MAX_BW/1e6} MHz]`);
    }
    await this.updateConfig({ bw });
  }

  getConfig() {
    return { ...this.config };
  }

  getStatus() {
    return {
      ...this.status,
      isRunning: this.isRunning,
      isConnected: this.isRunning,
      lastFFTTime: Date.now(),
      droppedFrames: 0,
      error: null,
    };
  }

  isHardwareRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Generate realistic simulated FFT data
   */
  private generateSimulatedFFT(): FFTData {
    const { fftSize, frequency, sampleRate, gain } = this.config;
    const data: number[] = [];

    // Base noise floor (-100 dBm + gain effect)
    const noiseFloor = -100 + (gain / 76) * 20;

    // Generate FFT bins with noise and simulated signals
    for (let i = 0; i < fftSize; i++) {
      const freqOffset = (i / fftSize - 0.5) * sampleRate;
      const absFreq = frequency + freqOffset;
      
      // Base noise
      let power = noiseFloor + Math.random() * 5;

      // Add simulated signals at specific frequencies
      // Signal 1: Strong carrier at 915.5 MHz
      if (Math.abs(absFreq - 915.5e6) < 50e3) {
        power = Math.max(power, -40 + Math.random() * 3);
      }

      // Signal 2: Moderate signal at 916.2 MHz
      if (Math.abs(absFreq - 916.2e6) < 100e3) {
        power = Math.max(power, -60 + Math.random() * 5);
      }

      // Signal 3: Weak wideband at 914.8 MHz
      if (Math.abs(absFreq - 914.8e6) < 200e3) {
        power = Math.max(power, -75 + Math.random() * 8);
      }

      data.push(power);
    }

    // Find peak
    let peakPower = -Infinity;
    let peakBin = 0;
    for (let i = 0; i < fftSize; i++) {
      if (data[i] > peakPower) {
        peakPower = data[i];
        peakBin = i;
      }
    }

    return {
      type: 'fft',
      timestamp: Date.now(),
      centerFreq: frequency,
      sampleRate,
      fftSize,
      peakPower,
      peakBin,
      data,
    };
  }

  private validateConfig(): void {
    const { frequency, gain, bandwidth } = this.config;

    if (frequency < B210_LIMITS.MIN_FREQ || frequency > B210_LIMITS.MAX_FREQ) {
      throw new Error(`Frequency ${frequency/1e6} MHz out of B210 range [${B210_LIMITS.MIN_FREQ/1e6}-${B210_LIMITS.MAX_FREQ/1e6} MHz]`);
    }

    if (gain < B210_LIMITS.MIN_RX_GAIN || gain > B210_LIMITS.MAX_RX_GAIN) {
      throw new Error(`RX gain ${gain} dB out of B210 range [${B210_LIMITS.MIN_RX_GAIN}-${B210_LIMITS.MAX_RX_GAIN} dB]`);
    }

    if (bandwidth < B210_LIMITS.MIN_BW || bandwidth > B210_LIMITS.MAX_BW) {
      throw new Error(`Bandwidth ${bandwidth/1e6} MHz out of B210 range [${B210_LIMITS.MIN_BW/1e6}-${B210_LIMITS.MAX_BW/1e6} MHz]`);
    }
  }
}

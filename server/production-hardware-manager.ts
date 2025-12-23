/**
 * production-hardware-manager.ts - PRODUCTION MODE ONLY
 * 
 * Real B210 USRP hardware integration
 * Spawns C++ sdr_streamer daemon and parses JSON output
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { B210_LIMITS, FFTData, StatusData, HardwareConfig, HardwareStatus } from './hardware-types';

const logger = {
  info: (...args: any[]) => console.log('[PROD]', ...args),
  warn: (...args: any[]) => console.warn('[PROD]', ...args),
  error: (...args: any[]) => console.error('[PROD]', ...args),
};

export class ProductionHardwareManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRunning = false;
  private config: HardwareConfig = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
    bandwidth: 10e6,
    fftSize: 2048,
    useGPSDO: true,
  };
  
  private status: StatusData = {
    type: 'status',
    frames: 0,
    gpsLocked: false,
    gpsTime: 'unavailable',
    gpsServo: 0,
    rxTemp: 0,
    txTemp: 0,
  };

  constructor() {
    super();
    logger.info('Production Hardware Manager initialized (REAL B210)');
  }

  /**
   * Start the C++ sdr_streamer daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Hardware already running');
      return;
    }

    this.validateConfig();

    logger.info('Starting sdr_streamer daemon', { config: this.config });

    const args = [
      '--freq', this.config.frequency.toString(),
      '--rate', this.config.sampleRate.toString(),
      '--gain', this.config.gain.toString(),
      '--bw', this.config.bandwidth.toString(),
      '--fft-size', this.config.fftSize.toString(),
    ];

    if (this.config.useGPSDO) {
      args.push('--gpsdo');
    }

    this.process = spawn('./hardware/build/sdr_streamer', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => {
      this.parseHardwareOutput(data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      logger.error('sdr_streamer error:', data.toString());
    });

    this.process.on('exit', (code) => {
      logger.warn(`sdr_streamer exited with code ${code}`);
      this.isRunning = false;
      this.process = null;
    });

    this.isRunning = true;
    logger.info('sdr_streamer daemon started');
  }

  /**
   * Stop the C++ daemon
   */
  async stop(): Promise<void> {
    if (!this.process || !this.isRunning) {
      return;
    }

    logger.info('Stopping sdr_streamer daemon');
    this.process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          logger.warn('Force killing sdr_streamer');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.isRunning = false;
    this.process = null;
  }

  /**
   * Update hardware configuration and restart if running
   */
  async updateConfig(newConfig: { freq?: number; rate?: number; gain?: number; bw?: number; fftSize?: number }): Promise<void> {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    // Map input parameters to config
    if (newConfig.freq !== undefined) this.config.frequency = newConfig.freq;
    if (newConfig.rate !== undefined) this.config.sampleRate = newConfig.rate;
    if (newConfig.gain !== undefined) this.config.gain = newConfig.gain;
    if (newConfig.bw !== undefined) this.config.bandwidth = newConfig.bw;
    if (newConfig.fftSize !== undefined) this.config.fftSize = newConfig.fftSize;
    
    // Validate new config
    this.validateConfig();

    if (wasRunning) {
      await this.start();
    }

    logger.info('Hardware configuration updated', { config: this.config });
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

  getConfig(): HardwareConfig {
    return { ...this.config };
  }

  getStatus(): HardwareStatus {
    return {
      ...this.status,
      isRunning: this.isRunning,
      isConnected: this.isRunning && this.process !== null,
      lastFFTTime: Date.now(),
      droppedFrames: 0,
      error: null,
    };
  }

  isHardwareRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Parse JSON output from sdr_streamer
   */
  private parseHardwareOutput(data: string): void {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        
        if (message.type === 'fft') {
          this.emit('fft', message as FFTData);
        } else if (message.type === 'status') {
          this.status = message as StatusData;
          this.emit('status', message as StatusData);
        }
      } catch (error) {
        logger.warn('Failed to parse hardware output:', line);
      }
    }
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

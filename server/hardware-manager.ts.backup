/**
 * hardware-manager.ts - B210 USRP Hardware Manager
 * 
 * Manages C++ sdr_streamer daemon process and parses JSON output
 * Supports GPSDO time synchronization and sensor monitoring
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
// Simple logger fallback (replace with structured logger later)
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

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

export class HardwareManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRunning = false;
  private config = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
    bandwidth: 10e6,
    fftSize: 2048,
    useGPSDO: true,
  };
  
  // Hardware status
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
  }

  /**
   * Start the C++ sdr_streamer daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Hardware manager already running');
      return;
    }

    // Validate configuration against B210 limits
    this.validateConfig();

    const binPath = process.env.SDR_STREAMER_PATH || '/home/ubuntu/ettus-sdr-web/hardware/build/sdr_streamer';
    
    const args = [
      '--freq', this.config.frequency.toString(),
      '--rate', this.config.sampleRate.toString(),
      '--gain', this.config.gain.toString(),
      '--bw', this.config.bandwidth.toString(),
      '--fft-size', this.config.fftSize.toString(),
      '--gpsdo', this.config.useGPSDO.toString(),
    ];

    logger.info('Starting sdr_streamer', { binPath, args });

    this.process = spawn(binPath, args);
    this.isRunning = true;

    // Handle stdout (JSON FFT/status data)
    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const msg: HardwareMessage = JSON.parse(line);
          
          if (msg.type === 'fft') {
            this.emit('fft', msg);
          } else if (msg.type === 'status') {
            this.status = msg;
            this.emit('status', msg);
            logger.info('Hardware status update', {
              frames: msg.frames,
              gpsLocked: msg.gpsLocked,
              rxTemp: msg.rxTemp,
              txTemp: msg.txTemp,
            });
          }
        } catch (err) {
          logger.error('Failed to parse hardware output', { line, error: err });
        }
      }
    });

    // Handle stderr (diagnostic messages)
    this.process.stderr?.on('data', (data: Buffer) => {
      logger.info('sdr_streamer', { message: data.toString().trim() });
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      logger.warn('sdr_streamer exited', { code, signal });
      this.isRunning = false;
      this.process = null;
      this.emit('stopped', { code, signal });
    });

    // Handle errors
    this.process.on('error', (err) => {
      logger.error('sdr_streamer error', { error: err });
      this.isRunning = false;
      this.emit('error', err);
    });
  }

  /**
   * Stop the C++ sdr_streamer daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      logger.warn('Hardware manager not running');
      return;
    }

    logger.info('Stopping sdr_streamer');
    this.process.kill('SIGTERM');
    
    // Wait for graceful shutdown (max 5 seconds)
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
  async updateConfig(newConfig: Partial<typeof this.config>): Promise<void> {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    // Update config
    this.config = { ...this.config, ...newConfig };
    
    // Validate new config
    this.validateConfig();

    if (wasRunning) {
      await this.start();
    }

    logger.info('Hardware configuration updated', { config: this.config });
  }

  /**
   * Set center frequency
   */
  async setFrequency(freq: number): Promise<void> {
    if (freq < B210_LIMITS.MIN_FREQ || freq > B210_LIMITS.MAX_FREQ) {
      throw new Error(`Frequency ${freq/1e6} MHz out of range [${B210_LIMITS.MIN_FREQ/1e6}-${B210_LIMITS.MAX_FREQ/1e6} MHz]`);
    }
    await this.updateConfig({ frequency: freq });
  }

  /**
   * Set RX gain
   */
  async setGain(gain: number): Promise<void> {
    if (gain < B210_LIMITS.MIN_RX_GAIN || gain > B210_LIMITS.MAX_RX_GAIN) {
      throw new Error(`RX gain ${gain} dB out of range [${B210_LIMITS.MIN_RX_GAIN}-${B210_LIMITS.MAX_RX_GAIN} dB]`);
    }
    await this.updateConfig({ gain });
  }

  /**
   * Set sample rate
   */
  async setSampleRate(rate: number): Promise<void> {
    await this.updateConfig({ sampleRate: rate });
  }

  /**
   * Set bandwidth
   */
  async setBandwidth(bw: number): Promise<void> {
    if (bw < B210_LIMITS.MIN_BW || bw > B210_LIMITS.MAX_BW) {
      throw new Error(`Bandwidth ${bw/1e6} MHz out of range [${B210_LIMITS.MIN_BW/1e6}-${B210_LIMITS.MAX_BW/1e6} MHz]`);
    }
    await this.updateConfig({ bandwidth: bw });
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get current hardware status (GPSDO, temperature, etc.)
   */
  getStatus(): StatusData {
    return { ...this.status };
  }

  /**
   * Check if hardware is running
   */
  isHardwareRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Validate configuration against B210 hardware limits
   */
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

// Singleton instance
let hardwareManagerInstance: HardwareManager | null = null;

export function getHardwareManager(): HardwareManager {
  if (!hardwareManagerInstance) {
    hardwareManagerInstance = new HardwareManager();
  }
  return hardwareManagerInstance;
}

// Export singleton for backward compatibility
export const hardwareManager = getHardwareManager();

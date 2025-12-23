/**
 * Hardware Manager - Spawns and controls C++ UHD streaming daemon
 * 
 * Manages the lifecycle of the sdr_streamer process, parses JSON FFT output,
 * and broadcasts to WebSocket clients.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";

export interface FFTData {
  type?: string;
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
  fftSize: number;
  data: number[];
}

export interface HardwareConfig {
  freq: number;      // MHz
  rate: number;      // MSPS
  gain: number;      // dB
  fftSize: number;
  device?: string;
  subdev?: string;
  ant?: string;
  bw?: number;       // MHz
}

export interface HardwareStatus {
  isRunning: boolean;
  isConnected: boolean;
  error: string | null;
  lastFFTTime: number | null;
  droppedFrames: number;
}

export class HardwareManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: HardwareConfig;
  private status: HardwareStatus;
  private streamerPath: string;
  private lineBuffer: string = "";
  private simulatedInterval?: NodeJS.Timeout;

  constructor(config: HardwareConfig) {
    super();
    this.config = config;
    this.status = {
      isRunning: false,
      isConnected: false,
      error: null,
      lastFFTTime: null,
      droppedFrames: 0,
    };

    // Find sdr_streamer binary
    this.streamerPath = this.findStreamerBinary();
  }

  private findStreamerBinary(): string {
    // Check environment variable first
    if (process.env.SDR_STREAMER_PATH) {
      const envPath = process.env.SDR_STREAMER_PATH;
      if (fs.existsSync(envPath)) {
        console.log(`[HardwareManager] Using SDR_STREAMER_PATH: ${envPath}`);
        return envPath;
      } else {
        console.warn(`[HardwareManager] SDR_STREAMER_PATH set but binary not found: ${envPath}`);
      }
    }
    
    const possiblePaths = [
      path.join(__dirname, "../hardware/build/sdr_streamer"),
      path.join(__dirname, "../hardware/sdr_streamer"),
      "/usr/local/bin/sdr_streamer",
      "/usr/bin/sdr_streamer",
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[HardwareManager] Found sdr_streamer at: ${p}`);
        return p;
      }
    }

    console.warn("[HardwareManager] sdr_streamer binary not found, will use simulated mode");
    return "";
  }

  /**
   * Start hardware streaming
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error("Hardware manager already running");
    }

    if (!this.streamerPath) {
      console.warn("[HardwareManager] No sdr_streamer binary, starting in simulated mode");
      this.startSimulatedMode();
      return;
    }

    console.log("[HardwareManager] Starting sdr_streamer with config:", this.config);

    const args = [
      "--freq", this.config.freq.toString(),
      "--rate", this.config.rate.toString(),
      "--gain", this.config.gain.toString(),
      "--fft-size", this.config.fftSize.toString(),
    ];

    if (this.config.device) args.push("--device", this.config.device);
    if (this.config.subdev) args.push("--subdev", this.config.subdev);
    if (this.config.ant) args.push("--ant", this.config.ant);
    if (this.config.bw) args.push("--bw", this.config.bw.toString());

    this.process = spawn(this.streamerPath, args);

    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error("[sdr_streamer]", data.toString().trim());
    });

    this.process.on("error", (error) => {
      console.error("[HardwareManager] Process error:", error);
      this.status.error = error.message;
      this.status.isRunning = false;
      this.emit("error", error);
    });

    this.process.on("exit", (code, signal) => {
      console.log(`[HardwareManager] Process exited with code ${code}, signal ${signal}`);
      this.status.isRunning = false;
      this.status.isConnected = false;
      this.process = null;
      this.emit("exit", code, signal);
    });

    this.status.isRunning = true;
    this.status.isConnected = true;
    this.status.error = null;
  }

  /**
   * Stop hardware streaming
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log("[HardwareManager] Stopping sdr_streamer");
    
    this.process.kill("SIGTERM");
    
    // Wait for process to exit (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          console.warn("[HardwareManager] Force killing sdr_streamer");
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);

      if (this.process) {
        this.process.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });

    this.process = null;
    this.status.isRunning = false;
    this.status.isConnected = false;
  }

  /**
   * Update hardware configuration (requires restart)
   */
  async updateConfig(newConfig: Partial<HardwareConfig>): Promise<void> {
    const wasRunning = this.status.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning) {
      await this.start();
    }
  }

  /**
   * Get current status
   */
  getStatus(): HardwareStatus {
    return { ...this.status };
  }

  /**
   * Get current config
   */
  getConfig(): HardwareConfig {
    return { ...this.config };
  }

  /**
   * Handle stdout from sdr_streamer (JSON FFT data)
   */
  private handleStdout(data: string): void {
    this.lineBuffer += data;

    let newlineIndex: number;
    while ((newlineIndex = this.lineBuffer.indexOf("\n")) !== -1) {
      const line = this.lineBuffer.substring(0, newlineIndex).trim();
      this.lineBuffer = this.lineBuffer.substring(newlineIndex + 1);

      if (line.length === 0) continue;

      try {
        const fftData: FFTData = JSON.parse(line);
        
        if (fftData.type === "fft") {
          this.status.lastFFTTime = Date.now();
          this.emit("fft", fftData);
        }
      } catch (error) {
        console.error("[HardwareManager] Failed to parse JSON:", line);
      }
    }
  }

  /**
   * Simulated mode for testing without hardware
   */
  private startSimulatedMode(): void {
    console.log("[HardwareManager] Starting simulated FFT stream");
    
    this.status.isRunning = true;
    this.status.isConnected = true;
    this.status.error = null;

    const generateSimulatedFFT = (): FFTData => {
      const fftSize = this.config.fftSize;
      const data: number[] = [];

      for (let i = 0; i < fftSize; i++) {
        let value = -100 + Math.random() * 10; // Base noise floor

        // Add some signal peaks
        if (i > 300 && i < 350) value = -45 + Math.random() * 5;
        if (i > 800 && i < 900) value = -60 + Math.random() * 8;
        if (i > 1500 && i < 1550) value = -50 + Math.random() * 6;

        data.push(value);
      }

      return {
        timestamp: Date.now(),
        centerFrequency: this.config.freq,
        sampleRate: this.config.rate,
        fftSize,
        data,
      };
    };

    // Generate FFT at 60 FPS
    const interval = setInterval(() => {
      if (!this.status.isRunning) {
        clearInterval(interval);
        return;
      }

      const fftData = generateSimulatedFFT();
      this.status.lastFFTTime = Date.now();
      this.emit("fft", fftData);
    }, 1000 / 60);

    // Store interval for cleanup
    this.simulatedInterval = interval;
  }
}

// Singleton instance
let hardwareManagerInstance: HardwareManager | null = null;

export function getHardwareManager(config?: HardwareConfig): HardwareManager {
  if (!hardwareManagerInstance) {
    if (!config) {
      // Default config
      config = {
        freq: 915.0,
        rate: 10.0,
        gain: 50,
        fftSize: 2048,
        ant: "TX/RX",
      };
    }
    hardwareManagerInstance = new HardwareManager(config);
  }
  return hardwareManagerInstance;
}

export function resetHardwareManager(): void {
  if (hardwareManagerInstance) {
    hardwareManagerInstance.stop();
    hardwareManagerInstance = null;
  }
}

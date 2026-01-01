import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";

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

interface FFTData {
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  fftData: number[]; // dBm values
}

export class ProductionHardwareManager extends EventEmitter {
  private config: HardwareConfig = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
    antenna: "TX/RX",
    clockSource: "internal",
    agcEnabled: false,
  };

  private status: HardwareStatus = {
    isRunning: false,
    temperature: 0,
    gpsLock: false,
    pllLock: false,
  };

  private sdrProcess: ChildProcess | null = null;
  private isStreaming = false;

  constructor() {
    super();
    console.log("[ProductionHW] Initialized for B210 hardware");
  }

  async start(): Promise<void> {
    if (this.isStreaming) {
      console.log("[ProductionHW] Already streaming");
      return;
    }

    try {
      await this.spawnSDRStreamer();
      this.status.isRunning = true;
      console.log("[ProductionHW] Started successfully");
    } catch (error) {
      console.error("[ProductionHW] Failed to start:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.sdrProcess) {
      this.sdrProcess.kill("SIGTERM");
      this.sdrProcess = null;
    }
    this.isStreaming = false;
    this.status.isRunning = false;
    console.log("[ProductionHW] Stopped");
  }

  private async spawnSDRStreamer(): Promise<void> {
    const binPath = path.resolve(__dirname, "../hardware/bin/sdr_streamer");
    
    console.log("[ProductionHW] Spawning sdr_streamer:", binPath);
    console.log("[ProductionHW] Config:", {
      freq: this.config.frequency / 1e6,
      rate: this.config.sampleRate / 1e6,
      gain: this.config.gain
    });

    this.sdrProcess = spawn(binPath, [
      "--freq", this.config.frequency.toString(),
      "--rate", this.config.sampleRate.toString(),
      "--gain", this.config.gain.toString(),
    ]);

    this.sdrProcess.stdout?.on("data", (data: Buffer) => {
      this.parseSDROutput(data.toString());
    });

    this.sdrProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[ProductionHW] sdr_streamer stderr:", data.toString().trim());
    });

    this.sdrProcess.on("error", (error) => {
      console.error("[ProductionHW] sdr_streamer error:", error);
      this.isStreaming = false;
      this.status.isRunning = false;
    });

    this.sdrProcess.on("exit", (code, signal) => {
      console.log(`[ProductionHW] sdr_streamer exited with code ${code}, signal ${signal}`);
      this.isStreaming = false;
      this.status.isRunning = false;
      this.sdrProcess = null;
    });

    this.isStreaming = true;
  }

  private parseSDROutput(output: string): void {
    const lines = output.split("\n");
    
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);
        
        if (data.type === "fft") {
          // Emit FFT data event for WebSocket broadcasting
          const fftData: FFTData = {
            timestamp: data.timestamp || Date.now(),
            centerFreq: data.center_freq || this.config.frequency,
            sampleRate: data.sample_rate || this.config.sampleRate,
            fftSize: data.fft_size || 2048,
            fftData: data.fft_data || []
          };
          this.emit("fft", fftData);
        } else if (data.type === "status") {
          // Update hardware status from sdr_streamer
          if (data.temperature !== undefined) {
            this.status.temperature = data.temperature;
          }
          if (data.gps_lock !== undefined) {
            this.status.gpsLock = data.gps_lock;
          }
          if (data.pll_lock !== undefined) {
            this.status.pllLock = data.pll_lock;
          }
        }
      } catch (error) {
        // Not JSON, might be informational message
        if (line.includes("ERROR") || line.includes("WARNING")) {
          console.warn("[ProductionHW]", line.trim());
        }
      }
    }
  }

  getConfig(): HardwareConfig {
    return { ...this.config };
  }

  getStatus(): HardwareStatus {
    return { ...this.status };
  }

  async setFrequency(frequency: number): Promise<void> {
    this.config.frequency = frequency;
    
    // Restart sdr_streamer with new frequency
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    this.config.sampleRate = sampleRate;
    
    // Restart sdr_streamer with new sample rate
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  async setGain(gain: number): Promise<void> {
    this.config.gain = gain;
    
    // Restart sdr_streamer with new gain
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }
}

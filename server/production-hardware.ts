import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import * as net from "net";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const CONTROL_SOCKET_PATH = "/tmp/sdr_streamer.sock";
const USE_BINARY_MODE = true;  // Enable binary protocol for 70% bandwidth reduction

// ============================================================================
// Types
// ============================================================================

export interface HardwareConfig {
  frequency: number;
  sampleRate: number;
  gain: number;
  bandwidth?: number;
}

export interface HardwareStatus {
  isRunning: boolean;
  temperature: number;
  gpsLock: boolean;
  pllLock: boolean;
  frameRate: number;
}

interface FFTData {
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  fftData: number[];  // dBFS values
  peakBin?: number;
  peakPower?: number;
  gpsLocked?: boolean;
}

interface StatusData {
  frameCount: number;
  gpsLocked: boolean;
  gpsTime: string;
  gpsServo: number;
  rxTemp: number;
  txTemp: number;
}

// ============================================================================
// Binary Protocol Constants
// ============================================================================

const FFT_MAGIC = 0x46465431;    // "FFT1"
const STATUS_MAGIC = 0x53545431; // "STT1"
const FFT_HEADER_SIZE = 44;
const STATUS_FRAME_SIZE = 56;

// Control command types (must match C++ enum)
enum ControlCommandType {
  SET_FREQUENCY = 1,
  SET_SAMPLE_RATE = 2,
  SET_GAIN = 3,
  SET_BANDWIDTH = 4,
  GET_STATUS = 10,
  PING = 11,
  STOP = 255,
}

interface ControlResponse {
  success: boolean;
  actualValue: number;
  message: string;
}

// ============================================================================
// Binary Protocol Parser
// ============================================================================

class BinaryProtocolParser {
  private buffer = Buffer.alloc(0);

  feed(data: Buffer): { fft?: FFTData; status?: StatusData }[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const results: { fft?: FFTData; status?: StatusData }[] = [];

    while (this.buffer.length >= 4) {
      const magic = this.buffer.readUInt32LE(0);

      if (magic === FFT_MAGIC) {
        const fft = this.parseFFTFrame();
        if (fft) {
          results.push({ fft });
        } else {
          break; // Need more data
        }
      } else if (magic === STATUS_MAGIC) {
        const status = this.parseStatusFrame();
        if (status) {
          results.push({ status });
        } else {
          break; // Need more data
        }
      } else {
        // Unknown magic, skip one byte and try again
        console.warn("[BinaryParser] Unknown magic 0x" + magic.toString(16) + ", skipping byte");
        this.buffer = this.buffer.subarray(1);
      }
    }

    return results;
  }

  private parseFFTFrame(): FFTData | null {
    if (this.buffer.length < FFT_HEADER_SIZE) {
      return null;
    }

    const fftSize = this.buffer.readUInt16LE(32);
    const totalSize = FFT_HEADER_SIZE + fftSize * 4;

    if (this.buffer.length < totalSize) {
      return null; // Need more data
    }

    // Read header fields BEFORE consuming buffer
    const timestamp = this.buffer.readDoubleLE(8);
    const centerFreq = this.buffer.readDoubleLE(16);
    const sampleRate = this.buffer.readDoubleLE(24);
    const flags = this.buffer.readUInt16LE(34);
    const peakBin = this.buffer.readInt16LE(36);
    const peakPower = this.buffer.readFloatLE(38);

    // Parse spectrum data
    const spectrumBuffer = this.buffer.subarray(FFT_HEADER_SIZE, totalSize);
    const fftData: number[] = [];
    for (let i = 0; i < fftSize; i++) {
      fftData.push(spectrumBuffer.readFloatLE(i * 4));
    }

    // Consume the frame from buffer
    this.buffer = this.buffer.subarray(totalSize);

    return {
      timestamp,
      centerFreq,
      sampleRate,
      fftSize,
      fftData,
      peakBin,
      peakPower,
      gpsLocked: (flags & 0x0001) !== 0,
    };
  }

  private parseStatusFrame(): StatusData | null {
    if (this.buffer.length < STATUS_FRAME_SIZE) {
      return null;
    }

    // Read fields BEFORE consuming buffer
    const status: StatusData = {
      frameCount: this.buffer.readUInt32LE(4),
      rxTemp: this.buffer.readFloatLE(8),
      txTemp: this.buffer.readFloatLE(12),
      gpsLocked: this.buffer.readUInt8(16) === 1,
      gpsServo: this.buffer.readDoubleLE(20),
      gpsTime: this.buffer.toString("utf8", 28, 56).replace(/\0+$/, ""),
    };

    // Consume the frame from buffer AFTER reading
    this.buffer = this.buffer.subarray(STATUS_FRAME_SIZE);

    return status;
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }
}

// ============================================================================
// Control Socket Client
// ============================================================================

class ControlSocketClient {
  private socket: net.Socket | null = null;
  private connected = false;
  private pendingResponse: {
    resolve: (response: ControlResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(CONTROL_SOCKET_PATH);

      this.socket.on("connect", () => {
        this.connected = true;
        console.log("[ControlSocket] Connected to sdr_streamer");
        resolve();
      });

      this.socket.on("data", (data: Buffer) => {
        this.handleResponse(data);
      });

      this.socket.on("error", (err) => {
        this.connected = false;
        if (this.pendingResponse) {
          clearTimeout(this.pendingResponse.timeout);
          this.pendingResponse.reject(err);
          this.pendingResponse = null;
        }
        reject(err);
      });

      this.socket.on("close", () => {
        this.connected = false;
        console.log("[ControlSocket] Disconnected");
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.connected) {
          this.socket?.destroy();
          reject(new Error("Connection timeout"));
        }
      }, 5000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  private handleResponse(data: Buffer): void {
    if (!this.pendingResponse) return;
    if (data.length < 73) return;

    clearTimeout(this.pendingResponse.timeout);

    const response: ControlResponse = {
      success: data.readUInt8(0) === 1,
      actualValue: data.readDoubleLE(1),
      message: data.toString("utf8", 9, 73).replace(/\0+$/, ""),
    };

    this.pendingResponse.resolve(response);
    this.pendingResponse = null;
  }

  private async sendCommand(type: ControlCommandType, value: number = 0): Promise<ControlResponse> {
    if (!this.socket || !this.connected) {
      throw new Error("Control socket not connected");
    }

    return new Promise((resolve, reject) => {
      // Build command buffer (9 bytes: 1 byte type + 8 byte double)
      const cmd = Buffer.alloc(9);
      cmd.writeUInt8(type, 0);
      cmd.writeDoubleLE(value, 1);

      const timeout = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error("Command timeout"));
      }, 5000);

      this.pendingResponse = { resolve, reject, timeout };
      this.socket!.write(cmd);
    });
  }

  async setFrequency(freq: number): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.SET_FREQUENCY, freq);
  }

  async setGain(gain: number): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.SET_GAIN, gain);
  }

  async setSampleRate(rate: number): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.SET_SAMPLE_RATE, rate);
  }

  async setBandwidth(bw: number): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.SET_BANDWIDTH, bw);
  }

  async ping(): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.PING);
  }

  async stop(): Promise<ControlResponse> {
    return this.sendCommand(ControlCommandType.STOP);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================================================
// Production Hardware Manager
// ============================================================================

export class ProductionHardwareManager extends EventEmitter {
  private config: HardwareConfig = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
  };

  private status: HardwareStatus = {
    isRunning: false,
    temperature: 0,
    gpsLock: false,
    pllLock: false,
    frameRate: 0,
  };

  private sdrProcess: ChildProcess | null = null;
  private controlSocket: ControlSocketClient | null = null;
  private binaryParser = new BinaryProtocolParser();
  private isStreaming = false;
  private useBinaryMode = USE_BINARY_MODE;

  // Frame rate tracking
  private frameCount = 0;
  private frameCountStartTime = Date.now();

  constructor() {
    super();
    console.log("[ProductionHW] Initialized for B210 hardware");
    console.log("[ProductionHW] Binary mode:", this.useBinaryMode ? "enabled" : "disabled");
  }

  async start(): Promise<void> {
    if (this.isStreaming) {
      console.log("[ProductionHW] Already streaming");
      return;
    }

    try {
      await this.spawnSDRStreamer();
      this.status.isRunning = true;

      // Connect control socket after short delay to let sdr_streamer initialize
      setTimeout(async () => {
        try {
          this.controlSocket = new ControlSocketClient();
          await this.controlSocket.connect();
          console.log("[ProductionHW] Control socket connected - real-time parameter changes enabled");
        } catch (err) {
          console.warn("[ProductionHW] Control socket not available (expected in demo mode):", err);
        }
      }, 2000);

      console.log("[ProductionHW] Started successfully");
    } catch (error) {
      console.error("[ProductionHW] Failed to start:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Try graceful shutdown via control socket first
    if (this.controlSocket?.isConnected()) {
      try {
        await this.controlSocket.stop();
      } catch (err) {
        console.warn("[ProductionHW] Error sending stop command:", err);
      }
      this.controlSocket.disconnect();
      this.controlSocket = null;
    }

    if (this.sdrProcess) {
      this.sdrProcess.kill("SIGTERM");
      this.sdrProcess = null;
    }

    this.binaryParser.reset();
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
      gain: this.config.gain,
      binary: this.useBinaryMode,
    });

    const args = [
      "--freq", this.config.frequency.toString(),
      "--rate", this.config.sampleRate.toString(),
      "--gain", this.config.gain.toString(),
    ];

    if (this.useBinaryMode) {
      args.push("--binary", "true");
    }

    this.sdrProcess = spawn(binPath, args);

    this.sdrProcess.stdout?.on("data", (data: Buffer) => {
      if (this.useBinaryMode) {
        this.handleBinaryData(data);
      } else {
        this.parseSDROutput(data.toString());
      }
    });

    this.sdrProcess.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.log("[ProductionHW] sdr_streamer:", message);
      }
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

  private handleBinaryData(data: Buffer): void {
    const frames = this.binaryParser.feed(data);

    for (const frame of frames) {
      if (frame.fft) {
        // Update frame rate calculation
        this.frameCount++;
        const now = Date.now();
        const elapsed = (now - this.frameCountStartTime) / 1000;
        if (elapsed >= 1.0) {
          this.status.frameRate = this.frameCount / elapsed;
          this.frameCount = 0;
          this.frameCountStartTime = now;
        }

        // Update GPS lock status
        if (frame.fft.gpsLocked !== undefined) {
          this.status.gpsLock = frame.fft.gpsLocked;
        }

        // Emit FFT data for WebSocket broadcasting
        this.emit("fft", frame.fft);
      }

      if (frame.status) {
        this.status.temperature = frame.status.rxTemp;
        this.status.gpsLock = frame.status.gpsLocked;
        this.emit("status", frame.status);
      }
    }
  }

  private parseSDROutput(output: string): void {
    const lines = output.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.type === "fft") {
          // Update frame rate
          this.frameCount++;
          const now = Date.now();
          const elapsed = (now - this.frameCountStartTime) / 1000;
          if (elapsed >= 1.0) {
            this.status.frameRate = this.frameCount / elapsed;
            this.frameCount = 0;
            this.frameCountStartTime = now;
          }

          // Emit FFT data event for WebSocket broadcasting
          const fftData: FFTData = {
            timestamp: data.timestamp || Date.now() / 1000,
            centerFreq: data.centerFreq || this.config.frequency,
            sampleRate: data.sampleRate || this.config.sampleRate,
            fftSize: data.fftSize || 2048,
            fftData: data.data || [],
            peakBin: data.peakBin,
            peakPower: data.peakPower,
          };
          this.emit("fft", fftData);
        } else if (data.type === "status") {
          // Update hardware status from sdr_streamer
          if (data.rxTemp !== undefined) {
            this.status.temperature = data.rxTemp;
          }
          if (data.gpsLocked !== undefined) {
            this.status.gpsLock = data.gpsLocked;
          }
          this.status.pllLock = true; // Assume locked if streaming
        }
      } catch {
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

  // ============================================================================
  // Real-time parameter changes (no restart required if control socket connected)
  // ============================================================================

  async setFrequency(frequency: number): Promise<void> {
    this.config.frequency = frequency;

    // Try control socket first (no restart required)
    if (this.controlSocket?.isConnected()) {
      try {
        const response = await this.controlSocket.setFrequency(frequency);
        if (response.success) {
          console.log(`[ProductionHW] Frequency set to ${response.actualValue / 1e6} MHz (no restart)`);
          return;
        }
        console.warn(`[ProductionHW] Frequency change failed: ${response.message}`);
      } catch (err) {
        console.warn("[ProductionHW] Control socket error, falling back to restart:", err);
      }
    }

    // Fallback: restart sdr_streamer with new frequency
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    this.config.sampleRate = sampleRate;

    // Sample rate changes always require restart (buffer reallocation)
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  async setGain(gain: number): Promise<void> {
    this.config.gain = gain;

    // Try control socket first (no restart required)
    if (this.controlSocket?.isConnected()) {
      try {
        const response = await this.controlSocket.setGain(gain);
        if (response.success) {
          console.log(`[ProductionHW] Gain set to ${response.actualValue} dB (no restart)`);
          return;
        }
        console.warn(`[ProductionHW] Gain change failed: ${response.message}`);
      } catch (err) {
        console.warn("[ProductionHW] Control socket error, falling back to restart:", err);
      }
    }

    // Fallback: restart sdr_streamer with new gain
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  async setBandwidth(bandwidth: number): Promise<void> {
    this.config.bandwidth = bandwidth;

    // Try control socket first
    if (this.controlSocket?.isConnected()) {
      try {
        const response = await this.controlSocket.setBandwidth(bandwidth);
        if (response.success) {
          console.log(`[ProductionHW] Bandwidth set to ${response.actualValue / 1e6} MHz (no restart)`);
          return;
        }
        console.warn(`[ProductionHW] Bandwidth change failed: ${response.message}`);
      } catch (err) {
        console.warn("[ProductionHW] Control socket error, falling back to restart:", err);
      }
    }

    // Fallback: restart
    if (this.isStreaming) {
      await this.stop();
      await this.start();
    }
  }

  // Check if control socket is available for instant parameter changes
  hasInstantControl(): boolean {
    return this.controlSocket?.isConnected() ?? false;
  }
}

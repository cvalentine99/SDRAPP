/**
 * shared-memory-reader.ts - Node.js Shared Memory FFT Consumer
 *
 * Zero-copy reader for FFT data from C++ sdr_streamer via POSIX shared memory.
 * This provides the lowest latency data path for high-throughput FFT streaming.
 *
 * Requirements:
 * - Install: npm install shm-typed-array (for shared memory access)
 * - Or use mmap-io for memory-mapped files
 *
 * This module provides a fallback polling-based approach that works with
 * standard Node.js when native shared memory isn't available.
 */

import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

// Shared memory constants (must match C++ shared_fft_buffer.hpp)
const SHM_NAME = "/sdr_fft_buffer";
const SHM_PATH = "/dev/shm/sdr_fft_buffer";  // Linux maps shm_open to /dev/shm
const SHM_MAGIC = 0x53445246;  // "SDRF"
const SHM_VERSION = 1;

// Header sizes (must match C++ structures)
const SHARED_FFT_HEADER_SIZE = 64;
const FFT_FRAME_HEADER_SIZE = 48;
const MAX_CHANNELS = 2;

interface SharedFFTHeader {
  magic: number;
  version: number;
  ringSize: number;
  fftSize: number;
  channelCount: number;
  frameSize: number;
  writeIdx: bigint;
  readIdx: bigint;
  sampleRate: number;
  gpsLocked: boolean;
  streaming: boolean;
}

interface FFTFrameHeader {
  frameNumber: bigint;
  timestamp: number;
  centerFreq: number;
  fftSize: number;
  channelMask: number;
  flags: number;
  peakBins: number[];
  peakPowers: number[];
}

export interface FFTFrame {
  frameNumber: number;
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  channelCount: number;
  gpsLocked: boolean;
  channels: {
    spectrum: Float32Array;
    peakBin: number;
    peakPower: number;
  }[];
}

export interface SharedMemoryReaderOptions {
  pollIntervalMs?: number;  // Polling interval in milliseconds (default: 1)
  maxFramesPerPoll?: number;  // Max frames to read per poll (default: 10)
}

/**
 * SharedMemoryReader - Reads FFT data from C++ producer via shared memory
 *
 * Events:
 * - 'frame': Emitted for each FFT frame received
 * - 'error': Emitted on errors
 * - 'connected': Emitted when shared memory is successfully opened
 * - 'disconnected': Emitted when C++ producer stops
 */
export class SharedMemoryReader extends EventEmitter {
  private buffer: Buffer | null = null;
  private fd: number = -1;
  private lastReadIdx: bigint = 0n;
  private pollTimer: NodeJS.Timeout | null = null;
  private options: Required<SharedMemoryReaderOptions>;
  private header: SharedFFTHeader | null = null;
  private connected: boolean = false;

  constructor(options: SharedMemoryReaderOptions = {}) {
    super();
    this.options = {
      pollIntervalMs: options.pollIntervalMs ?? 1,
      maxFramesPerPoll: options.maxFramesPerPoll ?? 10,
    };
  }

  /**
   * Start reading from shared memory
   */
  start(): boolean {
    try {
      // Try to open shared memory file (Linux maps /dev/shm/*)
      if (!fs.existsSync(SHM_PATH)) {
        console.log(`[SharedMem] Waiting for shared memory at ${SHM_PATH}...`);
        // Start polling for shared memory to appear
        this.pollTimer = setInterval(() => this.tryConnect(), 1000);
        return false;
      }

      return this.tryConnect();
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  private tryConnect(): boolean {
    try {
      if (!fs.existsSync(SHM_PATH)) {
        return false;
      }

      // Open the shared memory file
      this.fd = fs.openSync(SHM_PATH, "r");
      const stats = fs.fstatSync(this.fd);

      // Memory-map the file using a Buffer (read-only view)
      this.buffer = Buffer.alloc(stats.size);
      fs.readSync(this.fd, this.buffer, 0, stats.size, 0);

      // Validate header
      const header = this.readHeader();
      if (!header) {
        fs.closeSync(this.fd);
        this.fd = -1;
        this.buffer = null;
        return false;
      }

      if (header.magic !== SHM_MAGIC) {
        console.error(`[SharedMem] Invalid magic: 0x${header.magic.toString(16)}`);
        fs.closeSync(this.fd);
        this.fd = -1;
        this.buffer = null;
        return false;
      }

      if (header.version !== SHM_VERSION) {
        console.error(`[SharedMem] Version mismatch: ${header.version} != ${SHM_VERSION}`);
        fs.closeSync(this.fd);
        this.fd = -1;
        this.buffer = null;
        return false;
      }

      this.header = header;
      this.lastReadIdx = header.writeIdx;  // Start from latest
      this.connected = true;

      console.log(`[SharedMem] Connected: ${header.ringSize} frames × ${header.fftSize} bins × ${header.channelCount} channels`);
      console.log(`[SharedMem] Total size: ${(stats.size / 1024).toFixed(1)} KB`);

      // Stop connection polling, start data polling
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
      this.pollTimer = setInterval(() => this.pollFrames(), this.options.pollIntervalMs);

      this.emit("connected", header);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop reading and clean up
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.fd >= 0) {
      fs.closeSync(this.fd);
      this.fd = -1;
    }

    this.buffer = null;
    this.header = null;

    if (this.connected) {
      this.connected = false;
      this.emit("disconnected");
    }
  }

  /**
   * Check if connected to shared memory
   */
  isConnected(): boolean {
    return this.connected && this.header !== null && this.header.streaming;
  }

  /**
   * Get current header info
   */
  getHeader(): SharedFFTHeader | null {
    return this.header;
  }

  private readHeader(): SharedFFTHeader | null {
    if (!this.buffer || this.buffer.length < SHARED_FFT_HEADER_SIZE) {
      return null;
    }

    // Re-read the buffer to get latest data
    if (this.fd >= 0) {
      fs.readSync(this.fd, this.buffer, 0, SHARED_FFT_HEADER_SIZE, 0);
    }

    return {
      magic: this.buffer.readUInt32LE(0),
      version: this.buffer.readUInt32LE(4),
      ringSize: this.buffer.readUInt32LE(8),
      fftSize: this.buffer.readUInt32LE(12),
      channelCount: this.buffer.readUInt32LE(16),
      frameSize: this.buffer.readUInt32LE(20),
      writeIdx: this.buffer.readBigUInt64LE(24),
      readIdx: this.buffer.readBigUInt64LE(32),
      sampleRate: this.buffer.readDoubleLE(40),
      gpsLocked: this.buffer.readUInt8(48) !== 0,
      streaming: this.buffer.readUInt8(49) !== 0,
    };
  }

  private pollFrames(): void {
    if (!this.buffer || !this.header || this.fd < 0) {
      return;
    }

    try {
      // Re-read header to get latest write index
      const header = this.readHeader();
      if (!header) return;

      this.header = header;

      // Check if streaming stopped
      if (!header.streaming) {
        console.log("[SharedMem] Producer stopped streaming");
        this.stop();
        return;
      }

      // Calculate how many new frames are available
      const writeIdx = header.writeIdx;
      let framesAvailable = Number(writeIdx - this.lastReadIdx);

      if (framesAvailable <= 0) {
        return;  // No new data
      }

      // Check for buffer overrun
      if (framesAvailable > header.ringSize) {
        console.warn(`[SharedMem] Buffer overrun: ${framesAvailable} frames behind, skipping to latest`);
        this.lastReadIdx = writeIdx - BigInt(1);
        framesAvailable = 1;
      }

      // Limit frames per poll to prevent blocking
      const framesToRead = Math.min(framesAvailable, this.options.maxFramesPerPoll);

      for (let i = 0; i < framesToRead; i++) {
        const frame = this.readFrame(this.lastReadIdx);
        if (frame) {
          this.emit("frame", frame);
        }
        this.lastReadIdx++;
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  private readFrame(idx: bigint): FFTFrame | null {
    if (!this.buffer || !this.header) return null;

    const slot = Number(idx % BigInt(this.header.ringSize));
    const frameOffset = SHARED_FFT_HEADER_SIZE + slot * this.header.frameSize;

    // Re-read the frame data from file
    const frameBuffer = Buffer.alloc(this.header.frameSize);
    fs.readSync(this.fd, frameBuffer, 0, this.header.frameSize, frameOffset);

    // Parse frame header
    const frameHeader: FFTFrameHeader = {
      frameNumber: frameBuffer.readBigUInt64LE(0),
      timestamp: frameBuffer.readDoubleLE(8),
      centerFreq: frameBuffer.readDoubleLE(16),
      fftSize: frameBuffer.readUInt32LE(24),
      channelMask: frameBuffer.readUInt16LE(28),
      flags: frameBuffer.readUInt16LE(30),
      peakBins: [
        frameBuffer.readInt16LE(32),
        frameBuffer.readInt16LE(34),
      ],
      peakPowers: [
        frameBuffer.readFloatLE(36),
        frameBuffer.readFloatLE(40),
      ],
    };

    // Parse spectrum data for each channel
    const channels: FFTFrame["channels"] = [];
    const dataOffset = FFT_FRAME_HEADER_SIZE;

    for (let ch = 0; ch < this.header.channelCount; ch++) {
      const spectrumOffset = dataOffset + ch * this.header.fftSize * 4;
      const spectrum = new Float32Array(this.header.fftSize);

      for (let i = 0; i < this.header.fftSize; i++) {
        spectrum[i] = frameBuffer.readFloatLE(spectrumOffset + i * 4);
      }

      channels.push({
        spectrum,
        peakBin: frameHeader.peakBins[ch],
        peakPower: frameHeader.peakPowers[ch],
      });
    }

    return {
      frameNumber: Number(frameHeader.frameNumber),
      timestamp: frameHeader.timestamp,
      centerFreq: frameHeader.centerFreq,
      sampleRate: this.header.sampleRate,
      fftSize: frameHeader.fftSize,
      channelCount: this.header.channelCount,
      gpsLocked: (frameHeader.flags & 0x0001) !== 0,
      channels,
    };
  }
}

/**
 * Create a SharedMemoryReader and connect it to the FFT event system
 */
export function createSharedMemorySource(
  onFrame: (frame: FFTFrame) => void,
  onError?: (error: Error) => void
): SharedMemoryReader {
  const reader = new SharedMemoryReader({
    pollIntervalMs: 1,
    maxFramesPerPoll: 5,
  });

  reader.on("frame", onFrame);

  if (onError) {
    reader.on("error", onError);
  }

  reader.on("connected", (header: SharedFFTHeader) => {
    console.log(`[SharedMem] FFT source connected: ${header.fftSize} bins, ${header.channelCount} channels`);
  });

  reader.on("disconnected", () => {
    console.log("[SharedMem] FFT source disconnected");
  });

  return reader;
}

export default SharedMemoryReader;

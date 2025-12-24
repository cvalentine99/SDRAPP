import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { getHardwareManager } from "./hardware";

interface ChannelData {
  fftData: number[];
  peakBin: number;
  peakPower: number;
}

interface FFTData {
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  fftData: number[];   // dBFS values (primary channel)
  peakBin?: number;    // FFT bin with max power
  peakPower?: number;  // Max power in dBFS
  gpsLocked?: boolean; // GPSDO lock status
  channelCount?: number;   // Number of channels (1 or 2 for B210)
  channels?: ChannelData[]; // Per-channel data (dual-channel support)
}

// Client state with backpressure tracking
interface ClientState {
  ws: WebSocket;
  bufferedAmount: number;
  droppedFrames: number;
  lastFrameTime: number;
  backpressureWarning: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Map<WebSocket, ClientState>();

// Backpressure thresholds
const BACKPRESSURE_THRESHOLD = 1024 * 1024; // 1MB buffer threshold
const BACKPRESSURE_RESUME_THRESHOLD = 512 * 1024; // 512KB to resume
const MAX_DROPPED_FRAMES_WARNING = 100;

// Stats tracking
let totalFramesSent = 0;
let totalFramesDropped = 0;
let lastStatsLog = Date.now();

export function setupWebSocket(server: HTTPServer) {
  wss = new WebSocketServer({
    server,
    path: "/ws/fft",
    // Set per-message deflate for compression
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 1, // Fast compression for real-time data
      },
      threshold: 1024, // Only compress messages > 1KB
    },
  });

  wss.on("connection", (ws: WebSocket) => {
    const clientState: ClientState = {
      ws,
      bufferedAmount: 0,
      droppedFrames: 0,
      lastFrameTime: Date.now(),
      backpressureWarning: false,
    };

    console.log("[WebSocket] Client connected, total clients:", clients.size + 1);
    clients.set(ws, clientState);

    ws.on("close", () => {
      const state = clients.get(ws);
      if (state && state.droppedFrames > 0) {
        console.log(`[WebSocket] Client disconnected (dropped ${state.droppedFrames} frames)`);
      } else {
        console.log("[WebSocket] Client disconnected");
      }
      console.log("[WebSocket] Remaining clients:", clients.size - 1);
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Client error:", error.message);
      clients.delete(ws);
    });

    // Handle ping/pong for connection health
    ws.on("pong", () => {
      const state = clients.get(ws);
      if (state) {
        state.lastFrameTime = Date.now();
      }
    });

    // Send initial connection confirmation with capabilities
    ws.send(JSON.stringify({
      type: "connected",
      timestamp: Date.now(),
      capabilities: {
        compression: true,
        backpressureHandling: true,
        maxFrameRate: 60,
      }
    }));
  });

  // Heartbeat to detect stale connections
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((state, ws) => {
      // Check for stale connections (no activity for 30 seconds)
      if (now - state.lastFrameTime > 30000) {
        console.log("[WebSocket] Terminating stale connection");
        ws.terminate();
        clients.delete(ws);
        return;
      }

      // Send ping
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });

    // Log stats periodically
    if (now - lastStatsLog > 60000) {
      logStats();
      lastStatsLog = now;
    }
  }, 10000);

  // Cleanup on server close
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  // Subscribe to hardware manager FFT events
  const hardwareManager = getHardwareManager();
  hardwareManager.on("fft", (data: FFTData) => {
    broadcastFFT(data);
  });

  console.log("[WebSocket] FFT stream server initialized on /ws/fft with backpressure handling");
}

export function broadcastFFT(data: FFTData) {
  if (clients.size === 0) return;

  const message = JSON.stringify({
    type: "fft",
    ...data
  });

  const messageSize = Buffer.byteLength(message);

  clients.forEach((state, ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Check backpressure using bufferedAmount
    const buffered = ws.bufferedAmount;
    state.bufferedAmount = buffered;

    // If buffer is too full, drop the frame
    if (buffered > BACKPRESSURE_THRESHOLD) {
      state.droppedFrames++;
      totalFramesDropped++;

      // Log warning once when entering backpressure state
      if (!state.backpressureWarning) {
        state.backpressureWarning = true;
        console.warn(`[WebSocket] Backpressure detected for client (buffer: ${(buffered / 1024).toFixed(1)}KB)`);
      }

      // Notify client about dropped frames periodically
      if (state.droppedFrames % 60 === 0) { // Every ~1 second at 60fps
        try {
          ws.send(JSON.stringify({
            type: "backpressure",
            droppedFrames: state.droppedFrames,
            bufferSize: buffered,
            timestamp: Date.now(),
          }));
        } catch (e) {
          // Ignore send errors during backpressure
        }
      }

      return;
    }

    // Resume normal operation when buffer drains
    if (state.backpressureWarning && buffered < BACKPRESSURE_RESUME_THRESHOLD) {
      state.backpressureWarning = false;
      console.log(`[WebSocket] Backpressure resolved for client (dropped ${state.droppedFrames} frames total)`);
    }

    // Send the frame
    try {
      ws.send(message);
      state.lastFrameTime = Date.now();
      totalFramesSent++;
    } catch (error) {
      console.error("[WebSocket] Send error:", error);
      state.droppedFrames++;
      totalFramesDropped++;
    }
  });
}

function logStats() {
  if (clients.size === 0) return;

  const totalDropped = Array.from(clients.values()).reduce(
    (sum, state) => sum + state.droppedFrames,
    0
  );

  console.log(`[WebSocket Stats] Clients: ${clients.size}, Frames sent: ${totalFramesSent}, Dropped: ${totalDropped}`);
}

export function getConnectedClients(): number {
  return clients.size;
}

export function getWebSocketStats() {
  const clientStats = Array.from(clients.values()).map((state) => ({
    bufferedAmount: state.bufferedAmount,
    droppedFrames: state.droppedFrames,
    backpressure: state.backpressureWarning,
    lastActivity: state.lastFrameTime,
  }));

  return {
    connectedClients: clients.size,
    totalFramesSent,
    totalFramesDropped,
    clients: clientStats,
  };
}

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

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function setupWebSocket(server: HTTPServer) {
  wss = new WebSocketServer({ 
    server,
    path: "/ws/fft"
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WebSocket] Client connected, total clients:", clients.size + 1);
    clients.add(ws);

    ws.on("close", () => {
      console.log("[WebSocket] Client disconnected, total clients:", clients.size - 1);
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Client error:", error.message);
      clients.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
  });

  // Subscribe to hardware manager FFT events
  const hardwareManager = getHardwareManager();
  hardwareManager.on("fft", (data: FFTData) => {
    broadcastFFT(data);
  });

  console.log("[WebSocket] FFT stream server initialized on /ws/fft");
}

export function broadcastFFT(data: FFTData) {
  if (clients.size === 0) return;

  const message = JSON.stringify({
    type: "fft",
    ...data
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function getConnectedClients(): number {
  return clients.size;
}

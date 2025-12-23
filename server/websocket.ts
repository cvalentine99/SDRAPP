import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface FFTData {
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
  fftSize: number;
  data: number[]; // FFT magnitude values in dB
}

let wss: WebSocketServer | null = null;

export function initializeWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WebSocket] Client connected");

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle client commands (e.g., start/stop streaming, change config)
        if (data.type === "subscribe") {
          console.log("[WebSocket] Client subscribed to FFT stream");
          // Start sending simulated data
          startSimulatedStream(ws);
        } else if (data.type === "unsubscribe") {
          console.log("[WebSocket] Client unsubscribed from FFT stream");
          stopSimulatedStream(ws);
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[WebSocket] Client disconnected");
      stopSimulatedStream(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
    });
  });

  console.log("[WebSocket] Server initialized on /api/ws");
}

// Simulated FFT data generation for testing
const streamIntervals = new Map<WebSocket, NodeJS.Timeout>();

function startSimulatedStream(ws: WebSocket) {
  // Clear any existing interval
  stopSimulatedStream(ws);

  // Generate simulated FFT data at 60 FPS
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const fftData: FFTData = generateSimulatedFFT();
      ws.send(JSON.stringify(fftData));
    } else {
      stopSimulatedStream(ws);
    }
  }, 1000 / 60); // 60 FPS

  streamIntervals.set(ws, interval);
}

function stopSimulatedStream(ws: WebSocket) {
  const interval = streamIntervals.get(ws);
  if (interval) {
    clearInterval(interval);
    streamIntervals.delete(ws);
  }
}

function generateSimulatedFFT(): FFTData {
  const fftSize = 2048;
  const data: number[] = [];

  // Generate simulated spectrum with some peaks
  for (let i = 0; i < fftSize; i++) {
    // Base noise floor around -100 dBm
    let value = -100 + Math.random() * 10;

    // Add some signal peaks
    if (i > 300 && i < 350) {
      // Strong carrier at ~915 MHz
      value = -45 + Math.random() * 5;
    } else if (i > 550 && i < 580) {
      // Medium signal
      value = -65 + Math.random() * 5;
    } else if (i > 800 && i < 820) {
      // Weak signal
      value = -80 + Math.random() * 5;
    }

    data.push(value);
  }

  return {
    timestamp: Date.now(),
    centerFrequency: 915.0, // MHz
    sampleRate: 10.0, // MSPS
    fftSize,
    data,
  };
}

// Broadcast function for sending data to all connected clients
export function broadcastFFTData(fftData: FFTData) {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(fftData));
    }
  });
}

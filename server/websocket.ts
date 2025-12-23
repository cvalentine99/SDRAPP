import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { getHardwareManager, type FFTData as HardwareFFTData } from "./hardware-manager";

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

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle client commands
        if (data.type === "subscribe") {
          subscribeClient(ws);
        } else if (data.type === "unsubscribe") {
          unsubscribeClient(ws);
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    });

    ws.on("close", () => {
      unsubscribeClient(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
    });
  });
}

// Client subscription management
const subscribedClients = new Set<WebSocket>();
let hardwareListenerAttached = false;

function subscribeClient(ws: WebSocket) {
  subscribedClients.add(ws);
  
  // Attach hardware manager listener if not already attached
  if (!hardwareListenerAttached) {
    const hwManager = getHardwareManager();
    
    hwManager.on("fft", (fftData: HardwareFFTData) => {
      broadcastFFTData(fftData);
    });
    
    hardwareListenerAttached = true;
    
    // Auto-start hardware if not running
    const status = hwManager.getStatus();
    if (!status.isRunning) {
      hwManager.start().catch((error) => {
        console.error("[WebSocket] Failed to start hardware:", error);
      });
    }
  }
}

function unsubscribeClient(ws: WebSocket) {
  subscribedClients.delete(ws);
  
  // If no more clients, optionally stop hardware
  // (commented out to keep hardware running)
  // if (subscribedClients.size === 0) {
  //   const hwManager = getHardwareManager();
  //   hwManager.stop();
  // }
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

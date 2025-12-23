import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { getHardwareManager, type FFTData as HardwareFFTData } from "./hardware-manager";
import { logger } from "./_core/logger";

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
    logger.info("WebSocket", "Client connected", { totalClients: subscribedClients.size + 1 });

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
        logger.error("WebSocket", "Error parsing message", { error: error instanceof Error ? error.message : String(error) });
      }
    });

    ws.on("close", () => {
      unsubscribeClient(ws);
      logger.info("WebSocket", "Client disconnected", { totalClients: subscribedClients.size });
    });

    ws.on("error", (error) => {
      logger.error("WebSocket", "Client error", { error: error.message });
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
        logger.error("WebSocket", "Failed to start hardware", { error: error.message });
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

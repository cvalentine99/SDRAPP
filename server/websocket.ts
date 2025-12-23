/**
 * websocket.ts - WebSocket Server for Real-time FFT Streaming
 * 
 * Broadcasts hardware-manager FFT events to connected clients
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getHardwareManager } from './hardware-manager-factory';
import { FFTData, StatusData } from './hardware-types';

export function setupWebSocket(httpServer: HTTPServer) {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/fft',
  });

  console.log('[WebSocket] FFT stream server initialized on /ws/fft');

  // Track connected clients
  const clients = new Set<WebSocket>();

  // Handle new WebSocket connections
  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] Client connected, total clients:', clients.size + 1);
    clients.add(ws);

    // Send current hardware status on connect
    const hwManager = getHardwareManager();
    const status = hwManager.getStatus();
    const config = hwManager.getConfig();
    ws.send(JSON.stringify({
      type: 'init',
      status,
      config,
    }));

    // Handle client disconnect
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected, remaining clients:', clients.size - 1);
      clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clients.delete(ws);
    });
  });

  // Subscribe to hardware-manager FFT events
  const hwManager = getHardwareManager();
  hwManager.on('fft', (fftData: FFTData) => {
    // Broadcast to all connected clients
    const message = JSON.stringify(fftData);
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[WebSocket] Failed to send FFT data to client:', error);
          clients.delete(client);
        }
      }
    });
  });

  // Subscribe to hardware-manager status events
  hwManager.on('status', (statusData: StatusData) => {
    // Broadcast status updates to all connected clients
    const message = JSON.stringify(statusData);
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[WebSocket] Failed to send status data to client:', error);
          clients.delete(client);
        }
      }
    });
  });

  // Handle WebSocket server errors
  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
  });

  return wss;
}

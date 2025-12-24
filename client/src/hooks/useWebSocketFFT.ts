import { useState, useEffect, useRef, useCallback } from "react";

interface FFTData {
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  fftData: number[];
  peakBin?: number;    // FFT bin with max power
  peakPower?: number;  // Max power in dBFS
  gpsLocked?: boolean; // GPSDO lock status
}

interface UseWebSocketFFTReturn {
  fftData: FFTData | null;
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "reconnecting";
  reconnect: () => void;
  fps: number;
  gpsLocked: boolean;
}

export function useWebSocketFFT(): UseWebSocketFFTReturn {
  const [fftData, setFFTData] = useState<FFTData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "reconnecting">("connecting");
  const [fps, setFps] = useState(0);
  const [gpsLocked, setGpsLocked] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/fft`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected to FFT stream");
        setIsConnected(true);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "fft") {
            setFFTData({
              timestamp: message.timestamp,
              centerFreq: message.centerFreq,
              sampleRate: message.sampleRate,
              fftSize: message.fftSize,
              fftData: message.fftData,
              peakBin: message.peakBin,
              peakPower: message.peakPower,
              gpsLocked: message.gpsLocked,
            });

            // Update GPS lock status
            if (message.gpsLocked !== undefined) {
              setGpsLocked(message.gpsLocked);
            }

            // Update FPS counter
            fpsCounterRef.current.count++;
            const now = Date.now();
            if (now - fpsCounterRef.current.lastTime >= 1000) {
              setFps(fpsCounterRef.current.count);
              fpsCounterRef.current.count = 0;
              fpsCounterRef.current.lastTime = now;
            }
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      ws.onclose = () => {
        console.log("[WebSocket] Disconnected from FFT stream");
        setIsConnected(false);
        setConnectionStatus("disconnected");
        wsRef.current = null;

        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        setConnectionStatus("reconnecting");
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (error) {
      console.error("[WebSocket] Connection failed:", error);
      setConnectionStatus("disconnected");
    }
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    fftData,
    isConnected,
    connectionStatus,
    reconnect,
    fps,
    gpsLocked,
  };
}

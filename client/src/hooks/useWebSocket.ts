import { useEffect, useRef, useState, useCallback } from "react";

interface FFTData {
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
  fftSize: number;
  data: number[];
}

interface UseWebSocketReturn {
  fftData: FFTData | null;
  isConnected: boolean;
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
  fftHistory: FFTData[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  isPlayingHistory: boolean;
  reconnectInterval: number;
  setReconnectInterval: (interval: number) => void;
}

const FFT_HISTORY_SIZE = 100;

export function useWebSocket(): UseWebSocketReturn {
  const [fftData, setFFTData] = useState<FFTData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fftHistory, setFFTHistory] = useState<FFTData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = live mode
  const [reconnectInterval, setReconnectInterval] = useState(3000); // Configurable
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);
  const isUnmountingRef = useRef(false);

  const connect = useCallback(() => {
    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        setError(null);

        // Re-subscribe if previously subscribed
        if (isSubscribedRef.current) {
          ws.send(JSON.stringify({ type: "subscribe" }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: FFTData = JSON.parse(event.data);
          
          // Update history buffer (circular buffer)
          setFFTHistory((prev) => {
            const newHistory = [...prev, data];
            if (newHistory.length > FFT_HISTORY_SIZE) {
              newHistory.shift(); // Remove oldest
            }
            return newHistory;
          });
          
          // Only update live data if not viewing history (use functional update to avoid stale closure)
          setHistoryIndex((currentIndex) => {
            if (currentIndex === -1) {
              setFFTData(data);
            }
            return currentIndex;
          });
        } catch (err) {
          console.error("[WebSocket] Error parsing message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Only attempt to reconnect if not unmounting
        if (!isUnmountingRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WebSocket] Attempting to reconnect...");
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[WebSocket] Connection error:", err);
      setError("Failed to establish WebSocket connection");
    }
  }, [reconnectInterval]);

  const subscribe = useCallback(() => {
    isSubscribedRef.current = true;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe" }));
    }
  }, []);

  const unsubscribe = useCallback(() => {
    isSubscribedRef.current = false;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe" }));
    }
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    connect();

    return () => {
      // Mark as unmounting to prevent reconnection
      isUnmountingRef.current = true;
      
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        // Close without triggering reconnect
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Update displayed data when history index changes
  useEffect(() => {
    if (historyIndex >= 0 && historyIndex < fftHistory.length) {
      setFFTData(fftHistory[historyIndex]);
    } else if (historyIndex === -1 && fftHistory.length > 0) {
      // Return to live mode
      setFFTData(fftHistory[fftHistory.length - 1]);
    }
  }, [historyIndex, fftHistory]);

  return {
    fftData,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    fftHistory,
    historyIndex,
    setHistoryIndex,
    isPlayingHistory: historyIndex >= 0,
    reconnectInterval,
    setReconnectInterval,
  };
}

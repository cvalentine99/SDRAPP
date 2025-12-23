import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface FFTData {
  type: 'fft';
  timestamp: number;
  centerFreq: number;
  sampleRate: number;
  fftSize: number;
  peakPower: number;
  peakBin: number;
  data: number[];
}

export interface StatusData {
  type: 'status';
  frames: number;
  gpsLocked: boolean;
  gpsTime: string;
  gpsServo: number;
  rxTemp: number;
  txTemp: number;
}

export type WebSocketMessage = FFTData | StatusData;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketFFTOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onFFTData?: (data: FFTData) => void;
  onStatusData?: (data: StatusData) => void;
  onError?: (error: Event) => void;
}

export function useWebSocketFFT(options: UseWebSocketFFTOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    onFFTData,
    onStatusData,
    onError,
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastFFTData, setLastFFTData] = useState<FFTData | null>(null);
  const [lastStatusData, setLastStatusData] = useState<StatusData | null>(null);
  const [fpsCounter, setFpsCounter] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fpsCounterRef = useRef(0);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // FPS counter (updates every second)
  useEffect(() => {
    fpsIntervalRef.current = setInterval(() => {
      setFpsCounter(fpsCounterRef.current);
      fpsCounterRef.current = 0;
    }, 1000);

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/fft`;

      console.log('[WebSocket] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        toast.success('Connected to SDR hardware', {
          description: 'Real-time FFT streaming active',
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'fft') {
            fpsCounterRef.current++;
            setLastFFTData(message);
            onFFTData?.(message);
          } else if (message.type === 'status') {
            setLastStatusData(message);
            onStatusData?.(message);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            30000 // Max 30 seconds
          );
          
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
          );
          
          setConnectionStatus('reconnecting');
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          toast.error('Connection lost', {
            description: 'Failed to reconnect after multiple attempts',
          });
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setConnectionStatus('disconnected');
    }
  }, [reconnectInterval, maxReconnectAttempts, onFFTData, onStatusData, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connectionStatus,
    lastFFTData,
    lastStatusData,
    fpsCounter,
    connect,
    disconnect,
    reconnect,
    isConnected: connectionStatus === 'connected',
  };
}

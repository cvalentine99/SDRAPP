import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "@/hooks/useWebSocket";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function WebSocketDiagnostics() {
  const { isConnected, error, fftHistory, reconnectInterval, setReconnectInterval } = useWebSocket();
  const [latency, setLatency] = useState<number | null>(null);
  const [throughput, setThroughput] = useState<number>(0);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [maxRetries, setMaxRetries] = useState(10);
  const [connectionTimeout, setConnectionTimeout] = useState(5000);

  // Calculate metrics from FFT history
  useEffect(() => {
    if (fftHistory.length >= 2) {
      const latest = fftHistory[fftHistory.length - 1];
      const previous = fftHistory[fftHistory.length - 2];
      
      if (latest && previous) {
        // Calculate latency (time between frames)
        const timeDiff = latest.timestamp - previous.timestamp;
        
        // Guard against zero/negative time differences
        if (timeDiff > 0 && isFinite(timeDiff)) {
          setLatency(timeDiff);
          
          // Calculate throughput based on JSON payload size (more accurate than assuming float64)
          const payloadSize = JSON.stringify(latest).length;
          const bytesPerSecond = (payloadSize / timeDiff) * 1000;
          
          // Guard against Infinity/NaN
          if (isFinite(bytesPerSecond)) {
            setThroughput(bytesPerSecond);
          }
        }
        
        // Track dropped frames (when history buffer overflows)
        if (fftHistory.length >= 100) {
          setDroppedFrames((prev) => prev + 1);
        }
      }
    }
  }, [fftHistory]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const handleManualReconnect = () => {
    // This would trigger a manual reconnect
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-secondary" />
          ) : (
            <WifiOff className="w-4 h-4 text-primary" />
          )}
          <span className="text-sm font-medium">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-secondary hover:box-glow-cyan"
          onClick={handleManualReconnect}
          disabled={isConnected}
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Reconnect
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/50 rounded p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <Separator className="bg-border" />

      {/* Real-time Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Latency</span>
          <span className="font-mono text-foreground">
            {latency !== null ? `${latency.toFixed(2)} ms` : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Throughput</span>
          <span className="font-mono text-foreground">
            {formatBytes(throughput)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Buffered Frames</span>
          <span className="font-mono text-foreground">
            {fftHistory.length}/100
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Dropped Frames</span>
          <span className="font-mono text-primary">{droppedFrames}</span>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Connection Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="reconnect-interval" className="text-xs text-muted-foreground">
            Reconnect Interval (ms)
          </Label>
          <Input
            id="reconnect-interval"
            type="number"
            value={reconnectInterval}
            onChange={(e) => setReconnectInterval(parseInt(e.target.value))}
            className="bg-input border-border text-sm h-8"
            min={1000}
            max={30000}
            step={1000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-retries" className="text-xs text-muted-foreground">
            Max Retry Attempts
          </Label>
          <Input
            id="max-retries"
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(parseInt(e.target.value))}
            className="bg-input border-border text-sm h-8"
            min={1}
            max={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-timeout" className="text-xs text-muted-foreground">
            Connection Timeout (ms)
          </Label>
          <Input
            id="connection-timeout"
            type="number"
            value={connectionTimeout}
            onChange={(e) => setConnectionTimeout(parseInt(e.target.value))}
            className="bg-input border-border text-sm h-8"
            min={1000}
            max={60000}
            step={1000}
          />
        </div>
      </div>

      <div className="bg-black/50 rounded p-3 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong className="text-secondary">Note:</strong> Connection settings will take effect on next reconnection attempt.
        </p>
      </div>
    </div>
  );
}

import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";

export function WebSocketStatus() {
  const { isConnected, error } = useWebSocket();
  const [lastDataTime, setLastDataTime] = useState<Date | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setLastDataTime(new Date());
      setIsReconnecting(false);
    } else if (error) {
      setIsReconnecting(true);
    }
  }, [isConnected, error]);

  const getStatusColor = () => {
    if (isConnected) return "text-secondary neon-glow-cyan";
    if (isReconnecting) return "text-yellow-500 neon-glow-yellow";
    return "text-primary neon-glow-pink";
  };

  const getStatusText = () => {
    if (isConnected) return "Connected";
    if (isReconnecting) return "Reconnecting";
    return "Disconnected";
  };

  const getStatusIcon = () => {
    if (isConnected) return <Wifi className="w-4 h-4" />;
    if (isReconnecting) return <RefreshCw className="w-4 h-4 animate-spin" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const formatTimestamp = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 1000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded border border-border bg-card/50">
      <div className={`flex items-center gap-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-xs font-medium uppercase tracking-wider">
          {getStatusText()}
        </span>
      </div>
      {isConnected && lastDataTime && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="text-xs text-muted-foreground">
            Last: {formatTimestamp(lastDataTime)}
          </div>
        </>
      )}
    </div>
  );
}

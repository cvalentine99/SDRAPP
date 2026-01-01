import { cn } from "@/lib/utils";

interface WebSocketStatusProps {
  connectionStatus: "connecting" | "connected" | "disconnected" | "reconnecting";
  fps?: number;
  onReconnect?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * WebSocket connection status indicator with optional FPS display
 * Designed for SDR applications with real-time data streaming
 */
export function WebSocketStatus({
  connectionStatus,
  fps = 0,
  onReconnect,
  className,
  compact = false,
}: WebSocketStatusProps) {
  const statusConfig = {
    connecting: {
      color: "bg-yellow-500",
      pulseColor: "bg-yellow-400",
      text: "Connecting",
      icon: "◌",
    },
    connected: {
      color: "bg-emerald-500",
      pulseColor: "bg-emerald-400",
      text: "Connected",
      icon: "●",
    },
    disconnected: {
      color: "bg-red-500",
      pulseColor: "bg-red-400",
      text: "Disconnected",
      icon: "○",
    },
    reconnecting: {
      color: "bg-amber-500",
      pulseColor: "bg-amber-400",
      text: "Reconnecting",
      icon: "◐",
    },
  };

  const config = statusConfig[connectionStatus];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-mono",
          className
        )}
        title={`WebSocket: ${config.text}${fps > 0 ? ` | ${fps} FPS` : ""}`}
      >
        <span className="relative flex h-2 w-2">
          {connectionStatus === "connected" && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                config.pulseColor
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              config.color
            )}
          />
        </span>
        {fps > 0 && (
          <span className="text-muted-foreground">{fps} FPS</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-3 py-1.5 text-sm font-mono backdrop-blur-sm",
        className
      )}
    >
      {/* Status indicator with pulse animation */}
      <span className="relative flex h-2.5 w-2.5">
        {(connectionStatus === "connected" || connectionStatus === "connecting") && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.pulseColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            config.color
          )}
        />
      </span>

      {/* Status text */}
      <span className="text-muted-foreground">{config.text}</span>

      {/* FPS counter when connected */}
      {connectionStatus === "connected" && fps > 0 && (
        <>
          <span className="text-muted-foreground/50">|</span>
          <span className="tabular-nums text-foreground">{fps}</span>
          <span className="text-muted-foreground">FPS</span>
        </>
      )}

      {/* Reconnect button when disconnected */}
      {connectionStatus === "disconnected" && onReconnect && (
        <button
          onClick={onReconnect}
          className="ml-1 rounded px-2 py-0.5 text-xs text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Minimal status dot for tight spaces (e.g., header bars)
 */
export function WebSocketStatusDot({
  connectionStatus,
  className,
}: {
  connectionStatus: "connecting" | "connected" | "disconnected" | "reconnecting";
  className?: string;
}) {
  const colors = {
    connecting: "bg-yellow-500",
    connected: "bg-emerald-500",
    disconnected: "bg-red-500",
    reconnecting: "bg-amber-500",
  };

  const labels = {
    connecting: "Connecting to FFT stream...",
    connected: "FFT stream connected",
    disconnected: "FFT stream disconnected",
    reconnecting: "Reconnecting to FFT stream...",
  };

  return (
    <span
      className={cn("relative flex h-2 w-2", className)}
      title={labels[connectionStatus]}
    >
      {connectionStatus === "connected" && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          colors[connectionStatus]
        )}
      />
    </span>
  );
}

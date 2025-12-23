import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wifi, WifiOff, Zap, Network } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

interface MetricsHistory {
  timestamp: number;
  fftRate: number;
  throughput: number;
  droppedFrames: number;
}

export default function Dashboard() {
  const [history, setHistory] = useState<MetricsHistory[]>([]);
  const maxHistoryLength = 60; // Keep 60 seconds of history

  // Fetch real telemetry metrics
  const { data: metrics } = trpc.telemetry.getMetrics.useQuery(undefined, {
    refetchInterval: 1000, // Update every second
  });

  // Update history when new metrics arrive
  useEffect(() => {
    if (metrics) {
      setHistory((prev) => {
        const newEntry: MetricsHistory = {
          timestamp: Date.now(),
          fftRate: metrics.fftRate,
          throughput: metrics.throughput,
          droppedFrames: metrics.droppedFrames,
        };
        const updated = [...prev, newEntry];
        // Keep only last 60 entries
        return updated.slice(-maxHistoryLength);
      });
    }
  }, [metrics]);

  const fftRate = metrics?.fftRate ?? 0;
  const throughput = metrics?.throughput ?? 0;
  const droppedFrames = metrics?.droppedFrames ?? 0;
  const isConnected = metrics?.isConnected ?? false;

  // Calculate min/max/avg for history
  const fftRateAvg =
    history.length > 0
      ? Math.round(
          history.reduce((sum, h) => sum + h.fftRate, 0) / history.length
        )
      : 0;
  const fftRateMax =
    history.length > 0 ? Math.max(...history.map((h) => h.fftRate)) : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold neon-glow-pink text-primary">
            Real-Time Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Live telemetry metrics from hardware manager
          </p>
        </div>
      </div>

      {/* Connection Status Banner */}
      <Card
        className={`border-2 ${
          isConnected
            ? "border-secondary bg-secondary/10"
            : "border-muted bg-muted/10"
        }`}
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Wifi className="w-6 h-6 text-secondary animate-pulse" />
              ) : (
                <WifiOff className="w-6 h-6 text-muted" />
              )}
              <div>
                <div className="font-semibold text-lg">
                  {isConnected ? "Hardware Connected" : "Hardware Disconnected"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isConnected
                    ? "Receiving FFT data from B210"
                    : "No data stream detected"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-primary">
                {fftRate} FPS
              </div>
              <div className="text-xs text-muted-foreground">Current Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FFT Rate */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="neon-glow-pink text-primary">FFT RATE</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-5xl font-mono text-primary mb-2">
                {fftRate}
              </div>
              <div className="text-xs text-muted-foreground">FPS</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-lg font-mono text-secondary">
                  {fftRateAvg}
                </div>
                <div className="text-xs text-muted-foreground">Avg</div>
              </div>
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-lg font-mono text-secondary">
                  {fftRateMax}
                </div>
                <div className="text-xs text-muted-foreground">Max</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Throughput */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="w-4 h-4 text-secondary" />
              <span className="neon-glow-cyan text-secondary">THROUGHPUT</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-5xl font-mono text-secondary mb-2">
                {throughput}
              </div>
              <div className="text-xs text-muted-foreground">KB/s</div>
            </div>
            <div className="bg-black/50 rounded p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">
                Bandwidth Usage
              </div>
              <div className="w-full bg-black/50 rounded-full h-3 border border-border">
                <div
                  className="bg-secondary h-full rounded-full box-glow-cyan transition-all duration-300"
                  style={{
                    width: `${Math.min((throughput / 500) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-right">
                {Math.round((throughput / 500) * 100)}% of 500 KB/s
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dropped Frames */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="neon-glow-pink text-primary">
                DROPPED FRAMES
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-5xl font-mono text-primary mb-2">
                {droppedFrames}
              </div>
              <div className="text-xs text-muted-foreground">frames</div>
            </div>
            <div className="bg-black/50 rounded p-3 border border-border">
              <div className="text-xs text-muted-foreground mb-1">
                Quality Status
              </div>
              <div className="text-center">
                {droppedFrames === 0 ? (
                  <div className="text-secondary font-semibold">
                    ✓ Perfect
                  </div>
                ) : droppedFrames < 10 ? (
                  <div className="text-yellow-500 font-semibold">
                    ⚠ Minor Loss
                  </div>
                ) : (
                  <div className="text-red-500 font-semibold">✗ Poor</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FFT Rate History Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="neon-glow-pink text-primary">
              FFT RATE HISTORY (60s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-48 bg-black/50 rounded border border-border p-4">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground">
              <div>60</div>
              <div>45</div>
              <div>30</div>
              <div>15</div>
              <div>0</div>
            </div>

            {/* Chart area */}
            <div className="ml-8 h-full relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-t border-border/30"
                    style={{ height: "1px" }}
                  />
                ))}
              </div>

              {/* Line chart */}
              <svg className="absolute inset-0 w-full h-full">
                {history.length > 1 && (
                  <polyline
                    points={history
                      .map((h, i) => {
                        const x = (i / (maxHistoryLength - 1)) * 100;
                        const y = 100 - (h.fftRate / 60) * 100;
                        return `${x}%,${y}%`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_8px_hsl(var(--primary))]"
                  />
                )}
              </svg>

              {/* Current value indicator */}
              {history.length > 0 && (
                <div
                  className="absolute right-0 w-2 h-2 rounded-full bg-primary box-glow-pink"
                  style={{
                    top: `${100 - (fftRate / 60) * 100}%`,
                    transform: "translate(50%, -50%)",
                  }}
                />
              )}
            </div>

            {/* X-axis label */}
            <div className="absolute bottom-0 right-0 text-xs text-muted-foreground">
              Time (seconds ago)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

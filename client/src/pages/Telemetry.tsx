import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Telemetry() {
  const { data: metrics, isLoading } = trpc.telemetry.getMetrics.useQuery(undefined, {
    refetchInterval: 1000, // Refresh every second
  });

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-primary">Loading telemetry...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* FFT Rate */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">FFT RATE</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-mono text-primary mb-2">{metrics?.temperature.toFixed(1) || "--"}</div>
                <div className="text-xs text-muted-foreground">°C</div>
                <div className="text-xs text-muted-foreground">FPS</div>
              </div>
            </CardContent>
          </Card>

          {/* Network Throughput */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <Network className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  THROUGHPUT
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-mono text-secondary mb-2">
                  {metrics?.usbBandwidth.toFixed(1) || "--"}
                </div>
                <div className="text-xs text-muted-foreground">MB/s</div>
              </div>
            </CardContent>
          </Card>

          {/* GPU Utilization */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">GPU LOAD</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-mono text-primary mb-2">45</div>
                <div className="text-xs text-muted-foreground">%</div>
              </div>
            </CardContent>
          </Card>

          {/* Dropped Frames */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs flex items-center gap-2">
                <Activity className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  DROPPED FRAMES
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-mono text-secondary mb-2">0</div>
                <div className="text-xs text-muted-foreground">frames</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* System Resources */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  SYSTEM RESOURCES
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">CPU Usage</span>
                  <span className="font-mono text-primary">32%</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-border">
                  <div
                    className="bg-primary h-full rounded-full box-glow-pink"
                    style={{ width: "32%" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Memory Usage</span>
                  <span className="font-mono text-secondary">2.4 GB / 16 GB</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-border">
                  <div
                    className="bg-secondary h-full rounded-full box-glow-cyan"
                    style={{ width: "15%" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">GPU Memory</span>
                  <span className="font-mono text-primary">1.2 GB / 8 GB</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-border">
                  <div
                    className="bg-primary h-full rounded-full box-glow-pink"
                    style={{ width: "15%" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Disk I/O</span>
                  <span className="font-mono text-secondary">45 MB/s</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-border">
                  <div
                    className="bg-secondary h-full rounded-full box-glow-cyan"
                    style={{ width: "22%" }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DSP Pipeline Metrics */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  DSP PIPELINE
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FFT Computation</span>
                  <span className="font-mono text-primary">1.2 ms</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Window Function</span>
                  <span className="font-mono text-secondary">0.3 ms</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Data Transfer</span>
                  <span className="font-mono text-primary">0.8 ms</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Latency</span>
                  <span className="font-mono text-secondary">2.3 ms</span>
                </div>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Samples Processed</span>
                  <span className="font-mono text-primary">2.5 × 10⁹</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FFTs Computed</span>
                  <span className="font-mono text-secondary">1.2 × 10⁶</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Statistics */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  NETWORK STATISTICS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">WebSocket Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse box-glow-cyan" />
                    <span className="font-mono text-secondary">CONNECTED</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Messages Sent</span>
                  <span className="font-mono text-primary">45,231</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Messages Received</span>
                  <span className="font-mono text-secondary">45,198</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Packet Loss</span>
                  <span className="font-mono text-secondary">0.07%</span>
                </div>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Average Latency</span>
                  <span className="font-mono text-primary">12 ms</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Peak Latency</span>
                  <span className="font-mono text-secondary">45 ms</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hardware Telemetry */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  HARDWARE TELEMETRY
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">USRP Temperature</span>
                  <span className="font-mono text-primary">45°C</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">FPGA Load</span>
                  <span className="font-mono text-secondary">68%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">USB Bandwidth</span>
                  <span className="font-mono text-primary">320 MB/s</span>
                </div>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Buffer Fill Level</span>
                  <span className="font-mono text-secondary">45%</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 border border-border mt-1">
                  <div
                    className="bg-secondary h-full rounded-full box-glow-cyan"
                    style={{ width: "45%" }}
                  />
                </div>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono text-primary">2h 34m 12s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

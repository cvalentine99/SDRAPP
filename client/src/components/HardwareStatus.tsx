import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, CheckCircle, Power, PowerOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function HardwareStatus() {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.device.getHardwareStatus.useQuery(
    undefined,
    { refetchInterval: 2000 } // Poll every 2 seconds
  );

  const startHardware = trpc.device.startHardware.useMutation({
    onSuccess: () => {
      toast.success("Hardware started");
      utils.device.getHardwareStatus.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to start hardware: ${error.message}`);
    },
  });

  const stopHardware = trpc.device.stopHardware.useMutation({
    onSuccess: () => {
      toast.success("Hardware stopped");
      utils.device.getHardwareStatus.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to stop hardware: ${error.message}`);
    },
  });

  if (isLoading || !status) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <Activity className="w-4 h-4" />
            HARDWARE STATUS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="neon-glow-pink text-primary">HARDWARE STATUS</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Connection:</span>
          <Badge
            variant={status.isConnected ? "default" : "destructive"}
            className="gap-1"
          >
            {status.isConnected ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        {/* Running Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Streaming:</span>
          <Badge
            variant={status.isRunning ? "default" : "secondary"}
            className="gap-1"
          >
            {status.isRunning ? (
              <>
                <Activity className="w-3 h-3" />
                Active
              </>
            ) : (
              "Stopped"
            )}
          </Badge>
        </div>

        {/* Last FFT Time */}
        {status.lastFFTTime && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last Update:</span>
            <span className="text-xs font-mono text-secondary">
              {Math.floor((Date.now() - status.lastFFTTime) / 1000)}s ago
            </span>
          </div>
        )}

        {/* Dropped Frames */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Dropped Frames:</span>
          <span className="text-xs font-mono text-primary">
            {status.droppedFrames}
          </span>
        </div>

        {/* Error Message */}
        {status.error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-xs text-destructive">{status.error}</div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2 pt-2">
          {status.isRunning ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => stopHardware.mutate()}
              disabled={stopHardware.isPending}
            >
              <PowerOff className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-primary hover:box-glow-pink"
              onClick={() => startHardware.mutate()}
              disabled={startHardware.isPending}
            >
              <Power className="w-3 h-3" />
              Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

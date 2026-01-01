import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Clock, Activity, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ScanProgressIndicatorProps {
  scanId: string | null;
  isScanning: boolean;
  startFreq: number;
  stopFreq: number;
  stepSize: number;
  dwellTime: number;
}

export function ScanProgressIndicator({
  scanId,
  isScanning,
  startFreq,
  stopFreq,
  stepSize,
  dwellTime,
}: ScanProgressIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [localStartTime, setLocalStartTime] = useState<number | null>(null);

  // Calculate total steps and estimated time
  const totalSteps = Math.floor((stopFreq - startFreq) / stepSize) + 1;
  const estimatedTotalMs = totalSteps * (dwellTime + 5); // dwellTime + overhead per step

  // Query scan status from server
  const { data: scanStatus } = trpc.scanner.getScanStatus.useQuery(
    { scanId: scanId || "" },
    {
      enabled: !!scanId && isScanning,
      refetchInterval: 500, // Poll every 500ms
    }
  );

  // Track elapsed time locally for smoother updates
  useEffect(() => {
    if (isScanning && !localStartTime) {
      setLocalStartTime(Date.now());
      setElapsedTime(0);
    } else if (!isScanning) {
      setLocalStartTime(null);
      setElapsedTime(0);
    }
  }, [isScanning, localStartTime]);

  // Update elapsed time every 100ms for smooth display
  useEffect(() => {
    if (!isScanning || !localStartTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - localStartTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isScanning, localStartTime]);

  // Calculate progress percentage
  const progress = Math.min((elapsedTime / estimatedTotalMs) * 100, 99);

  // Calculate remaining time
  const remainingMs = Math.max(estimatedTotalMs - elapsedTime, 0);

  // Format time display
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Format frequency for display
  const formatFreq = (hz: number): string => {
    return `${(hz / 1e6).toFixed(1)} MHz`;
  };

  if (!isScanning) {
    return null;
  }

  return (
    <div className="bg-card/50 border border-border rounded-lg p-4 space-y-3">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Scan Progress</span>
          <span className="text-primary font-mono">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        {/* Elapsed time */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-muted-foreground text-xs">Elapsed</div>
            <div className="font-mono text-foreground">{formatTime(elapsedTime)}</div>
          </div>
        </div>

        {/* Remaining time */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <div>
            <div className="text-muted-foreground text-xs">Remaining</div>
            <div className="font-mono text-foreground">{formatTime(remainingMs)}</div>
          </div>
        </div>

        {/* Total steps */}
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-muted-foreground text-xs">Steps</div>
            <div className="font-mono text-foreground">{totalSteps}</div>
          </div>
        </div>
      </div>

      {/* Scan range info */}
      <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-2">
        <span>Range: {formatFreq(startFreq)} → {formatFreq(stopFreq)}</span>
        <span>Step: {(stepSize / 1e6).toFixed(2)} MHz</span>
      </div>

      {/* Server status indicator */}
      {scanStatus?.active && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>Server processing...</span>
        </div>
      )}
    </div>
  );
}

export default ScanProgressIndicator;

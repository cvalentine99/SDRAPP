import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Radar,
  Play,
  StopCircle,
  Download,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Detection {
  type: string;
  frequency: number;
  power: number;
  bandwidth: number;
  timestamp: string;
}

export function Scanner() {
  const [startFreq, setStartFreq] = useState("88");
  const [stopFreq, setStopFreq] = useState("108");
  const [stepFreq, setStepFreq] = useState("0.1");
  const [sampleRate, setSampleRate] = useState("2.4");
  const [gain, setGain] = useState("40");
  const [threshold, setThreshold] = useState("-80");
  const [dwellTime, setDwellTime] = useState("0.1");
  const [pauseOnSignal, setPauseOnSignal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState("2");

  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);

  const startScan = trpc.scanner.start.useMutation({
    onSuccess: (data) => {
      setScanId(data.scanId);
      setIsScanning(true);
      setProgress(0);
      setDetections([]);
      toast.success("Scan started");
    },
    onError: (error) => {
      toast.error(`Failed to start scan: ${error.message}`);
    },
  });

  const stopScan = trpc.scanner.stop.useMutation({
    onSuccess: () => {
      setIsScanning(false);
      toast.success("Scan stopped");
    },
    onError: (error) => {
      toast.error(`Failed to stop scan: ${error.message}`);
    },
  });

  // Poll scan status
  const { data: scanStatus } = trpc.scanner.getStatus.useQuery(
    { scanId: scanId! },
    {
      enabled: isScanning && scanId !== null,
      refetchInterval: 500,
    }
  );

  useEffect(() => {
    if (scanStatus) {
      setProgress(scanStatus.progress);
      setDetections(scanStatus.detections);

      if (scanStatus.status === "complete" || scanStatus.status === "stopped") {
        setIsScanning(false);
        toast.success(`Scan ${scanStatus.status}`);
      }
    }
  }, [scanStatus]);

  const handleStartScan = () => {
    startScan.mutate({
      startFreq: parseFloat(startFreq),
      stopFreq: parseFloat(stopFreq),
      stepFreq: parseFloat(stepFreq),
      sampleRate: parseFloat(sampleRate),
      gain: parseFloat(gain),
      threshold: parseFloat(threshold),
      dwellTime: parseFloat(dwellTime),
      pauseOnSignal,
      pauseDuration: parseFloat(pauseDuration),
    });
  };

  const handleStopScan = () => {
    if (scanId) {
      stopScan.mutate({ scanId });
    }
  };

  const exportResults = () => {
    const csv = [
      "Frequency (MHz),Power (dBFS),Bandwidth (kHz),Timestamp",
      ...detections.map(
        (d) =>
          `${d.frequency.toFixed(6)},${d.power.toFixed(2)},${d.bandwidth.toFixed(1)},${d.timestamp}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Results exported");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold neon-glow-pink text-primary">
            FREQUENCY SCANNER
          </h1>
          <p className="text-sm text-muted-foreground">
            Automated spectrum sweeping with signal detection
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <Card className="lg:col-span-1 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-secondary" />
              <span className="neon-glow-cyan text-secondary">
                SCAN CONFIGURATION
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Frequency Range */}
            <div className="space-y-2">
              <Label htmlFor="startFreq" className="text-xs text-muted-foreground">
                Start Frequency (MHz)
              </Label>
              <Input
                id="startFreq"
                type="number"
                value={startFreq}
                onChange={(e) => setStartFreq(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopFreq" className="text-xs text-muted-foreground">
                Stop Frequency (MHz)
              </Label>
              <Input
                id="stopFreq"
                type="number"
                value={stopFreq}
                onChange={(e) => setStopFreq(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stepFreq" className="text-xs text-muted-foreground">
                Step Size (MHz)
              </Label>
              <Input
                id="stepFreq"
                type="number"
                step="0.1"
                value={stepFreq}
                onChange={(e) => setStepFreq(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            {/* Hardware Settings */}
            <div className="space-y-2">
              <Label htmlFor="sampleRate" className="text-xs text-muted-foreground">
                Sample Rate (MSPS)
              </Label>
              <Input
                id="sampleRate"
                type="number"
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gain" className="text-xs text-muted-foreground">
                RX Gain (dB)
              </Label>
              <Input
                id="gain"
                type="number"
                value={gain}
                onChange={(e) => setGain(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            {/* Detection Settings */}
            <div className="space-y-2">
              <Label htmlFor="threshold" className="text-xs text-muted-foreground">
                Detection Threshold (dBFS)
              </Label>
              <Input
                id="threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dwellTime" className="text-xs text-muted-foreground">
                Dwell Time (seconds)
              </Label>
              <Input
                id="dwellTime"
                type="number"
                step="0.1"
                value={dwellTime}
                onChange={(e) => setDwellTime(e.target.value)}
                className="bg-input border-border font-mono"
                disabled={isScanning}
              />
            </div>

            {/* Pause on Signal */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pauseOnSignal" className="text-xs text-muted-foreground">
                Pause on Signal
              </Label>
              <Switch
                id="pauseOnSignal"
                checked={pauseOnSignal}
                onCheckedChange={setPauseOnSignal}
                disabled={isScanning}
              />
            </div>

            {pauseOnSignal && (
              <div className="space-y-2">
                <Label htmlFor="pauseDuration" className="text-xs text-muted-foreground">
                  Pause Duration (seconds)
                </Label>
                <Input
                  id="pauseDuration"
                  type="number"
                  value={pauseDuration}
                  onChange={(e) => setPauseDuration(e.target.value)}
                  className="bg-input border-border font-mono"
                  disabled={isScanning}
                />
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2 pt-4">
              {!isScanning ? (
                <Button
                  className="flex-1 gap-2 border-primary hover:box-glow-pink"
                  variant="outline"
                  onClick={handleStartScan}
                  disabled={startScan.isPending}
                >
                  <Play className="w-4 h-4" />
                  Start Scan
                </Button>
              ) : (
                <Button
                  className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  variant="outline"
                  onClick={handleStopScan}
                  disabled={stopScan.isPending}
                >
                  <StopCircle className="w-4 h-4" />
                  Stop Scan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  DETECTED SIGNALS
                </span>
              </CardTitle>
              {detections.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-secondary hover:box-glow-cyan"
                  onClick={exportResults}
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            {isScanning && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scan Progress</span>
                  <span className="font-mono text-primary">{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Detections Table */}
            {detections.length > 0 ? (
              <div className="border border-border rounded overflow-hidden">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="bg-black/50 sticky top-0">
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left p-3">Frequency (MHz)</th>
                        <th className="text-left p-3">Power (dBFS)</th>
                        <th className="text-left p-3">Bandwidth (kHz)</th>
                        <th className="text-left p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detections.map((detection, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-border hover:bg-black/30 transition-colors"
                        >
                          <td className="p-3 font-mono text-secondary">
                            {detection.frequency.toFixed(6)}
                          </td>
                          <td className="p-3 font-mono text-primary">
                            {detection.power.toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-foreground">
                            {detection.bandwidth.toFixed(1)}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {detection.timestamp}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {isScanning
                  ? "Scanning for signals..."
                  : "No signals detected. Configure parameters and start scan."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

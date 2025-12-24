import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, Download, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast as showToast } from "sonner";

interface ScanResult {
  frequency: number;
  peak_power_dbm: number;
}

export default function Scanner() {
  // Using sonner toast
  const [isScanning, setIsScanning] = useState(false);
  const [startFreq, setStartFreq] = useState("900");
  const [stopFreq, setStopFreq] = useState("930");
  const [stepFreq, setStepFreq] = useState("1");
  const [gain, setGain] = useState([50]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);

  const scanMutation = trpc.scanner.scan.useMutation({
    onSuccess: (data: { results: ScanResult[] }) => {
      setScanResults(data.results);
      setIsScanning(false);
      showToast.success(`Scan Complete: ${data.results.length} frequencies`);
    },
    onError: (error: { message: string }) => {
      setIsScanning(false);
      showToast.error(`Scan Failed: ${error.message}`);
    },
  });

  const handleStartScan = () => {
    const start = parseFloat(startFreq) * 1e6;
    const stop = parseFloat(stopFreq) * 1e6;
    const step = parseFloat(stepFreq) * 1e6;

    if (start >= stop) {
      showToast.error("Start frequency must be less than stop frequency");
      return;
    }

    setIsScanning(true);
    setScanResults([]);
    scanMutation.mutate({
      startFreq: start,
      stopFreq: stop,
      stepFreq: step,
      gain: gain[0],
    });
  };

  const handleStopScan = () => {
    setIsScanning(false);
    // TODO: Implement scan cancellation
  };

  const handleExportResults = () => {
    const json = JSON.stringify(scanResults, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxPower = scanResults.length > 0
    ? Math.max(...scanResults.map((r) => r.peak_power_dbm))
    : -100;

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-4">
      {/* Main Scan Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Scan Results Visualization */}
        <Card className="flex-1 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <span className="neon-glow-pink">FREQUENCY SCANNER</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <div className="w-full h-full bg-black/80 rounded border border-secondary/30 relative overflow-hidden p-4">
              {scanResults.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">
                      Configure scan parameters and click START to begin
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col gap-4">
                  {/* Chart */}
                  <div className="flex-1 relative">
                    <svg className="w-full h-full">
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line
                          key={`grid-${i}`}
                          x1="0"
                          y1={`${i * 25}%`}
                          x2="100%"
                          y2={`${i * 25}%`}
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="1"
                        />
                      ))}
                      {/* Data points */}
                      <polyline
                        points={scanResults
                          .map((r, i) => {
                            const x = (i / (scanResults.length - 1)) * 100;
                            const y = 100 - ((r.peak_power_dbm + 100) / 100) * 100;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="rgb(236, 72, 153)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Peak markers */}
                      {scanResults.map((r, i) => {
                        if (r.peak_power_dbm === maxPower) {
                          const x = (i / (scanResults.length - 1)) * 100;
                          const y = 100 - ((r.peak_power_dbm + 100) / 100) * 100;
                          return (
                            <circle
                              key={`peak-${i}`}
                              cx={`${x}%`}
                              cy={`${y}%`}
                              r="4"
                              fill="rgb(34, 211, 238)"
                              className="box-glow-cyan"
                            />
                          );
                        }
                        return null;
                      })}
                    </svg>
                  </div>

                  {/* Results Table */}
                  <div className="h-48 overflow-y-auto border border-border rounded">
                    <table className="w-full text-xs font-mono">
                      <thead className="bg-card sticky top-0">
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-muted-foreground">
                            Frequency (MHz)
                          </th>
                          <th className="text-right p-2 text-muted-foreground">
                            Peak Power (dBm)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResults.map((result, i) => (
                          <tr
                            key={i}
                            className={`border-b border-border/50 ${
                              result.peak_power_dbm === maxPower
                                ? "bg-secondary/20"
                                : ""
                            }`}
                          >
                            <td className="p-2 text-secondary">
                              {(result.frequency / 1e6).toFixed(2)}
                            </td>
                            <td
                              className={`p-2 text-right ${
                                result.peak_power_dbm === maxPower
                                  ? "text-secondary font-bold"
                                  : "text-primary"
                              }`}
                            >
                              {result.peak_power_dbm.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HUD Corners */}
              <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-secondary/50 pointer-events-none" />
              <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-secondary/50 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-secondary/50 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-secondary/50 pointer-events-none" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <div className="w-80 space-y-4">
        {/* Scan Configuration */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-cyan text-secondary">
                SCAN CONFIGURATION
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-freq">Start Frequency (MHz)</Label>
              <Input
                id="start-freq"
                type="number"
                value={startFreq}
                onChange={(e) => setStartFreq(e.target.value)}
                className="font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop-freq">Stop Frequency (MHz)</Label>
              <Input
                id="stop-freq"
                type="number"
                value={stopFreq}
                onChange={(e) => setStopFreq(e.target.value)}
                className="font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="step-freq">Step Size (MHz)</Label>
              <Input
                id="step-freq"
                type="number"
                value={stepFreq}
                onChange={(e) => setStepFreq(e.target.value)}
                className="font-mono"
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label>RX Gain</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={gain}
                  onValueChange={setGain}
                  min={0}
                  max={76}
                  step={1}
                  className="flex-1"
                  disabled={isScanning}
                />
                <span className="text-sm font-mono text-primary w-12 text-right">
                  {gain[0]} dB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scan Control */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-pink text-primary">
                SCAN CONTROL
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isScanning ? (
              <Button
                onClick={handleStartScan}
                className="w-full gap-2 box-glow-pink"
                size="lg"
              >
                <Play className="w-4 h-4" />
                START SCAN
              </Button>
            ) : (
              <Button
                onClick={handleStopScan}
                variant="destructive"
                className="w-full gap-2"
                size="lg"
              >
                <Square className="w-4 h-4" />
                STOP SCAN
              </Button>
            )}

            {scanResults.length > 0 && (
              <Button
                onClick={handleExportResults}
                variant="outline"
                className="w-full gap-2"
                disabled={isScanning}
              >
                <Download className="w-4 h-4" />
                Export Results
              </Button>
            )}

            {isScanning && (
              <div className="bg-black/50 rounded p-3 border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Scanning...</span>
                  <span className="text-primary font-mono">
                    {scanResults.length} / {Math.ceil((parseFloat(stopFreq) - parseFloat(startFreq)) / parseFloat(stepFreq)) + 1}
                  </span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 box-glow-pink"
                    style={{
                      width: `${(scanResults.length / (Math.ceil((parseFloat(stopFreq) - parseFloat(startFreq)) / parseFloat(stepFreq)) + 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Info */}
        {scanResults.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <span className="neon-glow-cyan text-secondary">
                  SCAN RESULTS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Frequencies Scanned</span>
                <span className="font-mono text-primary">
                  {scanResults.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Peak Power</span>
                <span className="font-mono text-secondary">
                  {maxPower.toFixed(1)} dBm
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Peak Frequency</span>
                <span className="font-mono text-secondary">
                  {scanResults.length > 0
                    ? (scanResults.find((r) => r.peak_power_dbm === maxPower)
                        ?.frequency! / 1e6).toFixed(2)
                    : "N/A"}{" "}
                  MHz
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

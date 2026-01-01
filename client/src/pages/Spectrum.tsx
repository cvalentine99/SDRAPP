import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Pause, Play, Radio } from "lucide-react";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { useState, useCallback } from "react";
import { WaterfallDisplay } from "@/components/WaterfallDisplay";
import { SpectrographDisplay } from "@/components/SpectrographDisplay";
import { trpc } from "@/lib/trpc";
import { usePersistFn } from "@/hooks/usePersistFn";
import { useWebSocketFFT } from "@/hooks/useWebSocketFFT";

export default function Spectrum() {
  const [isRunning, setIsRunning] = useState(false);
  
  // WebSocket FFT streaming
  const { fftData, isConnected, connectionStatus, reconnect, fps: wsFps } = useWebSocketFFT();
  const [frequency, setFrequency] = useState("915.0");
  const [gain, setGain] = useState([50]);
  
  // Fetch live telemetry
  const { data: telemetry } = trpc.telemetry.getMetrics.useQuery(undefined, {
    refetchInterval: 1000, // Refresh every second
  });
  
  // Mutations
  const setFrequencyMutation = trpc.device.setFrequency.useMutation({
    onSuccess: () => console.log("Frequency updated to", frequency, "MHz"),
    onError: (error) => console.error("Failed to set frequency:", error.message),
  });
  
  const setGainMutation = trpc.device.setGain.useMutation({
    onSuccess: () => console.log("Gain updated to", gain[0], "dB"),
    onError: (error) => console.error("Failed to set gain:", error.message),
  });
  
  // Debounced handlers
  const handleFrequencyChange = usePersistFn((value: string) => {
    setFrequency(value);
    const freqHz = parseFloat(value) * 1e6;
    if (!isNaN(freqHz) && freqHz >= 50e6 && freqHz <= 6e9) {
      setTimeout(() => {
        setFrequencyMutation.mutate({ frequency: freqHz });
      }, 500); // 500ms debounce
    }
  });
  
  const handleGainChange = usePersistFn((value: number[]) => {
    setGain(value);
    setTimeout(() => {
      setGainMutation.mutate({ gain: value[0] });
    }, 300); // 300ms debounce
  });
  
  const handleStartStop = useCallback(() => {
    setIsRunning(!isRunning);
    console.log(isRunning ? "Stopping FFT streaming" : "Starting FFT streaming");
  }, [isRunning]);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-4">
      {/* Main Visualization Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Waterfall Display */}
        <Card className="flex-1 bg-card border-border relative overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              <span className="neon-glow-pink">SPECTRUM WATERFALL</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <div className="w-full h-full bg-black/80 rounded border border-secondary/30 relative overflow-hidden">
              <WaterfallDisplay 
                width={1024} 
                height={512} 
                fftSize={2048} 
                fftData={fftData?.fftData || null}
                isRunning={isRunning && isConnected}
              />
              {/* HUD Corners */}
              <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-secondary/50 pointer-events-none" />
              <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-secondary/50 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-secondary/50 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-secondary/50 pointer-events-none" />
            </div>
          </CardContent>
        </Card>

        {/* Spectrograph Display */}
        <Card className="h-48 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-cyan text-secondary">
                SPECTROGRAPH
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-3.5rem)]">
            <div className="w-full h-full bg-black/80 rounded border border-primary/30 overflow-hidden">
              <SpectrographDisplay 
                width={1024} 
                height={150} 
                fftSize={2048} 
                fftData={fftData?.fftData || null}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Control Panel */}
      <div className="w-80 flex flex-col gap-4">
        {/* Frequency Control */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-pink text-primary">
                FREQUENCY CONTROL
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="frequency" className="text-xs text-muted-foreground">
                Center Frequency (MHz)
              </Label>
              <Input
                id="frequency"
                type="number"
                value={frequency}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className="font-mono text-lg bg-input border-border focus:border-primary"
                step="0.1"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-secondary hover:box-glow-cyan"
              >
                433 MHz
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-secondary hover:box-glow-cyan"
              >
                915 MHz
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-secondary hover:box-glow-cyan"
              >
                2.4 GHz
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sample-rate" className="text-xs text-muted-foreground">
                Sample Rate
              </Label>
              <Select defaultValue="10">
                <SelectTrigger id="sample-rate" className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="1">1 MSPS</SelectItem>
                  <SelectItem value="5">5 MSPS</SelectItem>
                  <SelectItem value="10">10 MSPS</SelectItem>
                  <SelectItem value="20">20 MSPS</SelectItem>
                  <SelectItem value="25">25 MSPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Gain Control */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-cyan text-secondary">GAIN CONTROL</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Overall Gain</Label>
                <span className="text-sm font-mono text-primary">{gain[0]} dB</span>
              </div>
              <Slider
                value={gain}
                onValueChange={handleGainChange}
                max={76}
                step={1}
                className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Label className="text-xs text-muted-foreground">AGC Mode</Label>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-secondary hover:box-glow-cyan"
              >
                Manual
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Acquisition Control */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-pink text-primary">ACQUISITION</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className={`w-full gap-2 ${
                isRunning ? "box-glow-cyan" : "box-glow-pink"
              }`}
              variant={isRunning ? "secondary" : "default"}
              onClick={handleStartStop}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  STOP
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  START
                </>
              )}
            </Button>

            {/* WebSocket Connection Status */}
            <WebSocketStatus
              connectionStatus={connectionStatus}
              fps={wsFps}
              onReconnect={reconnect}
              className="bg-black/50 border-border"
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-muted-foreground">Temperature</div>
                <div className="text-secondary font-mono">{telemetry?.temperature.toFixed(1) || "--"}°C</div>
              </div>
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-muted-foreground">USB Bandwidth</div>
                <div className="text-primary font-mono">{telemetry?.usbBandwidth.toFixed(1) || "--"} MB/s</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FFT Configuration */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              <span className="neon-glow-cyan text-secondary">FFT CONFIG</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fft-size" className="text-xs text-muted-foreground">
                FFT Size
              </Label>
              <Select defaultValue="2048">
                <SelectTrigger id="fft-size" className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="512">512</SelectItem>
                  <SelectItem value="1024">1024</SelectItem>
                  <SelectItem value="2048">2048</SelectItem>
                  <SelectItem value="4096">4096</SelectItem>
                  <SelectItem value="8192">8192</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="window" className="text-xs text-muted-foreground">
                Window Function
              </Label>
              <Select defaultValue="hann">
                <SelectTrigger id="window" className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="hann">Hann</SelectItem>
                  <SelectItem value="hamming">Hamming</SelectItem>
                  <SelectItem value="blackman">Blackman</SelectItem>
                  <SelectItem value="rectangular">Rectangular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

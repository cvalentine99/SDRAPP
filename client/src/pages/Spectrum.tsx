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
import { Pause, Play, Radio, SkipBack, SkipForward } from "lucide-react";
import { useState, useEffect } from "react";
import { WaterfallDisplay } from "@/components/WaterfallDisplay";
import { SpectrographDisplay } from "@/components/SpectrographDisplay";
import { BookmarkPanel } from "@/components/BookmarkPanel";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useFrequencyDrag } from "@/hooks/useFrequencyDrag";
import { trpc } from "@/lib/trpc";

export default function Spectrum() {
  const [isRunning, setIsRunning] = useState(false);
  const [frequency, setFrequency] = useState("915.0");
  const [gain, setGain] = useState([50]);

  const { isDragging, handleMouseDown } = useFrequencyDrag({
    initialValue: parseFloat(frequency) || 915.0,
    onChange: (newFreq) => handleFrequencyChange(newFreq.toString()),
    min: 70,
    max: 6000,
  });

  const { 
    fftData, 
    isConnected, 
    subscribe, 
    unsubscribe,
    fftHistory,
    historyIndex,
    setHistoryIndex,
    isPlayingHistory,
  } = useWebSocket();
  const deviceConfig = trpc.device.getConfig.useQuery();
  const updateConfig = trpc.device.updateConfig.useMutation();

  // Subscribe to FFT stream when running
  useEffect(() => {
    if (isRunning) {
      subscribe();
    } else {
      unsubscribe();
    }
  }, [isRunning, subscribe, unsubscribe]);

  // Load saved config
  useEffect(() => {
    if (deviceConfig.data) {
      setFrequency(deviceConfig.data.centerFrequency);
      setGain([deviceConfig.data.gain]);
    }
  }, [deviceConfig.data]);

  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    if (deviceConfig.data) {
      updateConfig.mutate({
        centerFrequency: newFreq,
        sampleRate: deviceConfig.data.sampleRate,
        gain: deviceConfig.data.gain,
        lnaGain: deviceConfig.data.lnaGain ?? undefined,
        tiaGain: deviceConfig.data.tiaGain ?? undefined,
        pgaGain: deviceConfig.data.pgaGain ?? undefined,
        agcMode: deviceConfig.data.agcMode,
        dcOffsetCorrection: deviceConfig.data.dcOffsetCorrection,
        iqBalanceCorrection: deviceConfig.data.iqBalanceCorrection,
        masterClockRate: deviceConfig.data.masterClockRate ?? undefined,
        clockSource: deviceConfig.data.clockSource ?? undefined,
        antenna: deviceConfig.data.antenna ?? undefined,
        fftSize: deviceConfig.data.fftSize ?? undefined,
        windowFunction: deviceConfig.data.windowFunction ?? undefined,
      });
    }
  };

  const handleGainChange = (newGain: number[]) => {
    setGain(newGain);
    if (deviceConfig.data) {
      updateConfig.mutate({
        centerFrequency: deviceConfig.data.centerFrequency,
        sampleRate: deviceConfig.data.sampleRate,
        gain: newGain[0] || 50,
        lnaGain: deviceConfig.data.lnaGain ?? undefined,
        tiaGain: deviceConfig.data.tiaGain ?? undefined,
        pgaGain: deviceConfig.data.pgaGain ?? undefined,
        agcMode: deviceConfig.data.agcMode,
        dcOffsetCorrection: deviceConfig.data.dcOffsetCorrection,
        iqBalanceCorrection: deviceConfig.data.iqBalanceCorrection,
        masterClockRate: deviceConfig.data.masterClockRate ?? undefined,
        clockSource: deviceConfig.data.clockSource ?? undefined,
        antenna: deviceConfig.data.antenna ?? undefined,
        fftSize: deviceConfig.data.fftSize ?? undefined,
        windowFunction: deviceConfig.data.windowFunction ?? undefined,
      });
    }
  };

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
              <WaterfallDisplay width={1024} height={512} fftSize={2048} />
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
              <SpectrographDisplay width={1024} height={150} fftSize={2048} />
            </div>
          </CardContent>
        </Card>

        {/* History Scrubbing Controls */}
        {fftHistory.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="neon-glow-cyan text-secondary">HISTORY PLAYBACK</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {isPlayingHistory 
                    ? `Frame ${historyIndex + 1}/${fftHistory.length}` 
                    : `Live (${fftHistory.length} frames buffered)`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-secondary hover:box-glow-cyan"
                  onClick={() => setHistoryIndex(Math.max(0, historyIndex - 1))}
                  disabled={historyIndex <= 0 && historyIndex !== -1}
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-secondary hover:box-glow-cyan flex-1"
                  onClick={() => setHistoryIndex(isPlayingHistory ? -1 : fftHistory.length - 1)}
                >
                  {isPlayingHistory ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Live
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Review History
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-secondary hover:box-glow-cyan"
                  onClick={() => setHistoryIndex(Math.min(fftHistory.length - 1, historyIndex + 1))}
                  disabled={historyIndex >= fftHistory.length - 1}
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Slider
                  value={[historyIndex === -1 ? fftHistory.length - 1 : historyIndex]}
                  onValueChange={([value]) => setHistoryIndex(value)}
                  min={0}
                  max={Math.max(0, fftHistory.length - 1)}
                  step={1}
                  className="w-full"
                  disabled={fftHistory.length === 0}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Control Panel */}
      <div className="w-80 flex flex-col gap-4 overflow-y-auto">
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
              <div className="relative">
                <Input
                  id="frequency"
                  type="number"
                  value={frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value)}
                  className={`font-mono text-lg bg-input border-border focus:border-primary ${
                    isDragging ? "cursor-ns-resize select-none" : ""
                  }`}
                  step="0.1"
                  onMouseDown={handleMouseDown}
                />
                {isDragging && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-xs text-secondary neon-glow-cyan">
                    ⇅
                  </div>
                )}
              </div>
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
              onClick={() => setIsRunning(!isRunning)}
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

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-muted-foreground">Connection</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-secondary animate-pulse box-glow-cyan' : 'bg-muted'}`} />
                  <span className="font-mono text-secondary">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
              </div>
              <div className="bg-black/50 rounded p-2 border border-border">
                <div className="text-muted-foreground">FFT Rate</div>
                <div className="text-primary font-mono">{fftData ? '60 FPS' : '--'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookmarks */}
        <BookmarkPanel onTuneToFrequency={handleFrequencyChange} />

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

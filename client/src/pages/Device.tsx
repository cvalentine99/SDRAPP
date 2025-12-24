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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Radio,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function Device() {
  const [dcOffsetCorrection, setDcOffsetCorrection] = useState(true);
  const [iqBalanceCorrection, setIqBalanceCorrection] = useState(true);
  const [agcMode, setAgcMode] = useState(false);
  const [lnaGain, setLnaGain] = useState([30]);
  const [tiaGain, setTiaGain] = useState([12]);
  const [pgaGain, setPgaGain] = useState([20]);
  
  // Fetch current device config
  const { data: deviceConfig } = trpc.device.getConfig.useQuery();
  const { data: deviceStatus } = trpc.device.getStatus.useQuery();
  const { data: deviceInfo } = trpc.device.getInfo.useQuery();
  
  // Mutations
  const setFrequencyMutation = trpc.device.setFrequency.useMutation({
    onSuccess: () => console.log("Frequency updated"),
    onError: (error) => console.error("Error:", error.message),
  });
  
  const setGainMutation = trpc.device.setGain.useMutation({
    onSuccess: () => console.log("Gain updated"),
    onError: (error) => console.error("Error:", error.message),
  });
  
  const setSampleRateMutation = trpc.device.setSampleRate.useMutation({
    onSuccess: () => console.log("Sample rate updated"),
    onError: (error) => console.error("Error:", error.message),
  });

  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Device Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 3D Device Visualization */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                <span className="neon-glow-pink text-primary">
                  ETTUS B210 USRP
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black/80 rounded border border-secondary/30 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
                <div className="text-center z-10">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-primary animate-pulse box-glow-pink flex items-center justify-center">
                    <Radio className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    3D Device Visualization
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Interactive hardware model
                  </p>
                </div>
                {/* HUD Corners */}
                <div className="absolute top-2 left-2 w-12 h-12 border-l-2 border-t-2 border-secondary/50" />
                <div className="absolute top-2 right-2 w-12 h-12 border-r-2 border-t-2 border-secondary/50" />
                <div className="absolute bottom-2 left-2 w-12 h-12 border-l-2 border-b-2 border-secondary/50" />
                <div className="absolute bottom-2 right-2 w-12 h-12 border-r-2 border-b-2 border-secondary/50" />
              </div>

              {/* Device Specifications */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">RF IC</div>
                  <div className="text-sm font-mono text-secondary">
                    AD9361
                  </div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">MIMO</div>
                  <div className="text-sm font-mono text-primary">2x2</div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">
                    Frequency Range
                  </div>
                  <div className="text-sm font-mono text-secondary">
                    50 MHz - 6 GHz
                  </div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">
                    Max Sample Rate
                  </div>
                  <div className="text-sm font-mono text-primary">
                    61.44 MSPS
                  </div>
                </div>
              </div>
              
              {/* Device Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">Serial Number</div>
                  <div className="text-sm font-mono text-primary">
                    {deviceInfo?.serial || "--"}
                  </div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">Device Name</div>
                  <div className="text-sm font-mono text-secondary">
                    {deviceInfo?.name || "--"}
                  </div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">FW / FPGA</div>
                  <div className="text-sm font-mono text-primary">
                    {deviceInfo?.firmwareVersion || "--"} / {deviceInfo?.fpgaVersion || "--"}
                  </div>
                </div>
                <div className="bg-black/50 rounded p-3 border border-border">
                  <div className="text-xs text-muted-foreground">GPSDO</div>
                  <div className="text-sm font-mono text-secondary">
                    {deviceInfo?.gpsdo || "--"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hardware Status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">
                <span className="neon-glow-cyan text-secondary">
                  HARDWARE STATUS
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-black/50 rounded border border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span className="text-xs">PLL Lock</span>
                </div>
                <span className="text-xs font-mono text-secondary">LOCKED</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-black/50 rounded border border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span className="text-xs">Clock Sync</span>
                </div>
                <span className="text-xs font-mono text-secondary">
                  INTERNAL
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-black/50 rounded border border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span className="text-xs">USB 3.0</span>
                </div>
                <span className="text-xs font-mono text-secondary">
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-black/50 rounded border border-border">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs">Buffer Status</span>
                </div>
                <span className="text-xs font-mono text-primary">NOMINAL</span>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overflows</span>
                  <span className="font-mono text-secondary">0</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Underflows</span>
                  <span className="font-mono text-secondary">0</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-mono text-primary">45°C</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Clock Configuration */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  CLOCK MANAGEMENT
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mcr" className="text-xs text-muted-foreground">
                  Master Clock Rate (MHz)
                </Label>
                <Select defaultValue="30.72">
                  <SelectTrigger id="mcr" className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="20.0">20.0 MHz</SelectItem>
                    <SelectItem value="30.72">30.72 MHz</SelectItem>
                    <SelectItem value="56.0">56.0 MHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="clock-source"
                  className="text-xs text-muted-foreground"
                >
                  Clock Source
                </Label>
                <Select defaultValue="internal">
                  <SelectTrigger
                    id="clock-source"
                    className="bg-input border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="internal">Internal TCXO</SelectItem>
                    <SelectItem value="external">External 10 MHz</SelectItem>
                    <SelectItem value="gpsdo">GPSDO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">PLL Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse box-glow-cyan" />
                    <span className="font-mono text-secondary">LOCKED</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Lock Time</span>
                  <span className="font-mono text-muted-foreground">
                    2.3 ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gain Staging */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  GAIN STAGING
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/50 rounded border border-border">
                <Label htmlFor="agc" className="text-xs">
                  Automatic Gain Control (AGC)
                </Label>
                <Switch
                  id="agc"
                  checked={agcMode}
                  onCheckedChange={setAgcMode}
                />
              </div>

              {!agcMode && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        LNA Gain
                      </Label>
                      <span className="text-sm font-mono text-primary">
                        {lnaGain[0]} dB
                      </span>
                    </div>
                    <Slider
                      value={lnaGain}
                      onValueChange={setLnaGain}
                      max={40}
                      step={1}
                      className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        TIA Gain
                      </Label>
                      <span className="text-sm font-mono text-secondary">
                        {tiaGain[0]} dB
                      </span>
                    </div>
                    <Slider
                      value={tiaGain}
                      onValueChange={setTiaGain}
                      max={12}
                      step={1}
                      className="[&_[role=slider]]:border-secondary [&_[role=slider]]:bg-secondary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        PGA Gain
                      </Label>
                      <span className="text-sm font-mono text-primary">
                        {pgaGain[0]} dB
                      </span>
                    </div>
                    <Slider
                      value={pgaGain}
                      onValueChange={setPgaGain}
                      max={31}
                      step={1}
                      className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
                    />
                  </div>

                  <div className="bg-black/50 rounded p-3 border border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Total Gain
                      </span>
                      <span className="text-lg font-mono text-primary">
                        {lnaGain[0] + tiaGain[0] + pgaGain[0]} dB
                      </span>
                    </div>
                  </div>
                </>
              )}

              {agcMode && (
                <div className="bg-black/50 rounded p-4 border border-secondary/50 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-secondary animate-pulse" />
                  <p className="text-xs text-muted-foreground">
                    AGC Mode Active
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hardware automatically adjusting gain
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RF Corrections */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="neon-glow-pink text-primary">
                  RF CALIBRATION
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/50 rounded border border-border">
                <div>
                  <Label
                    htmlFor="dc-offset"
                    className="text-xs font-medium cursor-pointer"
                  >
                    DC Offset Correction
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Removes center frequency spike
                  </p>
                </div>
                <Switch
                  id="dc-offset"
                  checked={dcOffsetCorrection}
                  onCheckedChange={setDcOffsetCorrection}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-black/50 rounded border border-border">
                <div>
                  <Label
                    htmlFor="iq-balance"
                    className="text-xs font-medium cursor-pointer"
                  >
                    IQ Imbalance Correction
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Eliminates ghost images
                  </p>
                </div>
                <Switch
                  id="iq-balance"
                  checked={iqBalanceCorrection}
                  onCheckedChange={setIqBalanceCorrection}
                />
              </div>

              <div className="bg-black/50 rounded p-3 border border-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-medium text-secondary">
                    Note for SigMF Recording
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Disable corrections for raw sensor data capture. Enable for
                  real-time analysis and visualization.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Antenna Configuration */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-secondary" />
                <span className="neon-glow-cyan text-secondary">
                  ANTENNA CONFIGURATION
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="rx-antenna"
                  className="text-xs text-muted-foreground"
                >
                  RX Antenna
                </Label>
                <Select defaultValue="rx2">
                  <SelectTrigger
                    id="rx-antenna"
                    className="bg-input border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="rx2">RX2 (Primary)</SelectItem>
                    <SelectItem value="tx-rx">TX/RX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="tx-antenna"
                  className="text-xs text-muted-foreground"
                >
                  TX Antenna
                </Label>
                <Select defaultValue="tx-rx">
                  <SelectTrigger
                    id="tx-antenna"
                    className="bg-input border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="tx-rx">TX/RX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-black/50 rounded p-3 border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">MIMO Mode</span>
                  <span className="font-mono text-primary">2x2 ENABLED</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dual-channel operation active
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

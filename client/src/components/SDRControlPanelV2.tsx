/**
 * SDR Control Panel V2
 * 
 * Production-grade control surface with capability/policy display.
 * Shows hardware limits and deployment constraints.
 * 
 * UI is a PURE CLIENT of the control plane.
 * All button states are derived from SDR runtime state.
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Play,
  Power,
  PowerOff,
  Radio,
  Settings,
  Shield,
  Square,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useSDRControlPlaneV2, type DeviceType } from "@/hooks/useSDRControlPlaneV2";
import type { SDRConfig, HardwareCapabilities, OperationalPolicy } from "../../../shared/sdr-capabilities";

/**
 * Status indicator component
 */
function StatusIndicator({ 
  status, 
  text 
}: { 
  status: "default" | "success" | "warning" | "error"; 
  text: string;
}) {
  const colorMap = {
    default: "bg-muted-foreground",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorMap[status]} animate-pulse`} />
      <span className="text-sm font-mono">{text}</span>
    </div>
  );
}

/**
 * Lifecycle state badge
 */
function StateBadge({ state }: { state: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    Idle: "outline",
    Configured: "secondary",
    Running: "default",
    Reconfiguring: "default",
  };

  const colors: Record<string, string> = {
    Idle: "",
    Configured: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    Running: "bg-green-500/20 text-green-400 border-green-500/50",
    Reconfiguring: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  };

  return (
    <Badge variant={variants[state] || "outline"} className={`font-mono ${colors[state] || ""}`}>
      {state}
    </Badge>
  );
}

/**
 * Capability constraint indicator
 */
function ConstraintIndicator({
  label,
  value,
  min,
  max,
  unit,
  policyMax,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  policyMax?: number;
}) {
  const effectiveMax = policyMax !== undefined ? Math.min(max, policyMax) : max;
  const percentage = ((value - min) / (effectiveMax - min)) * 100;
  const isPolicyLimited = policyMax !== undefined && policyMax < max;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono">
                {value.toLocaleString()} {unit}
                {isPolicyLimited && (
                  <Shield className="inline ml-1 h-3 w-3 text-yellow-500" />
                )}
              </span>
            </div>
            <Progress value={Math.min(100, Math.max(0, percentage))} className="h-1" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>Hardware: {min.toLocaleString()} - {max.toLocaleString()} {unit}</div>
            {isPolicyLimited && (
              <div className="text-yellow-500">
                Policy limit: {policyMax?.toLocaleString()} {unit}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Capability display card
 */
function CapabilityCard({ 
  capability, 
  policy 
}: { 
  capability: HardwareCapabilities | null;
  policy: OperationalPolicy | null;
}) {
  if (!capability) {
    return (
      <div className="p-3 bg-black/30 rounded border border-border text-center">
        <p className="text-xs text-muted-foreground">Select a device to view capabilities</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-black/30 rounded border border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary flex items-center gap-1">
          <Zap className="h-3 w-3" />
          CAPABILITIES
        </span>
        <Badge variant="outline" className="text-xs">
          {capability.backend.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Freq Range:</span>
          <span className="font-mono ml-1">
            {(capability.frequencyRange.min / 1e6).toFixed(0)}-{(capability.frequencyRange.max / 1e9).toFixed(1)} GHz
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Sample Rate:</span>
          <span className="font-mono ml-1">
            up to {(capability.sampleRateRange.max / 1e6).toFixed(1)} MSPS
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Gain:</span>
          <span className="font-mono ml-1">
            {capability.gainRange.min}-{capability.gainRange.max} dB
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Antennas:</span>
          <span className="font-mono ml-1">
            {capability.antennas.join(", ")}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">RX Channels:</span>
          <span className="font-mono ml-1">{capability.rxChannels}</span>
        </div>
        <div>
          <span className="text-muted-foreground">TX:</span>
          <span className="font-mono ml-1">
            {capability.hasTx ? (
              <span className="text-green-500">Yes</span>
            ) : (
              <span className="text-red-500">No</span>
            )}
          </span>
        </div>
      </div>

      {policy && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-2">
            <Shield className="h-3 w-3" />
            <span>Policy Constraints ({policy.mode})</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Max Sample Rate:</span>
              <span className="font-mono ml-1">{(policy.maxSampleRate / 1e6).toFixed(0)} MSPS</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Gain:</span>
              <span className="font-mono ml-1">{policy.maxGain} dB</span>
            </div>
            <div>
              <span className="text-muted-foreground">TX Enabled:</span>
              <span className="font-mono ml-1">
                {policy.txEnabled ? (
                  <span className="text-green-500">Yes</span>
                ) : (
                  <span className="text-red-500">No</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Recording:</span>
              <span className="font-mono ml-1">
                {policy.recordingEnabled ? (
                  <span className="text-green-500">Yes</span>
                ) : (
                  <span className="text-red-500">No</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Device selector with capability preview
 */
function DeviceTypeSelector({
  value,
  onChange,
  disabled,
  allCapabilities,
}: {
  value: DeviceType | null;
  onChange: (deviceType: DeviceType) => void;
  disabled: boolean;
  allCapabilities: Record<string, HardwareCapabilities>;
}) {
  const deviceOptions: { value: DeviceType; label: string; backend: string }[] = [
    { value: "b210", label: "Ettus B210", backend: "UHD" },
    { value: "b200", label: "Ettus B200", backend: "UHD" },
    { value: "x310", label: "Ettus X310", backend: "UHD" },
    { value: "simulator", label: "Simulator", backend: "Demo" },
    { value: "rtlsdr", label: "RTL-SDR", backend: "SoapySDR" },
    { value: "hackrf", label: "HackRF", backend: "SoapySDR" },
    { value: "limesdr", label: "LimeSDR", backend: "SoapySDR" },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Device Type</Label>
      <Select
        value={value || ""}
        onValueChange={(v) => onChange(v as DeviceType)}
        disabled={disabled}
      >
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="Select device..." />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {deviceOptions.map((opt) => {
            const cap = allCapabilities[opt.value];
            return (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center justify-between w-full">
                  <span>{opt.label}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {opt.backend}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * RX Configuration form with capability/policy constraints
 */
function RXConfigFormV2({
  config,
  capability,
  policy,
  onChange,
  onApply,
  disabled,
  isApplying,
}: {
  config: SDRConfig | null;
  capability: HardwareCapabilities | null;
  policy: OperationalPolicy | null;
  onChange: (config: SDRConfig) => void;
  onApply: () => void;
  disabled: boolean;
  isApplying: boolean;
}) {
  // Default config values
  const defaultConfig: SDRConfig = {
    frequency: 915e6,
    sampleRate: 10e6,
    gain: 50,
    bandwidth: 10e6,
    antenna: capability?.antennas[0] || "TX/RX",
    channel: 0,
  };

  const currentConfig = config || defaultConfig;

  const [localFreq, setLocalFreq] = useState((currentConfig.frequency / 1e6).toString());
  const [localGain, setLocalGain] = useState([currentConfig.gain]);
  const [localSampleRate, setLocalSampleRate] = useState((currentConfig.sampleRate / 1e6).toString());
  const [localAntenna, setLocalAntenna] = useState(currentConfig.antenna);

  // Derive limits from capability and policy
  const limits = useMemo(() => {
    if (!capability) {
      return {
        freqMin: 50,
        freqMax: 6000,
        gainMin: 0,
        gainMax: 76,
        sampleRateMax: 56,
        antennas: ["TX/RX"],
      };
    }

    const policyFreqMin = policy ? policy.allowedFrequencyRange.min / 1e6 : 0;
    const policyFreqMax = policy ? policy.allowedFrequencyRange.max / 1e6 : Infinity;
    const policySampleRateMax = policy ? policy.maxSampleRate / 1e6 : Infinity;
    const policyGainMax = policy ? policy.maxGain : Infinity;

    return {
      freqMin: Math.max(capability.frequencyRange.min / 1e6, policyFreqMin),
      freqMax: Math.min(capability.frequencyRange.max / 1e6, policyFreqMax),
      gainMin: capability.gainRange.min,
      gainMax: Math.min(capability.gainRange.max, policyGainMax),
      sampleRateMax: Math.min(capability.sampleRateRange.max / 1e6, policySampleRateMax),
      antennas: capability.antennas as string[],
    };
  }, [capability, policy]);

  // Sync local state when config changes externally
  useEffect(() => {
    if (config) {
      setLocalFreq((config.frequency / 1e6).toString());
      setLocalGain([config.gain]);
      setLocalSampleRate((config.sampleRate / 1e6).toString());
      setLocalAntenna(config.antenna);
    }
  }, [config]);

  const handleApply = () => {
    const newConfig: SDRConfig = {
      frequency: parseFloat(localFreq) * 1e6,
      sampleRate: parseFloat(localSampleRate) * 1e6,
      gain: localGain[0],
      bandwidth: parseFloat(localSampleRate) * 1e6, // Match sample rate
      antenna: localAntenna,
      channel: 0,
    };
    onChange(newConfig);
    onApply();
  };

  // Generate sample rate options based on limits
  const sampleRateOptions = [1, 2, 5, 10, 20, 30, 40, 56].filter(
    (rate) => rate <= limits.sampleRateMax
  );

  return (
    <div className="space-y-4">
      {/* Frequency */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Center Frequency (MHz)</Label>
          <span className="text-xs text-muted-foreground">
            {limits.freqMin.toFixed(0)} - {limits.freqMax.toFixed(0)} MHz
          </span>
        </div>
        <Input
          type="number"
          value={localFreq}
          onChange={(e) => setLocalFreq(e.target.value)}
          disabled={disabled}
          className="bg-input border-border font-mono"
          min={limits.freqMin}
          max={limits.freqMax}
          step={0.001}
        />
      </div>

      {/* Sample Rate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Sample Rate (MSPS)</Label>
          {policy && policy.maxSampleRate < (capability?.sampleRateRange.max || Infinity) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Shield className="h-3 w-3 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="text-xs">Policy limited to {(policy.maxSampleRate / 1e6).toFixed(0)} MSPS</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Select
          value={localSampleRate}
          onValueChange={setLocalSampleRate}
          disabled={disabled}
        >
          <SelectTrigger className="bg-input border-border font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {sampleRateOptions.map((rate) => (
              <SelectItem key={rate} value={rate.toString()}>
                {rate} MSPS
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Antenna */}
      {limits.antennas.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Antenna</Label>
          <Select
            value={localAntenna}
            onValueChange={setLocalAntenna}
            disabled={disabled}
          >
            <SelectTrigger className="bg-input border-border font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {limits.antennas.map((ant) => (
                <SelectItem key={ant} value={ant}>
                  {ant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Gain */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">RX Gain</Label>
          <span className="text-sm font-mono text-primary">{localGain[0]} dB</span>
        </div>
        <Slider
          value={localGain}
          onValueChange={setLocalGain}
          min={limits.gainMin}
          max={limits.gainMax}
          step={capability?.gainRange.step || 1}
          disabled={disabled}
          className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{limits.gainMin} dB</span>
          <span>{limits.gainMax} dB</span>
        </div>
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={disabled || isApplying}
        className="w-full"
        variant="secondary"
      >
        {isApplying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Applying...
          </>
        ) : (
          <>
            <Settings className="mr-2 h-4 w-4" />
            Apply Config
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Main SDR Control Panel V2
 */
export function SDRControlPanelV2() {
  const {
    context,
    state,
    deviceType,
    config,
    serial,
    lastError,
    capability,
    policy,
    allCapabilities,
    uiState,
    isLoading,
    setDeviceType,
    connect,
    disconnect,
    applyConfig,
    startStream,
    stopStream,
  } = useSDRControlPlaneV2();

  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(
    deviceType as DeviceType | null
  );
  const [localConfig, setLocalConfig] = useState<SDRConfig | null>(config);

  // Sync selected device type with state
  useEffect(() => {
    if (deviceType) {
      setSelectedDeviceType(deviceType as DeviceType);
    }
  }, [deviceType]);

  // Sync local config with state
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleDeviceTypeChange = (newDeviceType: DeviceType) => {
    setSelectedDeviceType(newDeviceType);
    setDeviceType(newDeviceType);
  };

  const handleConnect = () => {
    connect();
  };

  const handleApplyConfig = () => {
    if (localConfig) {
      applyConfig(localConfig);
    }
  };

  // Derive status
  const statusInfo = useMemo(() => {
    if (lastError) {
      return { status: "error" as const, text: lastError };
    }
    switch (state) {
      case "Idle":
        return { status: "default" as const, text: "Disconnected" };
      case "Configured":
        return { status: "success" as const, text: "Ready" };
      case "Running":
        return { status: "success" as const, text: "Streaming" };
      case "Reconfiguring":
        return { status: "warning" as const, text: "Configuring..." };
      default:
        return { status: "default" as const, text: state };
    }
  }, [state, lastError]);

  // Get selected device capability for preview
  const selectedCapability = selectedDeviceType ? allCapabilities[selectedDeviceType] : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span className="neon-glow-pink text-primary">SDR CONTROL V2</span>
          </CardTitle>
          <StateBadge state={state} />
        </div>
        <CardDescription className="text-xs">
          Production control plane with capability/policy validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div className="p-3 bg-black/50 rounded border border-border">
          <StatusIndicator status={statusInfo.status} text={statusInfo.text} />
          {serial && (
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              Serial: {serial}
            </div>
          )}
        </div>

        {/* Device Selection */}
        <DeviceTypeSelector
          value={selectedDeviceType}
          onChange={handleDeviceTypeChange}
          disabled={!uiState.canSetDeviceType || isLoading}
          allCapabilities={allCapabilities}
        />

        {/* Capability Preview */}
        <CapabilityCard 
          capability={selectedCapability || capability} 
          policy={policy} 
        />

        {/* Connect/Disconnect Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            disabled={!uiState.canConnect || !selectedDeviceType || isLoading}
            className="flex-1"
            variant="default"
          >
            {isLoading && state === "Idle" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
          <Button
            onClick={disconnect}
            disabled={!uiState.canDisconnect || isLoading}
            className="flex-1"
            variant="outline"
          >
            <PowerOff className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>

        <Separator className="bg-border" />

        {/* RX Configuration */}
        <RXConfigFormV2
          config={localConfig}
          capability={capability}
          policy={policy}
          onChange={setLocalConfig}
          onApply={handleApplyConfig}
          disabled={!uiState.canConfigure || isLoading}
          isApplying={state === "Reconfiguring"}
        />

        <Separator className="bg-border" />

        {/* Stream Controls */}
        <div className="flex gap-2">
          <Button
            onClick={startStream}
            disabled={!uiState.canStartStream || isLoading}
            className="flex-1"
            variant="default"
          >
            <Play className="mr-2 h-4 w-4" />
            Start RX
          </Button>
          <Button
            onClick={stopStream}
            disabled={!uiState.canStopStream || isLoading}
            className="flex-1"
            variant="destructive"
          >
            <Square className="mr-2 h-4 w-4" />
            Stop RX
          </Button>
        </div>

        {/* Error Display */}
        {uiState.hasError && lastError && (
          <div className="p-3 bg-destructive/20 rounded border border-destructive/50">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{lastError}</span>
            </div>
          </div>
        )}

        {/* Connection Status Icons */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {state !== "Idle" ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          )}
          {uiState.isStreaming && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-500 font-mono">RX</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact status bar V2
 */
export function SDRStatusBarV2() {
  const { state, config, uiState, startStream, stopStream, isLoading } = useSDRControlPlaneV2();

  return (
    <div className="flex items-center gap-3 p-2 bg-black/50 rounded border border-border">
      <StateBadge state={state} />
      
      <div className="flex-1" />
      
      {state !== "Idle" && (
        <>
          {uiState.canStartStream && (
            <Button
              onClick={startStream}
              disabled={isLoading}
              size="sm"
              variant="default"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {uiState.canStopStream && (
            <Button
              onClick={stopStream}
              disabled={isLoading}
              size="sm"
              variant="destructive"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
        </>
      )}
      
      {config && (
        <div className="text-xs font-mono text-muted-foreground">
          {(config.frequency / 1e6).toFixed(3)} MHz | {config.gain} dB
        </div>
      )}
    </div>
  );
}

/**
 * Audit log viewer V2
 */
export function AuditLogViewerV2() {
  const { auditLog } = useSDRControlPlaneV2();

  const getEventColor = (eventType: string, success: boolean) => {
    if (!success) return "text-red-500";
    switch (eventType) {
      case "config_applied":
        return "text-green-500";
      case "state_transition":
        return "text-blue-500";
      default:
        return "text-primary";
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {auditLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events yet</p>
          ) : (
            auditLog.slice().reverse().map((event, i) => (
              <div key={i} className="text-xs font-mono p-1 bg-black/30 rounded">
                <span className="text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                {" "}
                <span className={getEventColor(event.eventType, event.success)}>
                  [{event.eventType}]
                </span>
                {" "}
                <span>{event.details?.message || JSON.stringify(event.details)}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

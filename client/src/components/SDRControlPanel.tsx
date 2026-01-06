/**
 * SDR Control Panel
 * 
 * Main control surface for SDR lifecycle management.
 * Implements the UI → SDR Control Plane mapping.
 * 
 * UI is a PURE CLIENT of the control plane.
 * All button states are derived from SDR runtime state.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Power,
  PowerOff,
  Radio,
  Settings,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSDRControlPlane } from "@/hooks/useSDRControlPlane";
import { type SDRDeviceType, type RXConfig, DEFAULT_RX_CONFIG } from "../../../shared/sdr-control-plane";

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
function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    UNINITIALIZED: "outline",
    IDLE: "secondary",
    CONFIGURING: "default",
    STREAMING: "default",
    ERROR: "destructive",
  };

  return (
    <Badge variant={variants[lifecycle] || "outline"} className="font-mono">
      {lifecycle}
    </Badge>
  );
}

/**
 * Device selector with set_device_type
 */
function DeviceTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: SDRDeviceType | null;
  onChange: (deviceType: SDRDeviceType) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Device Type</Label>
      <Select
        value={value || ""}
        onValueChange={(v) => onChange(v as SDRDeviceType)}
        disabled={disabled}
      >
        <SelectTrigger className="bg-input border-border">
          <SelectValue placeholder="Select device..." />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          <SelectItem value="b210">Ettus B210 (UHD)</SelectItem>
          <SelectItem value="b200">Ettus B200 (UHD)</SelectItem>
          <SelectItem value="x310">Ettus X310 (UHD)</SelectItem>
          <SelectItem value="simulator">Simulator (Demo)</SelectItem>
          <SelectItem value="rtlsdr">RTL-SDR (SoapySDR)</SelectItem>
          <SelectItem value="hackrf">HackRF (SoapySDR)</SelectItem>
          <SelectItem value="limesdr">LimeSDR (SoapySDR)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * RX Configuration form
 */
function RXConfigForm({
  config,
  onChange,
  onApply,
  disabled,
  isApplying,
}: {
  config: RXConfig;
  onChange: (config: RXConfig) => void;
  onApply: () => void;
  disabled: boolean;
  isApplying: boolean;
}) {
  const [localFreq, setLocalFreq] = useState((config.frequency / 1e6).toString());
  const [localGain, setLocalGain] = useState([config.gain]);
  const [localSampleRate, setLocalSampleRate] = useState((config.sampleRate / 1e6).toString());

  // Sync local state when config changes externally
  useEffect(() => {
    setLocalFreq((config.frequency / 1e6).toString());
    setLocalGain([config.gain]);
    setLocalSampleRate((config.sampleRate / 1e6).toString());
  }, [config]);

  const handleApply = () => {
    const newConfig: RXConfig = {
      ...config,
      frequency: parseFloat(localFreq) * 1e6,
      gain: localGain[0],
      sampleRate: parseFloat(localSampleRate) * 1e6,
    };
    onChange(newConfig);
    onApply();
  };

  return (
    <div className="space-y-4">
      {/* Frequency */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Center Frequency (MHz)</Label>
        <Input
          type="number"
          value={localFreq}
          onChange={(e) => setLocalFreq(e.target.value)}
          disabled={disabled}
          className="bg-input border-border font-mono"
          min={50}
          max={6000}
          step={0.001}
        />
      </div>

      {/* Sample Rate */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sample Rate (MSPS)</Label>
        <Select
          value={localSampleRate}
          onValueChange={setLocalSampleRate}
          disabled={disabled}
        >
          <SelectTrigger className="bg-input border-border font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="1">1 MSPS</SelectItem>
            <SelectItem value="2">2 MSPS</SelectItem>
            <SelectItem value="5">5 MSPS</SelectItem>
            <SelectItem value="10">10 MSPS</SelectItem>
            <SelectItem value="20">20 MSPS</SelectItem>
            <SelectItem value="30">30 MSPS</SelectItem>
            <SelectItem value="40">40 MSPS</SelectItem>
            <SelectItem value="56">56 MSPS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gain */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">RX Gain</Label>
          <span className="text-sm font-mono text-primary">{localGain[0]} dB</span>
        </div>
        <Slider
          value={localGain}
          onValueChange={setLocalGain}
          min={0}
          max={76}
          step={1}
          disabled={disabled}
          className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
        />
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
 * Main SDR Control Panel
 */
export function SDRControlPanel() {
  const {
    state,
    uiState,
    isLoading,
    setDeviceType,
    connect,
    disconnect,
    applyConfig,
    startStream,
    stopStream,
    recoverFromError,
  } = useSDRControlPlane();

  const [selectedDeviceType, setSelectedDeviceType] = useState<SDRDeviceType | null>(
    state.deviceType
  );
  const [localConfig, setLocalConfig] = useState<RXConfig>(
    state.config || DEFAULT_RX_CONFIG
  );

  // Sync selected device type with state
  useEffect(() => {
    if (state.deviceType) {
      setSelectedDeviceType(state.deviceType);
    }
  }, [state.deviceType]);

  // Sync local config with state
  useEffect(() => {
    if (state.config) {
      setLocalConfig(state.config);
    }
  }, [state.config]);

  const handleDeviceTypeChange = (deviceType: SDRDeviceType) => {
    setSelectedDeviceType(deviceType);
    setDeviceType(deviceType);
  };

  const handleConnect = () => {
    if (selectedDeviceType) {
      connect(selectedDeviceType);
    }
  };

  const handleApplyConfig = () => {
    applyConfig(localConfig);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span className="neon-glow-pink text-primary">SDR CONTROL</span>
          </CardTitle>
          <LifecycleBadge lifecycle={state.lifecycle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div className="p-3 bg-black/50 rounded border border-border">
          <StatusIndicator status={uiState.statusColor} text={uiState.statusText} />
          {state.serial && (
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              Serial: {state.serial}
            </div>
          )}
        </div>

        {/* Device Selection */}
        <DeviceTypeSelector
          value={selectedDeviceType}
          onChange={handleDeviceTypeChange}
          disabled={uiState.isConnected || isLoading}
        />

        {/* Connect/Disconnect Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            disabled={!uiState.connectEnabled || !selectedDeviceType || isLoading}
            className="flex-1"
            variant="default"
          >
            {isLoading && state.lifecycle === "UNINITIALIZED" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
          <Button
            onClick={disconnect}
            disabled={!uiState.disconnectEnabled || isLoading}
            className="flex-1"
            variant="outline"
          >
            <PowerOff className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>

        <Separator className="bg-border" />

        {/* RX Configuration */}
        <RXConfigForm
          config={localConfig}
          onChange={setLocalConfig}
          onApply={handleApplyConfig}
          disabled={!uiState.configEnabled || isLoading}
          isApplying={uiState.isConfiguring}
        />

        <Separator className="bg-border" />

        {/* Stream Controls */}
        <div className="flex gap-2">
          <Button
            onClick={startStream}
            disabled={!uiState.startStreamEnabled || isLoading}
            className="flex-1"
            variant="default"
          >
            <Play className="mr-2 h-4 w-4" />
            Start RX
          </Button>
          <Button
            onClick={stopStream}
            disabled={!uiState.stopStreamEnabled || isLoading}
            className="flex-1"
            variant="destructive"
          >
            <Square className="mr-2 h-4 w-4" />
            Stop RX
          </Button>
        </div>

        {/* Error Recovery */}
        {uiState.hasError && (
          <div className="p-3 bg-destructive/20 rounded border border-destructive/50">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{state.lastError}</span>
            </div>
            <Button
              onClick={recoverFromError}
              variant="outline"
              size="sm"
              className="mt-2 w-full"
            >
              Recover
            </Button>
          </div>
        )}

        {/* Connection Status Icons */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {uiState.isConnected ? (
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
 * Compact status bar for embedding in other views
 */
export function SDRStatusBar() {
  const { state, uiState, startStream, stopStream, isLoading } = useSDRControlPlane();

  return (
    <div className="flex items-center gap-3 p-2 bg-black/50 rounded border border-border">
      <LifecycleBadge lifecycle={state.lifecycle} />
      <StatusIndicator status={uiState.statusColor} text={uiState.statusText} />
      
      <div className="flex-1" />
      
      {uiState.isConnected && (
        <>
          {uiState.startStreamEnabled && (
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
          {uiState.stopStreamEnabled && (
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
      
      {state.config && (
        <div className="text-xs font-mono text-muted-foreground">
          {(state.config.frequency / 1e6).toFixed(3)} MHz | {state.config.gain} dB
        </div>
      )}
    </div>
  );
}

/**
 * Audit log viewer
 */
export function AuditLogViewer() {
  const { auditLog } = useSDRControlPlane();

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
                <span className="text-primary">[{event.type}]</span>
                {" "}
                <span>{event.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

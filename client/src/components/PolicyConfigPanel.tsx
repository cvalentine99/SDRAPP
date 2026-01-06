/**
 * Policy Configuration Admin Panel
 * 
 * Admin-only interface for viewing and modifying operational policy.
 * Policy changes take effect immediately for new configurations.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useSDRControlPlaneV2 } from "@/hooks/useSDRControlPlaneV2";
import { useAuth } from "@/_core/hooks/useAuth";
import type { OperationalPolicy } from "../../../shared/sdr-capabilities";

interface PolicyFormState {
  minFrequency: string;
  maxFrequency: string;
  maxSampleRate: string;
  maxGain: string;
  txEnabled: boolean;
  maxStreamDuration: string;
  maxConcurrentStreams: string;
  recordingEnabled: boolean;
  maxRecordingDuration: string;
  maxRecordingSize: string;
}

function policyToForm(policy: OperationalPolicy): PolicyFormState {
  return {
    minFrequency: (policy.allowedFrequencyRange.min / 1e6).toString(),
    maxFrequency: (policy.allowedFrequencyRange.max / 1e6).toString(),
    maxSampleRate: (policy.maxSampleRate / 1e6).toString(),
    maxGain: policy.maxGain.toString(),
    txEnabled: policy.txEnabled,
    maxStreamDuration: policy.maxStreamDuration.toString(),
    maxConcurrentStreams: policy.maxConcurrentStreams.toString(),
    recordingEnabled: policy.recordingEnabled,
    maxRecordingDuration: policy.maxRecordingDuration.toString(),
    maxRecordingSize: (policy.maxRecordingSize / (1024 * 1024 * 1024)).toString(), // Convert to GB
  };
}

function formToPolicy(form: PolicyFormState): Partial<OperationalPolicy> {
  return {
    allowedFrequencyRange: {
      min: parseFloat(form.minFrequency) * 1e6,
      max: parseFloat(form.maxFrequency) * 1e6,
    },
    maxSampleRate: parseFloat(form.maxSampleRate) * 1e6,
    maxGain: parseFloat(form.maxGain),
    txEnabled: form.txEnabled,
    maxStreamDuration: parseInt(form.maxStreamDuration, 10),
    maxConcurrentStreams: parseInt(form.maxConcurrentStreams, 10),
    recordingEnabled: form.recordingEnabled,
    maxRecordingDuration: parseInt(form.maxRecordingDuration, 10),
    maxRecordingSize: parseFloat(form.maxRecordingSize) * 1024 * 1024 * 1024, // Convert from GB
  };
}

/**
 * Policy mode badge
 */
function ModeBadge({ mode }: { mode: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Shield }> = {
    demo: { variant: "outline", icon: Shield },
    development: { variant: "secondary", icon: ShieldAlert },
    production: { variant: "default", icon: ShieldCheck },
  };

  const { variant, icon: Icon } = variants[mode] || variants.demo;

  return (
    <Badge variant={variant} className="font-mono flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {mode.toUpperCase()}
    </Badge>
  );
}

/**
 * Policy Configuration Panel
 */
export function PolicyConfigPanel() {
  const { user } = useAuth();
  const { policy, updatePolicy, resetPolicy, isLoading } = useSDRControlPlaneV2();
  
  const [formState, setFormState] = useState<PolicyFormState | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Initialize form state from policy
  useEffect(() => {
    if (policy && !formState) {
      setFormState(policyToForm(policy));
    }
  }, [policy, formState]);

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            <span>Operational Policy</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-yellow-500/10 rounded border border-yellow-500/30 text-center">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-yellow-500">Admin access required to modify policy</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact an administrator to change operational constraints
            </p>
          </div>
          
          {/* Read-only policy display */}
          {policy && (
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <ModeBadge mode={policy.mode} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency Range:</span>
                <span className="font-mono">
                  {(policy.allowedFrequencyRange.min / 1e6).toFixed(0)} - {(policy.allowedFrequencyRange.max / 1e6).toFixed(0)} MHz
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Sample Rate:</span>
                <span className="font-mono">{(policy.maxSampleRate / 1e6).toFixed(0)} MSPS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Gain:</span>
                <span className="font-mono">{policy.maxGain} dB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TX Enabled:</span>
                <span className={policy.txEnabled ? "text-green-500" : "text-red-500"}>
                  {policy.txEnabled ? "Yes" : "No"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!formState || !policy) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading policy...</p>
        </CardContent>
      </Card>
    );
  }

  const handleChange = <K extends keyof PolicyFormState>(
    key: K,
    value: PolicyFormState[K]
  ) => {
    setFormState((prev) => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    if (!formState) return;
    
    setSaveStatus("saving");
    try {
      const updates = formToPolicy(formState);
      updatePolicy(updates);
      setHasChanges(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
    }
  };

  const handleReset = () => {
    resetPolicy();
    setFormState(null); // Will re-initialize from new policy
    setHasChanges(false);
    setSaveStatus("idle");
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="neon-glow-cyan text-primary">OPERATIONAL POLICY</span>
          </CardTitle>
          <ModeBadge mode={policy.mode} />
        </div>
        <CardDescription className="text-xs">
          Configure deployment constraints for SDR operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Frequency Range */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Allowed Frequency Range (MHz)</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={formState.minFrequency}
              onChange={(e) => handleChange("minFrequency", e.target.value)}
              className="bg-input border-border font-mono"
              min={0}
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              value={formState.maxFrequency}
              onChange={(e) => handleChange("maxFrequency", e.target.value)}
              className="bg-input border-border font-mono"
              min={0}
            />
          </div>
        </div>

        {/* Max Sample Rate */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Sample Rate (MSPS)</Label>
          <Select
            value={formState.maxSampleRate}
            onValueChange={(v) => handleChange("maxSampleRate", v)}
          >
            <SelectTrigger className="bg-input border-border font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="10">10 MSPS</SelectItem>
              <SelectItem value="20">20 MSPS</SelectItem>
              <SelectItem value="30">30 MSPS</SelectItem>
              <SelectItem value="40">40 MSPS</SelectItem>
              <SelectItem value="56">56 MSPS</SelectItem>
              <SelectItem value="61.44">61.44 MSPS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Gain */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Gain (dB)</Label>
          <Input
            type="number"
            value={formState.maxGain}
            onChange={(e) => handleChange("maxGain", e.target.value)}
            className="bg-input border-border font-mono"
            min={0}
            max={100}
          />
        </div>

        <Separator className="bg-border" />

        {/* TX Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">TX Enabled</Label>
            <p className="text-xs text-muted-foreground">Allow transmission operations</p>
          </div>
          <Switch
            checked={formState.txEnabled}
            onCheckedChange={(v) => handleChange("txEnabled", v)}
          />
        </div>

        {/* Recording Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Recording Enabled</Label>
            <p className="text-xs text-muted-foreground">Allow IQ recording to storage</p>
          </div>
          <Switch
            checked={formState.recordingEnabled}
            onCheckedChange={(v) => handleChange("recordingEnabled", v)}
          />
        </div>

        <Separator className="bg-border" />

        {/* Stream Duration */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Stream Duration (seconds, 0 = unlimited)</Label>
          <Input
            type="number"
            value={formState.maxStreamDuration}
            onChange={(e) => handleChange("maxStreamDuration", e.target.value)}
            className="bg-input border-border font-mono"
            min={0}
          />
        </div>

        {/* Concurrent Streams */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Concurrent Streams</Label>
          <Input
            type="number"
            value={formState.maxConcurrentStreams}
            onChange={(e) => handleChange("maxConcurrentStreams", e.target.value)}
            className="bg-input border-border font-mono"
            min={1}
            max={10}
          />
        </div>

        {/* Recording Duration */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Recording Duration (seconds)</Label>
          <Input
            type="number"
            value={formState.maxRecordingDuration}
            onChange={(e) => handleChange("maxRecordingDuration", e.target.value)}
            className="bg-input border-border font-mono"
            min={0}
          />
        </div>

        {/* Recording Size */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Max Recording Size (GB)</Label>
          <Input
            type="number"
            value={formState.maxRecordingSize}
            onChange={(e) => handleChange("maxRecordingSize", e.target.value)}
            className="bg-input border-border font-mono"
            min={0}
            step={0.1}
          />
        </div>

        <Separator className="bg-border" />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="flex-1"
            variant="default"
          >
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Policy
              </>
            )}
          </Button>
          <Button
            onClick={handleReset}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>

        {hasChanges && (
          <p className="text-xs text-yellow-500 text-center">
            Unsaved changes - click Save to apply
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact policy status indicator
 */
export function PolicyStatusBadge() {
  const { policy } = useSDRControlPlaneV2();

  if (!policy) return null;

  return (
    <div className="flex items-center gap-2">
      <ModeBadge mode={policy.mode} />
      {!policy.txEnabled && (
        <Badge variant="outline" className="text-xs text-red-500 border-red-500/50">
          TX Disabled
        </Badge>
      )}
    </div>
  );
}

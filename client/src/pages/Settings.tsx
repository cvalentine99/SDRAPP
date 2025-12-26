import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings as SettingsIcon, Radio, Server, Database, Wifi } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DeviceSelector } from "./DeviceSelector";

export default function Settings() {
  const [sdrMode, setSdrMode] = useState<"demo" | "production">("demo");
  
  const { data: currentMode, refetch } = trpc.settings.getMode.useQuery();
  const setModeMutation = trpc.settings.setMode.useMutation({
    onSuccess: () => {
      toast.success("SDR mode updated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update mode: ${error.message}`);
    },
  });

  useEffect(() => {
    if (currentMode) {
      setSdrMode(currentMode.mode);
    }
  }, [currentMode]);

  const handleModeToggle = (checked: boolean) => {
    const newMode = checked ? "production" : "demo";
    setSdrMode(newMode);
    setModeMutation.mutate({ mode: newMode });
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure SDR hardware mode and application preferences
        </p>
      </div>

      <Separator />

      {/* Device Selection */}
      <DeviceSelector />

      {/* SDR Mode Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                SDR Hardware Mode
              </CardTitle>
              <CardDescription className="mt-2">
                Switch between demo mode (simulated data) and production mode (real B210 hardware)
              </CardDescription>
            </div>
            <Badge variant={sdrMode === "production" ? "default" : "secondary"} className="text-sm">
              {sdrMode === "production" ? "PRODUCTION" : "DEMO"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="mode-toggle" className="text-base font-medium">
                Production Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable to connect to Ettus B210 hardware on gx10-alpha
              </p>
            </div>
            <Switch
              id="mode-toggle"
              checked={sdrMode === "production"}
              onCheckedChange={handleModeToggle}
              disabled={setModeMutation.isPending}
            />
          </div>

          {/* Mode Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="w-4 h-4" />
                Demo Mode
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                <li>• Simulated FFT data</li>
                <li>• No hardware required</li>
                <li>• Instant startup</li>
                <li>• Perfect for testing UI</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wifi className="w-4 h-4" />
                Production Mode
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6">
                <li>• Real B210 hardware</li>
                <li>• Live RF signals</li>
                <li>• IQ recording to S3</li>
                <li>• Requires gx10-alpha</li>
              </ul>
            </div>
          </div>

          {/* Current Configuration */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <Database className="w-4 h-4" />
              Current Configuration
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Mode:</span>{" "}
                <span className="font-medium">{currentMode?.mode || "Loading..."}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className="font-medium">{currentMode?.mode === "production" ? "Hardware Connected" : "Simulation Active"}</span>
              </div>
            </div>
          </div>

          {/* Warning for Production Mode */}
          {sdrMode === "production" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>⚠️ Production Mode Requirements:</strong>
                <br />
                • Ettus B210 must be connected via USB 3.0
                <br />
                • C++ daemons must be compiled on gx10-alpha
                <br />
                • UHD library must be installed
                <br />• Run deployment scripts from hardware/ directory
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Settings (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
          <CardDescription>More configuration options coming soon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg opacity-50">
            <div>
              <Label className="text-base font-medium">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
            </div>
            <Switch disabled />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg opacity-50">
            <div>
              <Label className="text-base font-medium">Auto-Save Recordings</Label>
              <p className="text-sm text-muted-foreground">Automatically save all recordings</p>
            </div>
            <Switch disabled />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg opacity-50">
            <div>
              <Label className="text-base font-medium">Notifications</Label>
              <p className="text-sm text-muted-foreground">Enable desktop notifications</p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
        <Button onClick={() => toast.success("Settings saved")}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

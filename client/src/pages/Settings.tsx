import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertCircle, Radio, Settings as SettingsIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Settings() {
  const { data: modeData, refetch } = trpc.system.getSDRMode.useQuery();
  const switchMode = trpc.system.switchSDRMode.useMutation({
    onSuccess: (data: { success: boolean; newMode: string; message: string }) => {
      refetch();
      toast.success(`Switched to ${data.newMode.toUpperCase()} mode`, {
        description: data.newMode === 'demo' 
          ? 'Now using simulated data for safe testing'
          : 'Now connected to real B210 hardware',
      });
    },
    onError: (error) => {
      toast.error('Failed to switch mode', {
        description: error.message,
      });
    },
  });

  const handleModeToggle = (checked: boolean) => {
    const newMode = checked ? 'production' : 'demo';
    switchMode.mutate({ mode: newMode });
  };

  const isProductionMode = modeData?.mode === 'production';

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold neon-glow-pink">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure system behavior and hardware integration
        </p>
      </div>

      {/* SDR Mode Configuration */}
      <Card className="mb-6 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <CardTitle>SDR Operating Mode</CardTitle>
          </div>
          <CardDescription>
            Switch between simulated demo data and real B210 hardware
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="space-y-1">
              <Label htmlFor="mode-toggle" className="text-base font-medium">
                Production Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                {isProductionMode 
                  ? 'Connected to real Ettus B210 hardware'
                  : 'Using simulated data for testing'}
              </p>
            </div>
            <Switch
              id="mode-toggle"
              checked={isProductionMode}
              onCheckedChange={handleModeToggle}
              disabled={switchMode.isPending}
              className="data-[state=checked]:bg-green-500"
            />
          </div>

          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-border bg-card/30">
              <div className="text-sm text-muted-foreground mb-1">Current Mode</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  isProductionMode ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="font-mono text-lg uppercase">
                  {modeData?.mode || 'loading...'}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card/30">
              <div className="text-sm text-muted-foreground mb-1">Data Source</div>
              <div className="font-mono text-lg">
                {isProductionMode ? 'Real Hardware' : 'Simulated'}
              </div>
            </div>
          </div>

          {/* Demo Mode Warning */}
          {!isProductionMode && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">Demo Mode Active</AlertTitle>
              <AlertDescription className="text-yellow-500/90">
                All spectrum data is simulated. Switch to Production Mode to connect to real B210 hardware.
              </AlertDescription>
            </Alert>
          )}

          {/* Production Mode Info */}
          {isProductionMode && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <Radio className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Production Mode Active</AlertTitle>
              <AlertDescription className="text-green-500/90">
                Connected to Ettus B210 USRP. All data is from real RF environment.
              </AlertDescription>
            </Alert>
          )}

          {/* Mode Descriptions */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="font-semibold text-sm text-muted-foreground">Mode Details</h4>
            
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1" />
                <div>
                  <div className="font-medium">Demo Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Generates realistic simulated FFT data at 60 FPS with signal peaks at 915.5 MHz, 916.2 MHz, and 914.8 MHz. 
                    Safe for UI testing without hardware.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                <div>
                  <div className="font-medium">Production Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Spawns sdr_streamer C++ daemon and streams real FFT data from B210 hardware. 
                    Requires USB 3.0 connection and compiled binaries.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Platform:</span>
              <span className="ml-2 font-mono">Linux ARM64</span>
            </div>
            <div>
              <span className="text-muted-foreground">Environment:</span>
              <span className="ml-2 font-mono">Development</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hardware:</span>
              <span className="ml-2 font-mono">Ettus B210</span>
            </div>
            <div>
              <span className="text-muted-foreground">Interface:</span>
              <span className="ml-2 font-mono">USB 3.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

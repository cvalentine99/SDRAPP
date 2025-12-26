import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';

export function DeviceSelector() {
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  
  const { data: devicesData, isLoading, refetch } = trpc.deviceList.listDevices.useQuery();
  const { data: currentDevice } = trpc.deviceList.getSelectedDevice.useQuery();
  const setDeviceMutation = trpc.deviceList.setSelectedDevice.useMutation({
    onSuccess: () => {
      toast.success('Device selected successfully');
    },
    onError: (error) => {
      toast.error(`Failed to select device: ${error.message}`);
    },
  });

  const devices = devicesData?.devices || [];

  const handleSelectDevice = () => {
    if (!selectedDevice) {
      toast.error('Please select a device');
      return;
    }

    const device = devices.find(d => d.args === selectedDevice);
    if (!device) return;

    setDeviceMutation.mutate({
      backend: device.backend,
      args: device.args,
    });
  };

  const getBackendBadge = (backend: 'uhd' | 'soapysdr') => {
    if (backend === 'uhd') {
      return <Badge variant="default" className="bg-primary">UHD (Ettus)</Badge>;
    }
    return <Badge variant="secondary">SoapySDR</Badge>;
  };

  const getDriverIcon = (driver: string) => {
    const iconMap: Record<string, string> = {
      b200: '📡',
      b210: '📡',
      x310: '🖥️',
      rtlsdr: '📻',
      hackrf: '🔧',
      limesdr: '💚',
      airspy: '✈️',
      pluto: '🛰️',
    };
    return iconMap[driver.toLowerCase()] || '📶';
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              SDR Device Selection
            </CardTitle>
            <CardDescription>
              Choose which SDR hardware to use for signal operations
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No SDR devices detected</p>
            <p className="text-sm mt-2">
              Make sure your hardware is connected and drivers are installed
            </p>
          </div>
        ) : (
          <>
            <RadioGroup
              value={selectedDevice || currentDevice?.args}
              onValueChange={setSelectedDevice}
            >
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.args}
                    className="flex items-center space-x-3 rounded-lg border border-border/50 p-4 hover:bg-accent/10 transition-colors"
                  >
                    <RadioGroupItem value={device.args} id={device.args} />
                    <Label
                      htmlFor={device.args}
                      className="flex-1 cursor-pointer flex items-center gap-3"
                    >
                      <span className="text-2xl">{getDriverIcon(device.driver)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{device.hardware}</span>
                          {getBackendBadge(device.backend)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Driver: <code className="text-xs bg-muted px-1 py-0.5 rounded">{device.driver}</code></div>
                          {device.serial && (
                            <div>Serial: <code className="text-xs bg-muted px-1 py-0.5 rounded">{device.serial}</code></div>
                          )}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <div className="flex items-center gap-2 pt-4">
              <Button
                onClick={handleSelectDevice}
                disabled={!selectedDevice || setDeviceMutation.isPending}
                className="flex-1"
              >
                {setDeviceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Selecting...
                  </>
                ) : (
                  'Select Device'
                )}
              </Button>
            </div>

            {currentDevice && (
              <div className="mt-4 p-3 bg-accent/10 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Currently Active:</p>
                <p className="font-medium flex items-center gap-2">
                  <span>{getDriverIcon(currentDevice.driver)}</span>
                  {currentDevice.hardware}
                  {getBackendBadge(currentDevice.backend)}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

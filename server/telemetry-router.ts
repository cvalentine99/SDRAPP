import { publicProcedure, router } from "./_core/trpc";
import { hardware } from "./hardware";

export const telemetryRouter = router({
  getMetrics: publicProcedure.query(() => {
    const status = hardware.getStatus();
    const config = hardware.getConfig();
    
    return {
      temperature: status.temperature,
      powerConsumption: 12.5,
      usbBandwidth: config.sampleRate * 8 / 1e6,
      bufferUsage: 45,
      cpuUsage: 32,
      gpsLock: status.gpsLock,
      pllLock: status.pllLock,
      overruns: 0,
      underruns: 0,
      droppedPackets: 0,
    };
  }),
});

/**
 * telemetry-router.ts - System Telemetry tRPC Router
 */

import { router, publicProcedure } from './_core/trpc';
import { getHardwareManager } from './hardware-manager';

export const telemetryRouter = router({
  getMetrics: publicProcedure.query(() => {
    // TODO: Track actual metrics from hardware-manager
    return {
      fftRate: 60,
      throughput: 0,
      droppedFrames: 0,
      timestamp: Date.now(),
    };
  }),

  getHardwareStatus: publicProcedure.query(() => {
    const hwManager = getHardwareManager();
    return hwManager.getStatus();
  }),
});

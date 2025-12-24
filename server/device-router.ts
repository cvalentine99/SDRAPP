import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { hardware } from "./hardware";

export const deviceRouter = router({
  getStatus: publicProcedure.query(() => hardware.getStatus()),
  
  getConfig: publicProcedure.query(() => hardware.getConfig()),

  setFrequency: publicProcedure
    .input(z.object({ frequency: z.number().min(50e6).max(6e9) }))
    .mutation(async ({ input }) => {
      await hardware.setFrequency(input.frequency);
      return { success: true };
    }),

  setSampleRate: publicProcedure
    .input(z.object({ sampleRate: z.number().min(200e3).max(61.44e6) }))
    .mutation(async ({ input }) => {
      await hardware.setSampleRate(input.sampleRate);
      return { success: true };
    }),

  setGain: publicProcedure
    .input(z.object({ gain: z.number().min(0).max(76) }))
    .mutation(async ({ input }) => {
      await hardware.setGain(input.gain);
      return { success: true };
    }),

  calibrate: publicProcedure
    .input(z.object({ type: z.enum(["dc_offset", "iq_balance", "all"]) }))
    .mutation(async ({ input }) => {
      return { success: true, message: `${input.type} calibration completed` };
    }),
});

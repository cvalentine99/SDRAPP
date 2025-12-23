import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getSDRMode, isDemoMode, isProductionMode, switchSDRMode } from "../hardware-manager-factory";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // SDR Mode Management
  getSDRMode: publicProcedure.query(() => {
    return {
      mode: getSDRMode(),
      isDemo: isDemoMode(),
      isProduction: isProductionMode(),
    };
  }),

  getSystemInfo: publicProcedure.query(() => {
    return {
      sdrMode: getSDRMode(),
      nodeEnv: process.env.NODE_ENV || 'development',
      platform: process.platform,
      arch: process.arch,
    };
  }),

  switchSDRMode: publicProcedure
    .input(z.object({ mode: z.enum(['demo', 'production']) }))
    .mutation(async ({ input }) => {
      await switchSDRMode(input.mode);
      return {
        success: true,
        newMode: input.mode,
        message: `Switched to ${input.mode} mode`,
      };
    }),
});

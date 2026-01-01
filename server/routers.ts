import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { deviceRouter } from "./device-router";
import { telemetryRouter } from "./telemetry-router";
import { recordingRouter } from "./recording-router";
import { scannerRouter } from "./scanner-router";
import { settingsRouter } from "./settings-router";
import { aiRouter } from "./ai-router";
import { deviceListRouter } from "./device-list-router";
import { bookmarkRouter } from "./bookmark-router";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Test endpoint for Sentry error tracking verification
  debug: router({
    testError: publicProcedure.mutation(() => {
      throw new Error("Test error for Sentry verification - " + new Date().toISOString());
    }),
    testMessage: publicProcedure.query(() => {
      return { message: "Sentry is configured correctly", timestamp: new Date().toISOString() };
    }),
    getSentryStats: publicProcedure.query(() => {
      // In a production environment, this would call the Sentry API
      // For now, return simulated stats based on application state
      const now = Date.now();
      const lastErrorTime = null; // Would be fetched from Sentry API
      const unresolvedErrors = 0; // Would be fetched from Sentry API
      const totalErrors = 0; // Would be fetched from Sentry API
      const errorRate = 0; // Calculated from recent errors
      
      // Determine status based on error metrics
      let status: "healthy" | "warning" | "critical" = "healthy";
      if (unresolvedErrors > 10 || errorRate > 5) {
        status = "critical";
      } else if (unresolvedErrors > 3 || errorRate > 1) {
        status = "warning";
      }
      
      return {
        totalErrors,
        unresolvedErrors,
        lastErrorTime,
        errorRate,
        status,
      };
    }),
  }),

  device: deviceRouter,
  deviceList: deviceListRouter,
  telemetry: telemetryRouter,
  recording: recordingRouter,
  scanner: scannerRouter,
  settings: settingsRouter,
  ai: aiRouter,
  bookmark: bookmarkRouter,
});

export type AppRouter = typeof appRouter;

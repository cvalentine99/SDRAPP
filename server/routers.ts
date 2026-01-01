import { COOKIE_NAME } from "../shared/const";
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
import { fetchSentryStats, submitSentryFeedback } from "./sentry-api";
import { getLogs, getCategories, getLogStats, clearLogs, type LogLevel } from "./log-storage";
import { getLoggerConfig, configureLogger } from "./logger";
import { z } from "zod";

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
    getSentryStats: publicProcedure.query(async () => {
      // Fetch real stats from Sentry API (or simulated if not configured)
      return fetchSentryStats();
    }),
    submitFeedback: publicProcedure
      .input(z.object({
        eventId: z.string(),
        name: z.string(),
        email: z.string().email(),
        comments: z.string(),
      }))
      .mutation(async ({ input }) => {
        const success = await submitSentryFeedback(input);
        return { success };
      }),
  }),

  // Log viewer endpoints
  logs: router({
    list: publicProcedure
      .input(z.object({
        level: z.enum(["debug", "info", "warn", "error"]).optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(({ input }) => {
        return getLogs(input);
      }),
    categories: publicProcedure.query(() => {
      return getCategories();
    }),
    stats: publicProcedure.query(() => {
      return getLogStats();
    }),
    clear: publicProcedure.mutation(() => {
      clearLogs();
      return { success: true };
    }),
    config: publicProcedure.query(() => {
      return getLoggerConfig();
    }),
    setConfig: publicProcedure
      .input(z.object({
        minLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        configureLogger(input);
        return { success: true, config: getLoggerConfig() };
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

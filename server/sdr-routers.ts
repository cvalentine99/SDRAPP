import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getDeviceConfig,
  upsertDeviceConfig,
  getFrequencyBookmarks,
  createFrequencyBookmark,
  updateFrequencyBookmark,
  deleteFrequencyBookmark,
  getRecordings,
  createRecording,
  deleteRecording,
  getAIConversations,
  createAIConversation,
} from "./sdr-db";
import { invokeLLM } from "./_core/llm";

// ============================================================================
// Device Configuration Router
// ============================================================================

export const deviceRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await getDeviceConfig(ctx.user.id);
    
    // Return default config if none exists
    if (!config) {
      return {
        centerFrequency: "915.0",
        sampleRate: "10.0",
        gain: 50,
        lnaGain: 30,
        tiaGain: 10,
        pgaGain: 10,
        agcMode: "manual" as const,
        dcOffsetCorrection: "enabled" as const,
        iqBalanceCorrection: "enabled" as const,
        masterClockRate: "30.72",
        clockSource: "internal",
        antenna: "TX/RX",
        fftSize: 2048,
        windowFunction: "hann",
      };
    }

    return config;
  }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        centerFrequency: z.string(),
        sampleRate: z.string(),
        gain: z.number(),
        lnaGain: z.number().optional(),
        tiaGain: z.number().optional(),
        pgaGain: z.number().optional(),
        agcMode: z.enum(["auto", "manual"]),
        dcOffsetCorrection: z.enum(["enabled", "disabled"]),
        iqBalanceCorrection: z.enum(["enabled", "disabled"]),
        masterClockRate: z.string().optional(),
        clockSource: z.string().optional(),
        antenna: z.string().optional(),
        fftSize: z.number().optional(),
        windowFunction: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await upsertDeviceConfig({
        userId: ctx.user.id,
        name: "Current Configuration",
        ...input,
      });

      return config;
    }),
});

// ============================================================================
// Frequency Bookmarks Router
// ============================================================================

export const bookmarksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getFrequencyBookmarks(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        frequency: z.string(),
        description: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await createFrequencyBookmark({
        userId: ctx.user.id,
        ...input,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        frequency: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Filter out undefined values to only update provided fields
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );
      return await updateFrequencyBookmark(id, ctx.user.id, updateData);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await deleteFrequencyBookmark(input.id, ctx.user.id);
    }),
});

// ============================================================================
// Recording Router
// ============================================================================

export const recordingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getRecordings(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        s3Key: z.string(),
        s3Url: z.string(),
        centerFrequency: z.string(),
        sampleRate: z.string(),
        gain: z.number(),
        duration: z.number(),
        fileSize: z.string(),
        author: z.string().optional(),
        description: z.string().optional(),
        license: z.string().optional(),
        hardware: z.string().optional(),
        location: z.string().optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await createRecording({
        userId: ctx.user.id,
        ...input,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await deleteRecording(input.id, ctx.user.id);
    }),
});

// ============================================================================
// AI Assistant Router
// ============================================================================

export const aiRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        context: z
          .object({
            centerFrequency: z.string().optional(),
            sampleRate: z.string().optional(),
            gain: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Save user message
      await createAIConversation({
        userId: ctx.user.id,
        role: "user",
        content: input.message,
      });

      // Build context-aware prompt
      let systemPrompt =
        "You are an expert RF signal intelligence assistant specializing in SDR (Software Defined Radio) analysis. You help users analyze spectrum data, identify signals, detect modulation schemes, and provide measurement recommendations.";

      if (input.context) {
        systemPrompt += `\n\nCurrent SDR Configuration:\n- Center Frequency: ${input.context.centerFrequency} MHz\n- Sample Rate: ${input.context.sampleRate} MSPS\n- Gain: ${input.context.gain} dB`;
      }

      // Get AI response
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.message },
        ],
      });

      const content = response.choices[0]?.message?.content;
      const assistantMessage = typeof content === 'string' ? content : "I'm sorry, I couldn't generate a response.";

      // Save assistant message
      await createAIConversation({
        userId: ctx.user.id,
        role: "assistant",
        content: assistantMessage,
      });

      return {
        message: assistantMessage,
      };
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    return await getAIConversations(ctx.user.id, 50);
  }),
});

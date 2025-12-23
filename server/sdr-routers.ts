import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getDeviceConfig,
  upsertDeviceConfig,
  getRecordings,
  createRecording,
  deleteRecording,
  getAIConversations,
  createAIConversation,
} from "./sdr-db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

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
        centerFrequency: z.string().optional(),
        sampleRate: z.string().optional(),
        gain: z.number().optional(),
        lnaGain: z.number().optional(),
        tiaGain: z.number().optional(),
        pgaGain: z.number().optional(),
        agcMode: z.enum(["auto", "manual"]).optional(),
        dcOffsetCorrection: z.enum(["enabled", "disabled"]).optional(),
        iqBalanceCorrection: z.enum(["enabled", "disabled"]).optional(),
        masterClockRate: z.string().optional(),
        clockSource: z.string().optional(),
        antenna: z.string().optional(),
        fftSize: z.number().optional(),
        windowFunction: z.string().optional(),
        colorMap: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing config
      const existing = await getDeviceConfig(ctx.user.id);
      
      // Merge with defaults if no existing config
      const defaults = {
        centerFrequency: "915.0",
        sampleRate: "10.0",
        gain: 50,
        agcMode: "manual" as const,
        dcOffsetCorrection: "enabled" as const,
        iqBalanceCorrection: "enabled" as const,
      };
      
      const config = await upsertDeviceConfig({
        userId: ctx.user.id,
        name: "Current Configuration",
        ...(existing || defaults),
        ...input,
      });

      return config;
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

  uploadIQData: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        data: z.string(), // base64 encoded binary IQ data
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to binary
      const buffer = Buffer.from(input.data, "base64");
      
      // Generate unique S3 key with user ID to prevent conflicts
      const s3Key = `recordings/${ctx.user.id}/${input.filename}`;
      
      // Upload to S3
      const { url } = await storagePut(
        s3Key,
        buffer,
        "application/octet-stream"
      );
      
      return {
        s3Url: url,
        s3Key,
      };
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

  analyzeIQFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileSize: z.number(),
        fileData: z.string(), // base64 encoded
        sampleRate: z.number().optional(),
        centerFrequency: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to binary
      const buffer = Buffer.from(input.fileData, "base64");
      
      // Parse IQ data (assuming complex float32: IQIQIQ...)
      const samples = new Float32Array(buffer.buffer);
      const numSamples = Math.floor(samples.length / 2);
      
      // Extract basic signal characteristics
      let maxPower = -Infinity;
      let avgPower = 0;
      for (let i = 0; i < numSamples; i++) {
        const I = samples[i * 2];
        const Q = samples[i * 2 + 1];
        const power = I * I + Q * Q;
        avgPower += power;
        if (power > maxPower) maxPower = power;
      }
      avgPower /= numSamples;
      
      // Convert to dBFS
      const avgPowerDB = 10 * Math.log10(avgPower + 1e-10);
      const maxPowerDB = 10 * Math.log10(maxPower + 1e-10);
      
      // Estimate bandwidth (simplified - would need FFT for accurate measurement)
      const estimatedBandwidth = input.sampleRate ? input.sampleRate * 0.8 : undefined;
      
      // Build analysis prompt for AI
      const analysisPrompt = `Analyze this IQ recording file:

File: ${input.fileName}
Size: ${(input.fileSize / 1024 / 1024).toFixed(2)} MB
Samples: ${numSamples.toLocaleString()}
Sample Rate: ${input.sampleRate ? (input.sampleRate / 1e6).toFixed(2) + ' MSPS' : 'Unknown'}
Center Frequency: ${input.centerFrequency ? (input.centerFrequency / 1e6).toFixed(2) + ' MHz' : 'Unknown'}

Signal Characteristics:
- Average Power: ${avgPowerDB.toFixed(2)} dBFS
- Peak Power: ${maxPowerDB.toFixed(2)} dBFS
- Dynamic Range: ${(maxPowerDB - avgPowerDB).toFixed(2)} dB
- Estimated Bandwidth: ${estimatedBandwidth ? (estimatedBandwidth / 1e6).toFixed(2) + ' MHz' : 'Unknown'}

Based on these characteristics, provide:
1. Likely signal type and modulation scheme
2. Potential interference or anomalies
3. Recommended analysis techniques
4. Suggested SDR configuration for live capture`;

      // Get AI analysis
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert RF signal analyst specializing in IQ data forensics and modulation identification.",
          },
          { role: "user", content: analysisPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      const analysis = typeof content === 'string' ? content : "Unable to analyze IQ file.";

      // Save analysis to conversation history
      await createAIConversation({
        userId: ctx.user.id,
        role: "assistant",
        content: analysis,
      });

      return {
        message: analysis,
        characteristics: {
          numSamples,
          avgPowerDB: parseFloat(avgPowerDB.toFixed(2)),
          maxPowerDB: parseFloat(maxPowerDB.toFixed(2)),
          dynamicRange: parseFloat((maxPowerDB - avgPowerDB).toFixed(2)),
          estimatedBandwidth,
        },
      };
    }),
});

/**
 * ai-router.ts - AI Assistant tRPC Router
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';
import { invokeLLM } from './_core/llm';

export const aiRouter = router({
  chat: publicProcedure
    .input(z.object({
      message: z.string(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const messages = [
        { role: 'system' as const, content: 'You are an SDR expert assistant helping with Ettus B210 USRP operations.' },
        ...(input.history || []),
        { role: 'user' as const, content: input.message },
      ];

      const response = await invokeLLM({ messages });
      return {
        message: response.choices[0].message.content,
      };
    }),

  analyzeSpectrum: publicProcedure
    .input(z.object({
      fftData: z.array(z.number()),
      frequency: z.number(),
      sampleRate: z.number(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `Analyze this RF spectrum data:
- Center frequency: ${input.frequency / 1e6} MHz
- Sample rate: ${input.sampleRate / 1e6} MHz
- FFT bins: ${input.fftData.length}
- Peak power: ${Math.max(...input.fftData).toFixed(2)} dB

Provide insights about visible signals, interference, and recommendations.`;

      const response = await invokeLLM({
        messages: [
          { role: 'system' as const, content: 'You are an RF spectrum analysis expert.' },
          { role: 'user' as const, content: prompt },
        ],
      });

      return {
        analysis: response.choices[0].message.content,
      };
    }),
});

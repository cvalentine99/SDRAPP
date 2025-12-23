/**
 * recording-router.ts - IQ Recording tRPC Router
 */

import { z } from 'zod';
import { router, publicProcedure } from './_core/trpc';

interface Recording {
  id: string;
  filename: string;
  frequency: number;
  sampleRate: number;
  duration: number;
  timestamp: number;
  size: number;
}

const recordings: Recording[] = [];
let isRecording = false;
let currentRecordingId: string | null = null;

export const recordingRouter = router({
  start: publicProcedure
    .input(z.object({
      filename: z.string(),
      frequency: z.number(),
      sampleRate: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (isRecording) throw new Error('Recording already in progress');
      const id = `rec_${Date.now()}`;
      currentRecordingId = id;
      isRecording = true;
      return { success: true, recordingId: id };
    }),

  stop: publicProcedure.mutation(async () => {
    if (!isRecording || !currentRecordingId) throw new Error('No recording in progress');
    const recording: Recording = {
      id: currentRecordingId,
      filename: `recording_${currentRecordingId}.iq`,
      frequency: 100e6,
      sampleRate: 2e6,
      duration: 10,
      timestamp: Date.now(),
      size: 1024 * 1024 * 10,
    };
    recordings.push(recording);
    isRecording = false;
    currentRecordingId = null;
    return { success: true, recording };
  }),

  list: publicProcedure.query(() => recordings),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const index = recordings.findIndex(r => r.id === input.id);
      if (index === -1) throw new Error('Recording not found');
      recordings.splice(index, 1);
      return { success: true };
    }),

  getStatus: publicProcedure.query(() => ({
    isRecording,
    currentRecordingId,
  })),
});

/**
 * recording-router.ts - IQ Recording tRPC Router with Database
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { getDb } from './db';
import { recordings } from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

let isRecording = false;
let currentRecordingId: number | null = null;

export const recordingRouter = router({
  start: protectedProcedure
    .input(z.object({
      filename: z.string(),
      frequency: z.number(),
      sampleRate: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (isRecording) throw new Error('Recording already in progress');
      
      // TODO: Start C++ iq_recorder daemon
      isRecording = true;
      
      // Create database entry (will be updated on stop)
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const [result] = await db.insert(recordings).values({
        userId: ctx.user.id,
        filename: input.filename,
        frequency: input.frequency,
        sampleRate: input.sampleRate,
        duration: 0, // Will update on stop
        size: 0,
        filePath: '', // Will update on stop
      });
      
      currentRecordingId = result.insertId;
      return { success: true, recordingId: currentRecordingId };
    }),

  stop: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isRecording || !currentRecordingId) throw new Error('No recording in progress');
    
    // TODO: Stop C++ iq_recorder daemon and get actual file info
    const duration = 10; // TODO: Calculate from actual recording
    const size = 1024 * 1024 * 10; // TODO: Get actual file size
    const filePath = `/tmp/recording_${currentRecordingId}.iq`; // TODO: Upload to S3
    
    // Update database entry
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    await db.update(recordings)
      .set({ duration, size, filePath })
      .where(eq(recordings.id, currentRecordingId));
    
    const [recording] = await db.select()
      .from(recordings)
      .where(eq(recordings.id, currentRecordingId));
    
    isRecording = false;
    currentRecordingId = null;
    
    return { success: true, recording };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    
    return await db.select()
      .from(recordings)
      .where(eq(recordings.userId, ctx.user.id))
      .orderBy(desc(recordings.createdAt));
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const [recording] = await db.select()
        .from(recordings)
        .where(eq(recordings.id, input.id));
      
      if (!recording) throw new Error('Recording not found');
      if (recording.userId !== ctx.user.id) throw new Error('Unauthorized');
      
      // TODO: Delete actual file from S3
      await db.delete(recordings).where(eq(recordings.id, input.id));
      
      return { success: true };
    }),

  getStatus: publicProcedure.query(() => ({
    isRecording,
    currentRecordingId,
  })),
});

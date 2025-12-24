import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { recordings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL || "");

export const recordingRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.select().from(recordings)
        .where(eq(recordings.userId, ctx.user.id))
        .orderBy(desc(recordings.createdAt));
    } catch (error) {
      console.error("Failed to list recordings:", error);
      return [];
    }
  }),

  start: protectedProcedure
    .input(z.object({
      frequency: z.number(),
      sampleRate: z.number(),
      duration: z.number(),
      gain: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.insert(recordings).values({
          userId: ctx.user.id,
          frequency: input.frequency,
          sampleRate: input.sampleRate,
          duration: input.duration,
          filePath: `/recordings/demo_${Date.now()}.iq`,
          fileSize: Math.floor(input.duration * input.sampleRate * 8),
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to start recording:", error);
        throw new Error("Failed to start recording");
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const [recording] = await db.select().from(recordings)
          .where(eq(recordings.id, input.id));

        if (!recording || recording.userId !== ctx.user.id) {
          throw new Error("Recording not found or access denied");
        }

        await db.delete(recordings).where(eq(recordings.id, input.id));
        return { success: true };
      } catch (error) {
        console.error("Failed to delete recording:", error);
        throw new Error("Failed to delete recording");
      }
    }),
});

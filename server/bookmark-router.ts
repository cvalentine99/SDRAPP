/**
 * Bookmark Router - Frequency bookmarks for quick access
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { frequencyBookmarks } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL || "");

// Input schemas
const CreateBookmarkSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: z.number().min(50e6).max(6e9), // 50 MHz - 6 GHz
  sampleRate: z.number().min(200e3).max(61.44e6), // 200 kSPS - 61.44 MSPS
  gain: z.number().min(0).max(76),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const UpdateBookmarkSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  frequency: z.number().min(50e6).max(6e9).optional(),
  sampleRate: z.number().min(200e3).max(61.44e6).optional(),
  gain: z.number().min(0).max(76).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().optional(),
});

const DeleteBookmarkSchema = z.object({
  id: z.number(),
});

// Response type
interface Bookmark {
  id: number;
  name: string;
  frequency: number;
  sampleRate: number;
  gain: number;
  description: string | null;
  color: string | null;
  sortOrder: number | null;
  createdAt: number;
  updatedAt: number;
}

export const bookmarkRouter = router({
  /**
   * List all bookmarks for current user
   */
  list: protectedProcedure.query(async ({ ctx }): Promise<Bookmark[]> => {
    try {
      const bookmarks = await db
        .select()
        .from(frequencyBookmarks)
        .where(eq(frequencyBookmarks.userId, ctx.user.id))
        .orderBy(asc(frequencyBookmarks.sortOrder));

      return bookmarks.map((b) => ({
        id: b.id,
        name: b.name,
        frequency: b.frequency,
        sampleRate: b.sampleRate,
        gain: b.gain,
        description: b.description,
        color: b.color,
        sortOrder: b.sortOrder,
        createdAt: b.createdAt.getTime(),
        updatedAt: b.updatedAt.getTime(),
      }));
    } catch (error) {
      console.error("Failed to list bookmarks:", error);
      return [];
    }
  }),

  /**
   * Create a new frequency bookmark
   */
  create: protectedProcedure
    .input(CreateBookmarkSchema)
    .mutation(async ({ input, ctx }): Promise<Bookmark> => {
      const [insertResult] = await db.insert(frequencyBookmarks).values({
        userId: ctx.user.id,
        name: input.name,
        frequency: input.frequency,
        sampleRate: input.sampleRate,
        gain: input.gain,
        description: input.description || null,
        color: input.color || "#00d4ff",
      }).$returningId();

      const [bookmark] = await db
        .select()
        .from(frequencyBookmarks)
        .where(eq(frequencyBookmarks.id, insertResult.id));

      return {
        id: bookmark.id,
        name: bookmark.name,
        frequency: bookmark.frequency,
        sampleRate: bookmark.sampleRate,
        gain: bookmark.gain,
        description: bookmark.description,
        color: bookmark.color,
        sortOrder: bookmark.sortOrder,
        createdAt: bookmark.createdAt.getTime(),
        updatedAt: bookmark.updatedAt.getTime(),
      };
    }),

  /**
   * Update an existing bookmark
   */
  update: protectedProcedure
    .input(UpdateBookmarkSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean }> => {
      const [existing] = await db
        .select()
        .from(frequencyBookmarks)
        .where(eq(frequencyBookmarks.id, input.id));

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("Bookmark not found or access denied");
      }

      const updateData: Partial<typeof frequencyBookmarks.$inferInsert> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.frequency !== undefined) updateData.frequency = input.frequency;
      if (input.sampleRate !== undefined) updateData.sampleRate = input.sampleRate;
      if (input.gain !== undefined) updateData.gain = input.gain;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

      await db
        .update(frequencyBookmarks)
        .set(updateData)
        .where(eq(frequencyBookmarks.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a bookmark
   */
  delete: protectedProcedure
    .input(DeleteBookmarkSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean }> => {
      const [existing] = await db
        .select()
        .from(frequencyBookmarks)
        .where(eq(frequencyBookmarks.id, input.id));

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("Bookmark not found or access denied");
      }

      await db.delete(frequencyBookmarks).where(eq(frequencyBookmarks.id, input.id));
      return { success: true };
    }),

  /**
   * Get preset bookmarks (common frequencies)
   * These are system-defined and available to all users
   */
  getPresets: protectedProcedure.query((): Bookmark[] => {
    const now = Date.now();
    return [
      {
        id: -1,
        name: "FM Radio (98 MHz)",
        frequency: 98e6,
        sampleRate: 2e6,
        gain: 30,
        description: "Commercial FM broadcast band",
        color: "#ff6b9d",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: -2,
        name: "ISM 433 MHz",
        frequency: 433.92e6,
        sampleRate: 2e6,
        gain: 40,
        description: "ISM band for remote controls, sensors",
        color: "#00d4ff",
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: -3,
        name: "ISM 915 MHz",
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        description: "LoRa, Zigbee, and other IoT devices",
        color: "#00ff88",
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: -4,
        name: "GPS L1",
        frequency: 1575.42e6,
        sampleRate: 5e6,
        gain: 76,
        description: "GPS L1 C/A code (civilian)",
        color: "#ffd700",
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: -5,
        name: "WiFi 2.4 GHz (Ch 6)",
        frequency: 2437e6,
        sampleRate: 20e6,
        gain: 40,
        description: "WiFi channel 6 center frequency",
        color: "#9d4edd",
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: -6,
        name: "5G NR n78 (3.5 GHz)",
        frequency: 3500e6,
        sampleRate: 30e6,
        gain: 40,
        description: "5G New Radio mid-band",
        color: "#ff4444",
        sortOrder: 5,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }),
});

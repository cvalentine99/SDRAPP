/**
 * Recording Router - Matches API Contract exactly
 * @see shared/api-contracts.ts for contract definitions
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { recordings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { spawn } from "child_process";
import { storagePut } from "./storage";
import fs from "fs/promises";
import {
  StartRecordingInputSchema,
  type Recording,
  type StartRecordingResponse,
} from "../shared/api-contracts";

const db = drizzle(process.env.DATABASE_URL || "");

export const recordingRouter = router({
  /**
   * List all recordings for current user
   * @returns Recording[]
   */
  list: protectedProcedure.query(async ({ ctx }): Promise<Recording[]> => {
    try {
      const dbRecordings = await db.select().from(recordings)
        .where(eq(recordings.userId, ctx.user.id))
        .orderBy(desc(recordings.createdAt));

      return dbRecordings.map((r) => ({
        id: r.id,
        filename: `recording_${r.id}`,
        frequency: r.frequency,
        sampleRate: r.sampleRate,
        gain: 50, // Default gain (not stored in DB)
        duration: r.duration,
        fileSize: r.fileSize,
        s3Url: r.filePath,
        createdAt: r.createdAt.getTime(),
        status: "completed" as const,
      }));
    } catch (error) {
      console.error("Failed to list recordings:", error);
      return [];
    }
  }),

  /**
   * Start a new IQ recording
   * @input StartRecordingInput
   * @returns StartRecordingResponse
   */
  start: protectedProcedure
    .input(StartRecordingInputSchema.extend({
      frequency: z.number().optional(),
      sampleRate: z.number().optional(),
      gain: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }): Promise<StartRecordingResponse> => {
      const sdrMode = process.env.SDR_MODE || "demo";
      const timestamp = Date.now();
      const filename = input.filename || `recording_${timestamp}`;
      const frequency = input.frequency || 915e6;
      const sampleRate = input.sampleRate || 10e6;
      const gain = input.gain || 50;
      const tmpPath = `/tmp/${filename}.sigmf-data`;
      const tmpMetaPath = `/tmp/${filename}.sigmf-meta`;

      try {
        // Calculate estimated size (8 bytes per complex sample)
        const estimatedSize = Math.floor(sampleRate * input.duration * 8);

        if (sdrMode !== "production") {
          // Demo mode: create fake recording entry
          const [insertResult] = await db.insert(recordings).values({
            userId: ctx.user.id,
            frequency,
            sampleRate,
            duration: input.duration,
            filePath: `https://demo.s3.amazonaws.com/recordings/${filename}.sigmf-data`,
            fileSize: estimatedSize,
          }).$returningId();

          return {
            id: insertResult.id,
            filename,
            estimatedSize,
            startTime: timestamp,
          };
        }

        // Production mode: spawn iq_recorder binary
        const recorderPath = process.env.IQ_RECORDER_PATH || "/usr/local/bin/iq_recorder";

        await new Promise<void>((resolve, reject) => {
          const recorder = spawn(recorderPath, [
            "--freq", frequency.toString(),
            "--rate", sampleRate.toString(),
            "--gain", gain.toString(),
            "--duration", input.duration.toString(),
            "--output", tmpPath,
          ]);

          let errorOutput = "";

          recorder.stderr.on("data", (data) => {
            errorOutput += data.toString();
            console.log("[iq_recorder]", data.toString());
          });

          recorder.on("close", (code) => {
            if (code !== 0) {
              reject(new Error(`iq_recorder failed: ${errorOutput}`));
            } else {
              resolve();
            }
          });

          recorder.on("error", (error) => {
            reject(new Error(`Failed to spawn iq_recorder: ${error.message}`));
          });
        });

        // Upload IQ data file to S3
        const dataBuffer = await fs.readFile(tmpPath);
        const s3Key = `recordings/${ctx.user.id}/${filename}.sigmf-data`;
        const { url: dataUrl } = await storagePut(s3Key, dataBuffer, "application/octet-stream");

        // Clean up temp files
        await fs.unlink(tmpPath).catch(() => {});
        await fs.unlink(tmpMetaPath).catch(() => {});

        // Save recording metadata to database
        const fileSize = dataBuffer.length;
        const [insertResult] = await db.insert(recordings).values({
          userId: ctx.user.id,
          frequency,
          sampleRate,
          duration: input.duration,
          filePath: dataUrl,
          fileSize,
        }).$returningId();

        return {
          id: insertResult.id,
          filename,
          estimatedSize: fileSize,
          startTime: timestamp,
        };
      } catch (error) {
        console.error("Recording failed:", error);
        // Clean up temp files on error
        await fs.unlink(tmpPath).catch(() => {});
        await fs.unlink(tmpMetaPath).catch(() => {});
        throw error;
      }
    }),

  /**
   * Delete a recording
   * @input { id: number }
   * @returns { success: boolean }
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean }> => {
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
        return { success: false };
      }
    }),
});

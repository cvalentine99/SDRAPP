import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { recordings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { spawn } from "child_process";
import { storagePut } from "./storage";
import fs from "fs/promises";
import { recordingParamsSchema } from "../shared/validation";
import {
  isProductionMode,
  calculateRecordingSize,
} from "./utils/hardware-utils";
import {
  createSDRError,
  SDRErrorCode,
  logError,
} from "./utils/error-utils";

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

  start: protectedProcedure.input(recordingParamsSchema)
    .mutation(async ({ input, ctx }) => {
      const isProduction = isProductionMode();
      const timestamp = Date.now();
      const filename = `recording_${timestamp}`;
      const tmpPath = `/tmp/${filename}.sigmf-data`;
      const tmpMetaPath = `/tmp/${filename}.sigmf-meta`;

      try {
        if (!isProduction) {
          // Demo mode: create fake recording
          const fileSize = calculateRecordingSize(
            input.sampleRate,
            input.duration
          );
          await db.insert(recordings).values({
            userId: ctx.user.id,
            frequency: input.frequency,
            sampleRate: input.sampleRate,
            duration: input.duration,
            filePath: `https://demo.s3.amazonaws.com/recordings/${filename}.sigmf-data`,
            fileSize,
          });
          
          return { success: true };
        }

        // Production mode: spawn iq_recorder binary
        const recorderPath = process.env.IQ_RECORDER_PATH || "/usr/local/bin/iq_recorder";
        
        await new Promise<void>((resolve, reject) => {
          const recorder = spawn(recorderPath, [
            "--freq", input.frequency.toString(),
            "--rate", input.sampleRate.toString(),
            "--gain", input.gain.toString(),
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

        // Upload SigMF metadata file to S3
        let metaUrl = "";
        try {
          const metaBuffer = await fs.readFile(tmpMetaPath);
          const metaKey = `recordings/${ctx.user.id}/${filename}.sigmf-meta`;
          const result = await storagePut(metaKey, metaBuffer, "application/json");
          metaUrl = result.url;
        } catch (error) {
          console.warn("No SigMF metadata file found, skipping upload");
        }

        // Clean up temp files
        await fs.unlink(tmpPath).catch(() => {});
        await fs.unlink(tmpMetaPath).catch(() => {});

        // Save recording metadata to database
        const fileSize = dataBuffer.length;
        await db.insert(recordings).values({
          userId: ctx.user.id,
          frequency: input.frequency,
          sampleRate: input.sampleRate,
          duration: input.duration,
          filePath: dataUrl,
          fileSize,
        });

        return { success: true, dataUrl, metaUrl };
      } catch (error) {
        logError("Recording", error, {
          frequency: input.frequency,
          sampleRate: input.sampleRate,
          duration: input.duration,
          mode: isProduction ? "production" : "demo",
        });
        // Clean up temp files on error
        await fs.unlink(tmpPath).catch(() => {});
        await fs.unlink(tmpMetaPath).catch(() => {});
        throw createSDRError(
          SDRErrorCode.RECORDING_FAILED,
          "Failed to start recording",
          error
        );
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

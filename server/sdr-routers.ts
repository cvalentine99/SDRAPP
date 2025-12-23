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
import { getHardwareManager } from "./hardware-manager";

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

  startHardware: protectedProcedure.mutation(async () => {
    const hwManager = getHardwareManager();
    await hwManager.start();
    return { success: true };
  }),

  stopHardware: protectedProcedure.mutation(async () => {
    const hwManager = getHardwareManager();
    await hwManager.stop();
    return { success: true };
  }),

  getHardwareStatus: protectedProcedure.query(async () => {
    const hwManager = getHardwareManager();
    return hwManager.getStatus();
  }),

  setFrequency: protectedProcedure
    .input(z.object({ frequency: z.number() }))
    .mutation(async ({ input }) => {
      const hwManager = getHardwareManager();
      await hwManager.updateConfig({ freq: input.frequency });
      return { success: true };
    }),

  setGain: protectedProcedure
    .input(z.object({ gain: z.number() }))
    .mutation(async ({ input }) => {
      const hwManager = getHardwareManager();
      await hwManager.updateConfig({ gain: input.gain });
      return { success: true };
    }),

  setSampleRate: protectedProcedure
    .input(z.object({ sampleRate: z.number() }))
    .mutation(async ({ input }) => {
      const hwManager = getHardwareManager();
      await hwManager.updateConfig({ rate: input.sampleRate });
      return { success: true };
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

  startIQRecording: protectedProcedure
    .input(
      z.object({
        frequency: z.number(),
        sampleRate: z.number(),
        gain: z.number(),
        duration: z.number(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { spawn } = await import("child_process");
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");

      // Find iq_recorder binary
      const possiblePaths = [
        path.join(__dirname, "../hardware/build/iq_recorder"),
        "/usr/local/bin/iq_recorder",
        "/usr/bin/iq_recorder",
      ];

      let recorderPath = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          recorderPath = p;
          break;
        }
      }

      if (!recorderPath) {
        throw new Error("iq_recorder binary not found. Please build hardware components.");
      }

      // Create temporary output file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `${input.filename}.sigmf-data`);

      // Spawn iq_recorder process
      const args = [
        "--freq", input.frequency.toString(),
        "--rate", input.sampleRate.toString(),
        "--gain", input.gain.toString(),
        "--duration", input.duration.toString(),
        "--output", tempFile,
      ];

      return new Promise<{ success: boolean; tempFile: string }>((resolve, reject) => {
        const proc = spawn(recorderPath, args);

        let stderr = "";
        proc.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
          console.log("[iq_recorder]", data.toString().trim());
        });

        proc.on("error", (error) => {
          reject(new Error(`Failed to start iq_recorder: ${error.message}`));
        });

        proc.on("exit", (code) => {
          if (code === 0) {
            resolve({ success: true, tempFile });
          } else {
            reject(new Error(`iq_recorder exited with code ${code}\n${stderr}`));
          }
        });
      });
    }),

  uploadRecordedIQ: protectedProcedure
    .input(
      z.object({
        tempFile: z.string(),
        recordingId: z.number(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const fs = await import("fs");

      // Read IQ file
      const iqData = fs.readFileSync(input.tempFile);

      // Upload to S3
      const s3Key = `recordings/${input.recordingId}/${input.filename}.sigmf-data`;
      const { url, key } = await storagePut(s3Key, iqData, "application/octet-stream");

      // Delete temp file
      fs.unlinkSync(input.tempFile);

      return { success: true, s3Url: url, s3Key: key };
    }),
});

// ============================================================================
// Frequency Scanner Router
// ============================================================================

export const scannerRouter = router({
  start: protectedProcedure
    .input(
      z.object({
        startFreq: z.number(),
        stopFreq: z.number(),
        stepFreq: z.number(),
        sampleRate: z.number(),
        gain: z.number(),
        threshold: z.number(),
        dwellTime: z.number(),
        pauseOnSignal: z.boolean(),
        pauseDuration: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { spawn } = await import("child_process");
      const path = await import("path");
      const fs = await import("fs");

      // Find freq_scanner binary
      const possiblePaths = [
        path.join(__dirname, "../hardware/build/freq_scanner"),
        "/usr/local/bin/freq_scanner",
        "/usr/bin/freq_scanner",
      ];

      let scannerPath = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          scannerPath = p;
          break;
        }
      }

      if (!scannerPath) {
        throw new Error("freq_scanner binary not found. Please build hardware components.");
      }

      // Spawn freq_scanner process
      const args = [
        "--start", input.startFreq.toString(),
        "--stop", input.stopFreq.toString(),
        "--step", input.stepFreq.toString(),
        "--rate", input.sampleRate.toString(),
        "--gain", input.gain.toString(),
        "--threshold", input.threshold.toString(),
        "--dwell", input.dwellTime.toString(),
        "--pause-on-signal", input.pauseOnSignal ? "true" : "false",
        "--pause-duration", input.pauseDuration.toString(),
      ];

      return new Promise<{ success: boolean; scanId: string }>((resolve, reject) => {
        const scanId = Date.now().toString();
        const proc = spawn(scannerPath, args);

        // Store process reference for status queries
        (global as any).scannerProcesses = (global as any).scannerProcesses || new Map();
        (global as any).scannerProcesses.set(scanId, {
          process: proc,
          detections: [],
          progress: 0,
          status: "running",
        });

        let stdout = "";
        proc.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
          const lines = stdout.split("\n");
          stdout = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);
                const scanData = (global as any).scannerProcesses.get(scanId);
                
                if (json.type === "detection") {
                  scanData.detections.push(json);
                } else if (json.type === "progress") {
                  scanData.progress = json.progress;
                } else if (json.type === "complete") {
                  scanData.status = "complete";
                }
              } catch (e) {
                console.error("[freq_scanner] Failed to parse JSON:", line);
              }
            }
          }
        });

        proc.stderr?.on("data", (data: Buffer) => {
          console.log("[freq_scanner]", data.toString().trim());
        });

        proc.on("error", (error) => {
          (global as any).scannerProcesses.get(scanId).status = "error";
          reject(new Error(`Failed to start freq_scanner: ${error.message}`));
        });

        proc.on("exit", (code) => {
          const scanData = (global as any).scannerProcesses.get(scanId);
          if (code === 0) {
            scanData.status = "complete";
          } else {
            scanData.status = "error";
          }
        });

        // Return immediately with scan ID
        resolve({ success: true, scanId });
      });
    }),

  getStatus: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .query(async ({ input }) => {
      const scanData = (global as any).scannerProcesses?.get(input.scanId);
      
      if (!scanData) {
        throw new Error("Scan not found");
      }

      return {
        status: scanData.status,
        progress: scanData.progress,
        detections: scanData.detections,
      };
    }),

  stop: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input }) => {
      const scanData = (global as any).scannerProcesses?.get(input.scanId);
      
      if (!scanData) {
        throw new Error("Scan not found");
      }

      if (scanData.process && scanData.status === "running") {
        scanData.process.kill("SIGTERM");
        scanData.status = "stopped";
      }

      return { success: true };
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

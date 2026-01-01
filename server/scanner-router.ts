/**
 * Scanner Router - Matches API Contract exactly
 * @see shared/api-contracts.ts for contract definitions
 */

import { router, protectedProcedure } from "./_core/trpc";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { z } from "zod";
import { addBreadcrumb } from "./sentry";
import {
  ScanInputSchema,
  type ScanResponse,
  type ScanResult,
} from "../shared/api-contracts";

// Store active scan processes for cancellation
const activeScans = new Map<string, {
  process?: ChildProcess;
  aborted: boolean;
  startTime: number;
}>();

export const scannerRouter = router({
  /**
   * Execute frequency scan
   * @input ScanInput
   * @returns ScanResponse
   */
  scan: protectedProcedure
    .input(ScanInputSchema.extend({
      scanId: z.string().optional(), // Optional scan ID for cancellation
    }))
    .mutation(async ({ input, ctx }): Promise<ScanResponse> => {
      const { startFreq, stopFreq, stepSize, dwellTime, gain } = input;
      const scanId = input.scanId || `scan_${ctx.user.openId}_${Date.now()}`;
      const sdrMode = process.env.SDR_MODE || "demo";

      const startTime = Date.now();

      // Register this scan as active
      activeScans.set(scanId, {
        aborted: false,
        startTime,
      });

      addBreadcrumb({
        category: "sdr.scanner",
        message: `Scan started: ${(startFreq / 1e6).toFixed(1)} - ${(stopFreq / 1e6).toFixed(1)} MHz`,
        level: "info",
        data: {
          scanId,
          startFreq,
          stopFreq,
          stepSize,
          dwellTime,
          gain,
          action: "start",
        },
      });

      try {
        if (sdrMode === "production") {
          // Production mode: spawn freq_scanner binary
          return await runProductionScan(scanId, input, startTime);
        }

        // Demo mode: generate simulated scan results with cancellation support
        return await runDemoScan(scanId, input, startTime);
      } finally {
        // Clean up active scan entry
        activeScans.delete(scanId);
      }
    }),

  /**
   * Cancel an active scan
   * @input { scanId: string }
   * @returns { success: boolean, message: string }
   */
  cancelScan: protectedProcedure
    .input(z.object({
      scanId: z.string(),
    }))
    .mutation(async ({ input }): Promise<{ success: boolean; message: string }> => {
      const { scanId } = input;
      const activeScan = activeScans.get(scanId);

      if (!activeScan) {
        return {
          success: false,
          message: "No active scan found with this ID",
        };
      }

      // Mark as aborted
      activeScan.aborted = true;

      // Kill the process if running in production mode
      if (activeScan.process) {
        activeScan.process.kill("SIGTERM");
      }

      addBreadcrumb({
        category: "sdr.scanner",
        message: `Scan cancelled: ${scanId}`,
        level: "warning",
        data: {
          scanId,
          duration: Date.now() - activeScan.startTime,
          action: "cancel",
        },
      });

      return {
        success: true,
        message: "Scan cancelled successfully",
      };
    }),

  /**
   * Get status of an active scan
   * @input { scanId: string }
   * @returns { active: boolean, startTime?: number, elapsed?: number }
   */
  getScanStatus: protectedProcedure
    .input(z.object({
      scanId: z.string(),
    }))
    .query(({ input }): { active: boolean; startTime?: number; elapsed?: number } => {
      const { scanId } = input;
      const activeScan = activeScans.get(scanId);

      if (!activeScan || activeScan.aborted) {
        return { active: false };
      }

      return {
        active: true,
        startTime: activeScan.startTime,
        elapsed: Date.now() - activeScan.startTime,
      };
    }),
});

/**
 * Run scan in production mode with real hardware
 */
async function runProductionScan(
  scanId: string,
  input: { startFreq: number; stopFreq: number; stepSize: number; dwellTime: number; gain: number },
  startTime: number
): Promise<ScanResponse> {
  const { startFreq, stopFreq, stepSize, dwellTime, gain } = input;

  return new Promise((resolve, reject) => {
    const binPath = path.resolve(__dirname, "../hardware/bin/freq_scanner");
    
    const scanner = spawn(binPath, [
      "--start", startFreq.toString(),
      "--stop", stopFreq.toString(),
      "--step", stepSize.toString(),
      "--dwell", dwellTime.toString(),
      "--gain", gain.toString(),
    ]);

    // Store process reference for cancellation
    const activeScan = activeScans.get(scanId);
    if (activeScan) {
      activeScan.process = scanner;
    }

    let output = "";
    
    scanner.stdout.on("data", (data) => {
      output += data.toString();
    });

    scanner.stderr.on("data", (data) => {
      console.error("[Scanner] stderr:", data.toString());
    });

    scanner.on("close", (code, signal) => {
      // Check if scan was cancelled
      const scan = activeScans.get(scanId);
      if (scan?.aborted || signal === "SIGTERM") {
        reject(new Error("Scan was cancelled"));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Scanner exited with code ${code}`));
        return;
      }

      try {
        const results = parseScannerOutput(output);
        const endTime = Date.now();
        
        const peakResult = results.reduce((max, r) => r.power > max.power ? r : max, results[0]);
        const avgPower = results.reduce((sum, r) => sum + r.power, 0) / results.length;

        resolve({
          results,
          startTime,
          endTime,
          peakFrequency: peakResult?.frequency || startFreq,
          peakPower: peakResult?.power || -100,
          averagePower: avgPower,
        });
      } catch (error) {
        reject(error);
      }
    });

    scanner.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Run scan in demo mode with simulated data
 */
async function runDemoScan(
  scanId: string,
  input: { startFreq: number; stopFreq: number; stepSize: number; dwellTime: number; gain: number },
  startTime: number
): Promise<ScanResponse> {
  const { startFreq, stopFreq, stepSize, dwellTime } = input;

  const results: ScanResult[] = [];
  const numSteps = Math.floor((stopFreq - startFreq) / stepSize) + 1;
  const stepDelay = Math.min(dwellTime || 10, 50); // Cap delay for responsiveness

  for (let i = 0; i < numSteps; i++) {
    // Check for cancellation before each step
    const activeScan = activeScans.get(scanId);
    if (!activeScan || activeScan.aborted) {
      throw new Error("Scan was cancelled");
    }

    const freq = startFreq + i * stepSize;
    
    // Simulate noise floor with occasional signals
    let power = -95 + Math.random() * 10; // Noise floor
    
    // Add simulated signals at specific frequencies
    if (Math.abs(freq - 915e6) < 2e6) {
      power = -45 + Math.random() * 5; // Strong signal at 915 MHz
    } else if (Math.abs(freq - 925e6) < 1e6) {
      power = -55 + Math.random() * 5; // Medium signal at 925 MHz
    } else if (Math.abs(freq - 902e6) < 500e3) {
      power = -65 + Math.random() * 5; // Weak signal at 902 MHz
    }

    results.push({
      frequency: freq,
      power,
      timestamp: startTime + i * (dwellTime || 100),
    });

    // Small delay to simulate real scanning and allow cancellation checks
    if (i % 10 === 0 && i > 0) {
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
  }

  const endTime = Date.now();
  const peakResult = results.reduce((max, r) => r.power > max.power ? r : max, results[0]);
  const avgPower = results.reduce((sum, r) => sum + r.power, 0) / results.length;

  const signalsFound = results.filter(r => r.power > -70).length;
  
  addBreadcrumb({
    category: "sdr.scanner",
    message: `Scan completed: ${signalsFound} signals found`,
    level: "info",
    data: {
      scanId,
      signalsFound,
      peakFrequency: peakResult?.frequency,
      peakPower: peakResult?.power,
      averagePower: avgPower,
      duration: endTime - startTime,
      action: "complete",
    },
  });

  return {
    results,
    startTime,
    endTime,
    peakFrequency: peakResult?.frequency || startFreq,
    peakPower: peakResult?.power || -100,
    averagePower: avgPower,
  };
}

function parseScannerOutput(output: string): ScanResult[] {
  const results: ScanResult[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      if (data.frequency !== undefined && data.power !== undefined) {
        results.push({
          frequency: data.frequency,
          power: data.power,
          timestamp: data.timestamp || Date.now(),
        });
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return results;
}

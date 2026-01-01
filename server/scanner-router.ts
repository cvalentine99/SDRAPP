/**
 * Scanner Router - Matches API Contract exactly
 * @see shared/api-contracts.ts for contract definitions
 */

import { router, protectedProcedure } from "./_core/trpc";
import { spawn } from "child_process";
import path from "path";
import {
  ScanInputSchema,
  type ScanResponse,
  type ScanResult,
} from "../shared/api-contracts";

export const scannerRouter = router({
  /**
   * Execute frequency scan
   * @input ScanInput
   * @returns ScanResponse
   */
  scan: protectedProcedure
    .input(ScanInputSchema)
    .mutation(async ({ input }): Promise<ScanResponse> => {
      const { startFreq, stopFreq, stepSize, dwellTime, gain } = input;
      const sdrMode = process.env.SDR_MODE || "demo";

      const startTime = Date.now();

      if (sdrMode === "production") {
        // Production mode: spawn freq_scanner binary
        return new Promise((resolve, reject) => {
          const binPath = path.resolve(__dirname, "../hardware/bin/freq_scanner");
          
          const scanner = spawn(binPath, [
            "--start", startFreq.toString(),
            "--stop", stopFreq.toString(),
            "--step", stepSize.toString(),
            "--dwell", dwellTime.toString(),
            "--gain", gain.toString(),
          ]);

          let output = "";
          
          scanner.stdout.on("data", (data) => {
            output += data.toString();
          });

          scanner.stderr.on("data", (data) => {
            console.error("[Scanner] stderr:", data.toString());
          });

          scanner.on("close", (code) => {
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

      // Demo mode: generate simulated scan results
      const results: ScanResult[] = [];
      const numSteps = Math.floor((stopFreq - startFreq) / stepSize) + 1;

      for (let i = 0; i < numSteps; i++) {
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
      }

      // Simulate scan delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const peakResult = results.reduce((max, r) => r.power > max.power ? r : max, results[0]);
      const avgPower = results.reduce((sum, r) => sum + r.power, 0) / results.length;

      return {
        results,
        startTime,
        endTime,
        peakFrequency: peakResult?.frequency || startFreq,
        peakPower: peakResult?.power || -100,
        averagePower: avgPower,
      };
    }),
});

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

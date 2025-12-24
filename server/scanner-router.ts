import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { spawn } from "child_process";
import path from "path";

interface ScanResult {
  frequency: number;
  peak_power_dbm: number;
}

export const scannerRouter = router({
  scan: publicProcedure
    .input(
      z.object({
        startFreq: z.number(),
        stopFreq: z.number(),
        stepFreq: z.number(),
        gain: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { startFreq, stopFreq, stepFreq, gain } = input;

      // For demo mode, return simulated scan results
      const isDemoMode = process.env.SDR_MODE === "demo";
      
      if (isDemoMode) {
        // Generate simulated scan results
        const results: ScanResult[] = [];
        for (let freq = startFreq; freq <= stopFreq; freq += stepFreq) {
          // Simulate peaks at 915 MHz and 925 MHz
          let power = -90 + Math.random() * 10; // Base noise floor
          
          if (Math.abs(freq - 915e6) < 2e6) {
            power = -40 + Math.random() * 5; // Strong signal at 915 MHz
          } else if (Math.abs(freq - 925e6) < 1e6) {
            power = -55 + Math.random() * 5; // Weaker signal at 925 MHz
          }
          
          results.push({
            frequency: freq,
            peak_power_dbm: power,
          });
        }
        
        // Simulate scan delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        return { results };
      }

      // Production mode: Use freq_scanner daemon
      return new Promise<{ results: ScanResult[] }>((resolve, reject) => {
        const scannerPath = path.join(__dirname, "../hardware/bin/freq_scanner");
        
        const args = [
          "--start", startFreq.toString(),
          "--stop", stopFreq.toString(),
          "--step", stepFreq.toString(),
          "--gain", gain.toString(),
        ];

        const scanner = spawn(scannerPath, args);
        let output = "";
        let errorOutput = "";

        scanner.stdout.on("data", (data) => {
          output += data.toString();
        });

        scanner.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        scanner.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Scanner failed: ${errorOutput}`));
            return;
          }

          try {
            const results: ScanResult[] = JSON.parse(output);
            resolve({ results });
          } catch (error) {
            reject(new Error(`Failed to parse scanner output: ${error}`));
          }
        });

        scanner.on("error", (error) => {
          reject(new Error(`Failed to spawn scanner: ${error.message}`));
        });
      });
    }),
});

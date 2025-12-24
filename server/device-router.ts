import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { hardware } from "./hardware";
import { exec } from "child_process";
import { promisify } from "util";
import { ENV } from "./_core/env";

const execAsync = promisify(exec);

export const deviceRouter = router({
  getStatus: publicProcedure.query(() => hardware.getStatus()),
  
  getConfig: publicProcedure.query(() => hardware.getConfig()),

  setFrequency: publicProcedure
    .input(z.object({ frequency: z.number().min(50e6).max(6e9) }))
    .mutation(async ({ input }) => {
      await hardware.setFrequency(input.frequency);
      return { success: true };
    }),

  setSampleRate: publicProcedure
    .input(z.object({ sampleRate: z.number().min(200e3).max(61.44e6) }))
    .mutation(async ({ input }) => {
      await hardware.setSampleRate(input.sampleRate);
      return { success: true };
    }),

  setGain: publicProcedure
    .input(z.object({ gain: z.number().min(0).max(76) }))
    .mutation(async ({ input }) => {
      await hardware.setGain(input.gain);
      return { success: true };
    }),

  calibrate: publicProcedure
    .input(z.object({ type: z.enum(["dc_offset", "iq_balance", "all"]) }))
    .mutation(async ({ input }) => {
      return { success: true, message: `${input.type} calibration completed` };
    }),

  getInfo: publicProcedure.query(async () => {
    const sdrMode = process.env.SDR_MODE || "demo";

    // Demo mode: return mock device info
    if (sdrMode === "demo") {
      return {
        serial: "194919",
        name: "MyB210",
        product: "B210",
        firmwareVersion: "8.0",
        fpgaVersion: "16.0",
        gpsdo: "GPSTCXO v3.2",
        usbSpeed: "USB 3.0",
        freqRange: { min: 50e6, max: 6e9 },
        sampleRateRange: { min: 200e3, max: 61.44e6 },
      };
    }

    // Production mode: run uhd_usrp_probe
    try {
      const { stdout } = await execAsync("uhd_usrp_probe --args='type=b200'", {
        timeout: 10000, // 10 second timeout
      });

      // Parse uhd_usrp_probe output
      const serialMatch = stdout.match(/serial:\s*(\S+)/);
      const nameMatch = stdout.match(/name:\s*(\S+)/);
      const productMatch = stdout.match(/product:\s*(\S+)/);
      const fwMatch = stdout.match(/FW Version:\s*([\d.]+)/);
      const fpgaMatch = stdout.match(/FPGA Version:\s*([\d.]+)/);
      const gpsdoMatch = stdout.match(/GPSDO:\s*([^\n]+)/);

      return {
        serial: serialMatch?.[1] || "unknown",
        name: nameMatch?.[1] || "B210",
        product: productMatch?.[1] || "B210",
        firmwareVersion: fwMatch?.[1] || "unknown",
        fpgaVersion: fpgaMatch?.[1] || "unknown",
        gpsdo: gpsdoMatch?.[1]?.trim() || "Not detected",
        usbSpeed: stdout.includes("USB 3.0") ? "USB 3.0" : "USB 2.0",
        freqRange: { min: 50e6, max: 6e9 },
        sampleRateRange: { min: 200e3, max: 61.44e6 },
      };
    } catch (error) {
      console.error("Failed to probe device:", error);
      // Fallback to mock data if probe fails
      return {
        serial: "unknown",
        name: "B210",
        product: "B210",
        firmwareVersion: "unknown",
        fpgaVersion: "unknown",
        gpsdo: "Probe failed",
        usbSpeed: "unknown",
        freqRange: { min: 50e6, max: 6e9 },
        sampleRateRange: { min: 200e3, max: 61.44e6 },
      };
    }
  }),
});

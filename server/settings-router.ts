import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import fs from "fs/promises";
import path from "path";

// Path to store mode configuration
const CONFIG_FILE = path.join(process.cwd(), ".sdr-mode");

export const settingsRouter = router({
  getMode: publicProcedure.query(async () => {
    try {
      const mode = await fs.readFile(CONFIG_FILE, "utf-8").catch(() => "demo");
      return { mode: mode.trim() as "demo" | "production" };
    } catch (error) {
      return { mode: "demo" as const };
    }
  }),

  setMode: publicProcedure
    .input(z.object({
      mode: z.enum(["demo", "production"]),
    }))
    .mutation(async ({ input }) => {
      try {
        await fs.writeFile(CONFIG_FILE, input.mode, "utf-8");
        // Update environment variable for current process
        process.env.SDR_MODE = input.mode;
        return { success: true, mode: input.mode };
      } catch (error) {
        throw new Error(`Failed to update mode: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }),
});

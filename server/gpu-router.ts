import { publicProcedure, router } from "./_core/trpc";

// GPU metrics are collected client-side and stored in React context
// This router provides a placeholder for future server-side GPU monitoring
export const gpuRouter = router({
  // Placeholder for server-side GPU metrics
  // In production, this could query system GPU stats via nvidia-smi or similar
  getServerGPUMetrics: publicProcedure.query(async () => {
    return {
      available: false,
      message: "GPU metrics are collected client-side via WebGL",
    };
  }),
});

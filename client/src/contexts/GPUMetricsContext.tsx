import React, { createContext, useContext, useState, useCallback } from "react";

interface GPUMetrics {
  memoryUsed: number; // MB
  memoryTotal: number; // MB
  textureCount: number;
  bufferCount: number;
  drawCalls: number;
  fps: number;
  lastUpdate: number;
}

interface GPUMetricsContextType {
  metrics: GPUMetrics;
  updateMetrics: (updates: Partial<GPUMetrics>) => void;
}

const GPUMetricsContext = createContext<GPUMetricsContextType | undefined>(
  undefined
);

export function GPUMetricsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<GPUMetrics>({
    memoryUsed: 0,
    memoryTotal: 0,
    textureCount: 0,
    bufferCount: 0,
    drawCalls: 0,
    fps: 0,
    lastUpdate: Date.now(),
  });

  const updateMetrics = useCallback((updates: Partial<GPUMetrics>) => {
    setMetrics((prev) => ({
      ...prev,
      ...updates,
      lastUpdate: Date.now(),
    }));
  }, []);

  return (
    <GPUMetricsContext.Provider value={{ metrics, updateMetrics }}>
      {children}
    </GPUMetricsContext.Provider>
  );
}

export function useGPUMetrics() {
  const context = useContext(GPUMetricsContext);
  if (!context) {
    throw new Error("useGPUMetrics must be used within GPUMetricsProvider");
  }
  return context;
}

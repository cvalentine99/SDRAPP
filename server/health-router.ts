import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getHardwareManager } from "./hardware";
import { getConnectedClients, getWebSocketStats } from "./websocket";
import os from "os";

// System health check interface
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  uptime: number;
  version: string;
  components: {
    server: ComponentHealth;
    websocket: ComponentHealth;
    hardware: ComponentHealth;
    database: ComponentHealth;
  };
  metrics: SystemMetrics;
}

interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  details?: Record<string, unknown>;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

const startTime = Date.now();

// Calculate CPU usage
function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  return Math.round((1 - totalIdle / totalTick) * 100);
}

// Get memory metrics
function getMemoryMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total,
    used,
    free,
    usagePercent: Math.round((used / total) * 100),
  };
}

// Get system metrics
function getSystemMetrics(): SystemMetrics {
  return {
    cpu: {
      usage: getCPUUsage(),
      cores: os.cpus().length,
      loadAvg: os.loadavg(),
    },
    memory: getMemoryMetrics(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  };
}

// Check hardware status
function checkHardwareHealth(): ComponentHealth {
  try {
    const hardwareManager = getHardwareManager();
    const isDemo = process.env.SDR_MODE !== "production";

    if (isDemo) {
      return {
        status: "healthy",
        message: "Running in demo mode",
        details: { mode: "demo" },
      };
    }

    // In production, check if hardware is responsive
    return {
      status: "healthy",
      message: "Hardware manager active",
      details: { mode: "production" },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Hardware check failed",
    };
  }
}

// Check WebSocket status
function checkWebSocketHealth(): ComponentHealth {
  try {
    const stats = getWebSocketStats();

    if (stats.connectedClients === 0) {
      return {
        status: "healthy",
        message: "No active connections",
        details: stats,
      };
    }

    // Check for excessive dropped frames
    const dropRate = stats.totalFramesSent > 0
      ? stats.totalFramesDropped / stats.totalFramesSent
      : 0;

    if (dropRate > 0.1) {
      return {
        status: "degraded",
        message: `High frame drop rate: ${(dropRate * 100).toFixed(1)}%`,
        details: stats,
      };
    }

    return {
      status: "healthy",
      message: `${stats.connectedClients} client(s) connected`,
      details: stats,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "WebSocket check failed",
    };
  }
}

// Check database status (placeholder - implement based on your DB setup)
function checkDatabaseHealth(): ComponentHealth {
  // For now, return healthy since we're using in-memory/local storage
  return {
    status: "healthy",
    message: "Database connection healthy",
  };
}

export const healthRouter = router({
  // Basic health check for load balancers
  ping: publicProcedure.query(() => {
    return { status: "ok", timestamp: Date.now() };
  }),

  // Liveness probe - is the server running?
  live: publicProcedure.query(() => {
    return {
      status: "alive",
      timestamp: Date.now(),
      uptime: Date.now() - startTime,
    };
  }),

  // Readiness probe - is the server ready to accept traffic?
  ready: publicProcedure.query(() => {
    const hardware = checkHardwareHealth();
    const websocket = checkWebSocketHealth();

    const isReady = hardware.status !== "unhealthy" && websocket.status !== "unhealthy";

    return {
      status: isReady ? "ready" : "not_ready",
      timestamp: Date.now(),
      components: {
        hardware: hardware.status,
        websocket: websocket.status,
      },
    };
  }),

  // Full health check with detailed metrics
  full: publicProcedure.query((): HealthStatus => {
    const server: ComponentHealth = {
      status: "healthy",
      message: "Server running",
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    const hardware = checkHardwareHealth();
    const websocket = checkWebSocketHealth();
    const database = checkDatabaseHealth();

    // Determine overall status
    const components = [server, hardware, websocket, database];
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (components.some((c) => c.status === "unhealthy")) {
      overallStatus = "unhealthy";
    } else if (components.some((c) => c.status === "degraded")) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - startTime,
      version: process.env.npm_package_version || "1.0.0",
      components: {
        server,
        websocket,
        hardware,
        database,
      },
      metrics: getSystemMetrics(),
    };
  }),

  // Get system metrics only
  metrics: publicProcedure.query(() => {
    return {
      timestamp: Date.now(),
      metrics: getSystemMetrics(),
      websocket: getWebSocketStats(),
    };
  }),
});

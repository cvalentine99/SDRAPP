import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";

// Mock hardware module
vi.mock("./hardware", () => ({
  hardware: {
    getStatus: () => ({
      temperature: 45,
      gpsLock: false,
      pllLock: true,
    }),
    getConfig: () => ({
      frequency: 915e6,
      sampleRate: 10e6,
      gain: 40,
    }),
  },
  getHardwareManager: () => ({
    getStatus: () => ({
      temperature: 45,
      gpsLock: false,
      pllLock: true,
    }),
    getConfig: () => ({
      frequency: 915e6,
      sampleRate: 10e6,
      gain: 40,
    }),
    on: vi.fn(),
    emit: vi.fn(),
  }),
}));

// Mock LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "This is a test AI response about RF signals.",
        },
      },
    ],
  }),
}));

// Mock storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/test-recording.sigmf-data",
  }),
}));

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn().mockReturnValue({
    stdout: {
      on: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn((event, callback) => {
      if (event === "close") {
        // Simulate successful completion
        setTimeout(() => callback(0), 10);
      }
    }),
  }),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from("mock IQ data")),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Gap Fixes - Recording, Settings, AI", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const mockContext: TrpcContext = {
      req: {} as any,
      res: {} as any,
      user: {
        id: 1,
        openId: "test-user",
        name: "Test User",
        role: "user",
      },
    };
    caller = appRouter.createCaller(mockContext);
  });

  describe("Settings Router", () => {
    it("should get SDR mode (demo by default)", async () => {
      const result = await caller.settings.getMode();
      expect(result).toHaveProperty("mode");
      expect(["demo", "production"]).toContain(result.mode);
    });

    it("should set SDR mode to production", async () => {
      const result = await caller.settings.setMode({ mode: "production" });
      expect(result.success).toBe(true);
      expect(result.mode).toBe("production");
    });

    it("should set SDR mode to demo", async () => {
      const result = await caller.settings.setMode({ mode: "demo" });
      expect(result.success).toBe(true);
      expect(result.mode).toBe("demo");
    });

    it("should reject invalid mode", async () => {
      await expect(
        caller.settings.setMode({ mode: "invalid" as any })
      ).rejects.toThrow();
    });
  });

  describe("AI Router", () => {
    it("should respond to chat messages", async () => {
      const result = await caller.ai.chat({
        messages: [
          {
            role: "user",
            content: "What signal is at 2.437 GHz?",
          },
        ],
        includeContext: true,
      });

      expect(result).toHaveProperty("role", "assistant");
      expect(result).toHaveProperty("content");
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("should include SDR context when requested", async () => {
      const result = await caller.ai.chat({
        messages: [
          {
            role: "user",
            content: "What are my current settings?",
          },
        ],
        includeContext: true,
      });

      expect(result.content).toBeDefined();
    });

    it("should handle multiple messages in conversation", async () => {
      const result = await caller.ai.chat({
        messages: [
          {
            role: "user",
            content: "Hello",
          },
          {
            role: "assistant",
            content: "Hi! How can I help?",
          },
          {
            role: "user",
            content: "Tell me about WiFi signals",
          },
        ],
        includeContext: false,
      });

      expect(result.role).toBe("assistant");
      expect(result.content).toBeDefined();
    });
  });

  describe("Recording Router - Demo Mode", () => {
    beforeEach(() => {
      process.env.SDR_MODE = "demo";
    });

    it("should create recording in demo mode", async () => {
      const result = await caller.recording.start({
        duration: 5,
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 40,
      });

      // New API contract returns StartRecordingResponse
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("filename");
      expect(result).toHaveProperty("estimatedSize");
      expect(result).toHaveProperty("startTime");
    });

    it("should use default gain if not provided", async () => {
      const result = await caller.recording.start({
        duration: 5,
        frequency: 915e6,
        sampleRate: 10e6,
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("filename");
    });

    it("should accept valid frequency range", async () => {
      // Test with valid frequency (915 MHz)
      const result = await caller.recording.start({
        duration: 5,
        frequency: 915e6,
        sampleRate: 10e6,
      });

      expect(result).toHaveProperty("id");
    });

    it("should accept valid sample rate range", async () => {
      // Test with valid sample rate (10 MSPS)
      const result = await caller.recording.start({
        duration: 5,
        frequency: 915e6,
        sampleRate: 10e6,
      });

      expect(result).toHaveProperty("id");
    });
  });

  describe("Recording Router - Production Mode", () => {
    beforeEach(() => {
      process.env.SDR_MODE = "production";
    });

    it("should spawn iq_recorder in production mode", async () => {
      const { spawn } = await import("child_process");
      
      const result = await caller.recording.start({
        duration: 2,
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 40,
      });

      expect(spawn).toHaveBeenCalled();
      // New API contract returns StartRecordingResponse
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("filename");
    });

    it("should upload to S3 after recording", async () => {
      const { storagePut } = await import("./storage");

      const result = await caller.recording.start({
        duration: 2,
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 40,
      });

      expect(storagePut).toHaveBeenCalled();
      expect(result).toHaveProperty("id");
    });

    it("should clean up temp files after upload", async () => {
      const fs = await import("fs/promises");

      await caller.recording.start({
        duration: 2,
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 40,
      });

      expect(fs.default.unlink).toHaveBeenCalled();
    });
  });

  describe("Integration - All Features", () => {
    it("should have all routers registered", () => {
      expect(appRouter._def.procedures).toHaveProperty("settings.getMode");
      expect(appRouter._def.procedures).toHaveProperty("settings.setMode");
      expect(appRouter._def.procedures).toHaveProperty("ai.chat");
      expect(appRouter._def.procedures).toHaveProperty("recording.start");
      expect(appRouter._def.procedures).toHaveProperty("recording.list");
      expect(appRouter._def.procedures).toHaveProperty("recording.delete");
    });

    it("should maintain backward compatibility", () => {
      expect(appRouter._def.procedures).toHaveProperty("auth.me");
      expect(appRouter._def.procedures).toHaveProperty("auth.logout");
      expect(appRouter._def.procedures).toHaveProperty("device.getInfo");
      expect(appRouter._def.procedures).toHaveProperty("scanner.scan");
      expect(appRouter._def.procedures).toHaveProperty("telemetry.getMetrics");
    });
  });
});

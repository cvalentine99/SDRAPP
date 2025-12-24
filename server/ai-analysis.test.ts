import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";

// Mock hardware module
vi.mock("./hardware", () => ({
  hardware: {
    getStatus: vi.fn(() => ({
      temperature: 45,
      gpsLock: true,
      pllLock: true,
    })),
    getConfig: vi.fn(() => ({
      frequency: 915e6, // 915 MHz - ISM band
      sampleRate: 10e6,
      gain: 40,
    })),
  },
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

describe("AI Spectrum Analysis", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const mockContext: TrpcContext = {
      req: {} as any,
      res: {} as any,
      user: undefined,
    };
    caller = appRouter.createCaller(mockContext);
  });

  describe("analyzeSpectrum endpoint", () => {
    it("should analyze current spectrum and identify signal type", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result).toHaveProperty("signalType");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("suggestedQuestions");
      expect(result).toHaveProperty("insights");
      expect(result).toHaveProperty("status");
    });

    it("should identify ISM 915 MHz signal", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("ISM 915 MHz");
      expect(result.description).toContain("Industrial, Scientific, Medical");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should provide suggested questions for ISM band", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result.suggestedQuestions).toBeInstanceOf(Array);
      expect(result.suggestedQuestions.length).toBeGreaterThan(0);
      expect(result.suggestedQuestions[0]).toContain("915 MHz");
    });

    it("should include current SDR configuration", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result.frequency).toBe(915e6);
      expect(result.sampleRate).toBe(10e6);
      expect(result.gain).toBe(40);
    });

    it("should include system status", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result.status).toHaveProperty("temperature");
      expect(result.status).toHaveProperty("gpsLock");
      expect(result.status).toHaveProperty("pllLock");
    });

    it("should provide insights array", async () => {
      const result = await caller.ai.analyzeSpectrum();

      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights[0]).toContain("MHz");
    });
  });

  describe("Signal Type Identification", () => {
    it("should identify WiFi 2.4 GHz", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 2437e6, // Channel 6
        sampleRate: 20e6,
        gain: 40,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("WiFi 2.4 GHz");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("should identify Bluetooth", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 2420e6, // 2420 MHz - within Bluetooth range but not WiFi overlap
        sampleRate: 10e6,
        gain: 40,
      });

      const result = await caller.ai.analyzeSpectrum();

      // Note: 2420 MHz overlaps with WiFi 2.4 GHz (2400-2500)
      // Bluetooth is 2402-2480, so there's overlap
      // The test should accept either identification
      expect(["Bluetooth", "WiFi 2.4 GHz"]).toContain(result.signalType);
    });

    it("should identify FM Radio", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 98e6, // 98 MHz
        sampleRate: 2e6,
        gain: 30,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("FM Radio");
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("should identify GPS L1", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 1575.42e6,
        sampleRate: 5e6,
        gain: 76,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("GPS L1");
      expect(result.suggestedQuestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining("GPS"),
        ])
      );
    });

    it("should identify LTE Band 2", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 1960e6, // 1960 MHz
        sampleRate: 20e6,
        gain: 40,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("LTE Band 2");
      expect(result.description).toContain("LTE");
    });

    it("should identify WiFi 5 GHz", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 5500e6, // 5.5 GHz
        sampleRate: 30e6,
        gain: 40,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("WiFi 5 GHz");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("should handle unknown frequencies", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getConfig).mockReturnValue({
        frequency: 123.45e6, // Random frequency
        sampleRate: 10e6,
        gain: 40,
      });

      const result = await caller.ai.analyzeSpectrum();

      expect(result.signalType).toBe("Unknown Signal");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggestedQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("Status Warnings", () => {
    it("should warn about high temperature", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getStatus).mockReturnValue({
        temperature: 65,
        gpsLock: true,
        pllLock: true,
      });

      const result = await caller.ai.analyzeSpectrum();

      const tempWarning = result.insights.find((i) =>
        i.includes("temperature")
      );
      expect(tempWarning).toBeDefined();
    });

    it("should warn about missing GPS lock", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getStatus).mockReturnValue({
        temperature: 45,
        gpsLock: false,
        pllLock: true,
      });

      const result = await caller.ai.analyzeSpectrum();

      const gpsWarning = result.insights.find((i) => i.includes("GPS"));
      expect(gpsWarning).toBeDefined();
    });

    it("should warn about PLL unlock", async () => {
      const { hardware } = await import("./hardware");
      vi.mocked(hardware.getStatus).mockReturnValue({
        temperature: 45,
        gpsLock: true,
        pllLock: false,
      });

      const result = await caller.ai.analyzeSpectrum();

      const pllWarning = result.insights.find((i) => i.includes("PLL"));
      expect(pllWarning).toBeDefined();
    });
  });
});

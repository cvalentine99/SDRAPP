import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-presets",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Gain Presets Integration", () => {
  describe("device.setGain", () => {
    it("should accept gain values within B210 range (0-76 dB)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // Test low noise preset gain (20 dB)
      const result = await caller.device.setGain({ gain: 20 });
      expect(result).toBeDefined();
      expect(result.gain).toBe(20);
    });

    it("should accept max sensitivity preset gain (70 dB)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.device.setGain({ gain: 70 });
      expect(result).toBeDefined();
      expect(result.gain).toBe(70);
    });

    it("should accept wideband scan preset gain (40 dB)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.device.setGain({ gain: 40 });
      expect(result).toBeDefined();
      expect(result.gain).toBe(40);
    });
  });

  describe("device.setSampleRate", () => {
    it("should accept low sample rate for narrowband preset (1 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // 1 MSPS = 1,000,000 SPS
      const result = await caller.device.setSampleRate({ sampleRate: 1e6 });
      expect(result).toBeDefined();
      expect(result.sampleRate).toBe(1e6);
    });

    it("should accept high sample rate for wideband preset (56 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // 56 MSPS = 56,000,000 SPS
      const result = await caller.device.setSampleRate({ sampleRate: 56e6 });
      expect(result).toBeDefined();
      expect(result.sampleRate).toBe(56e6);
    });

    it("should accept satellite preset sample rate (2.4 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // 2.4 MSPS = 2,400,000 SPS
      const result = await caller.device.setSampleRate({ sampleRate: 2.4e6 });
      expect(result).toBeDefined();
      expect(result.sampleRate).toBe(2.4e6);
    });
  });

  describe("Preset application sequence", () => {
    it("should apply low noise preset (gain 20, sample rate 10 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      // Simulate applying low noise preset
      const gainResult = await caller.device.setGain({ gain: 20 });
      // 10 MSPS = 10,000,000 SPS
      const sampleRateResult = await caller.device.setSampleRate({ sampleRate: 10e6 });
      
      expect(gainResult.gain).toBe(20);
      expect(sampleRateResult.sampleRate).toBe(10e6);
    });

    it("should apply max sensitivity preset (gain 70, sample rate 5 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const gainResult = await caller.device.setGain({ gain: 70 });
      // 5 MSPS = 5,000,000 SPS
      const sampleRateResult = await caller.device.setSampleRate({ sampleRate: 5e6 });
      
      expect(gainResult.gain).toBe(70);
      expect(sampleRateResult.sampleRate).toBe(5e6);
    });

    it("should apply wideband scan preset (gain 40, sample rate 56 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const gainResult = await caller.device.setGain({ gain: 40 });
      // 56 MSPS = 56,000,000 SPS
      const sampleRateResult = await caller.device.setSampleRate({ sampleRate: 56e6 });
      
      expect(gainResult.gain).toBe(40);
      expect(sampleRateResult.sampleRate).toBe(56e6);
    });

    it("should apply satellite preset (gain 65, sample rate 2.4 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const gainResult = await caller.device.setGain({ gain: 65 });
      // 2.4 MSPS = 2,400,000 SPS
      const sampleRateResult = await caller.device.setSampleRate({ sampleRate: 2.4e6 });
      
      expect(gainResult.gain).toBe(65);
      expect(sampleRateResult.sampleRate).toBe(2.4e6);
    });

    it("should apply ISM band preset (gain 45, sample rate 4 MSPS)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const gainResult = await caller.device.setGain({ gain: 45 });
      // 4 MSPS = 4,000,000 SPS
      const sampleRateResult = await caller.device.setSampleRate({ sampleRate: 4e6 });
      
      expect(gainResult.gain).toBe(45);
      expect(sampleRateResult.sampleRate).toBe(4e6);
    });
  });
});

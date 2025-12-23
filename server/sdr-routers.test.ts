import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
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

describe("Device Configuration Router", () => {
  it("should return device config", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.device.getConfig();

    expect(result).toBeDefined();
    expect(result.centerFrequency).toBeDefined();
    expect(result.sampleRate).toBeDefined();
    expect(result.gain).toBeGreaterThanOrEqual(0);
    expect(result.agcMode).toMatch(/^(auto|manual)$/);
  });

  it("should update device configuration", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const updateResult = await caller.device.updateConfig({
      centerFrequency: "433.0",
      sampleRate: "20.0",
      gain: 60,
      agcMode: "auto",
      dcOffsetCorrection: "enabled",
      iqBalanceCorrection: "enabled",
    });

    expect(updateResult).toBeDefined();
    expect(updateResult.centerFrequency).toBe("433.0");
    expect(updateResult.sampleRate).toBe("20.0");
    expect(updateResult.gain).toBe(60);
  });
});

describe("Frequency Bookmarks Router", () => {
  it("should create and list frequency bookmarks", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Create bookmark
    const createResult = await caller.bookmarks.create({
      name: "ISM Band",
      frequency: "915.0",
      description: "ISM 915 MHz band",
      category: "ISM",
    });

    expect(createResult).toBeDefined();
    expect(createResult.name).toBe("ISM Band");
    expect(createResult.frequency).toBe("915.0");

    // List bookmarks
    const listResult = await caller.bookmarks.list();
    expect(listResult).toBeDefined();
    expect(Array.isArray(listResult)).toBe(true);
  });
});

describe("AI Assistant Router", () => {
  it("should process AI chat message with context", { timeout: 30000 }, async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.chat({
      message: "What is the optimal gain setting for 915 MHz?",
      context: {
        centerFrequency: "915.0",
        sampleRate: "10.0",
        gain: 50,
      },
    });

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

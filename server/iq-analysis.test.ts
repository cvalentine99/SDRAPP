import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

  return { ctx };
}

describe("IQ File Analysis", () => {
  it("analyzes IQ file and extracts signal characteristics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a simple IQ recording (complex float32: IQIQIQ...)
    // Generate a simple sine wave: I = cos(2πft), Q = sin(2πft)
    const numSamples = 1000;
    const samples = new Float32Array(numSamples * 2);
    const frequency = 0.1; // Normalized frequency

    for (let i = 0; i < numSamples; i++) {
      const phase = 2 * Math.PI * frequency * i;
      samples[i * 2] = Math.cos(phase); // I
      samples[i * 2 + 1] = Math.sin(phase); // Q
    }

    // Convert to base64
    const buffer = Buffer.from(samples.buffer);
    const base64 = buffer.toString("base64");

    const result = await caller.ai.analyzeIQFile({
      fileName: "test_signal.iq",
      fileSize: buffer.length,
      fileData: base64,
      sampleRate: 10e6,
      centerFrequency: 915e6,
    });

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.characteristics).toBeDefined();
    expect(result.characteristics.numSamples).toBe(numSamples);
    expect(result.characteristics.avgPowerDB).toBeTypeOf("number");
    expect(result.characteristics.maxPowerDB).toBeTypeOf("number");
    expect(result.characteristics.dynamicRange).toBeTypeOf("number");
  }, 15000); // Increase timeout for LLM API call
});

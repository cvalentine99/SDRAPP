import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

describe("device.getInfo", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    // Create a mock context (public procedure, no auth needed)
    const mockContext: Context = {
      user: null,
      req: {} as any,
      res: {} as any,
    };
    caller = appRouter.createCaller(mockContext);
  });

  it("should return device info in demo mode", async () => {
    // Set demo mode
    process.env.SDR_MODE = "demo";

    const result = await caller.device.getInfo();

    expect(result).toBeDefined();
    expect(result.serial).toBe("194919");
    expect(result.name).toBe("MyB210");
    expect(result.product).toBe("B210");
    expect(result.firmwareVersion).toBe("8.0");
    expect(result.fpgaVersion).toBe("16.0");
    expect(result.gpsdo).toBe("GPSTCXO v3.2");
    expect(result.usbSpeed).toBe("USB 3.0");
    expect(result.freqRange).toEqual({ min: 50e6, max: 6e9 });
    expect(result.sampleRateRange).toEqual({ min: 200e3, max: 61.44e6 });
  });

  it("should return device info structure with all required fields", async () => {
    process.env.SDR_MODE = "demo";

    const result = await caller.device.getInfo();

    // Check all required fields exist
    expect(result).toHaveProperty("serial");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("product");
    expect(result).toHaveProperty("firmwareVersion");
    expect(result).toHaveProperty("fpgaVersion");
    expect(result).toHaveProperty("gpsdo");
    expect(result).toHaveProperty("usbSpeed");
    expect(result).toHaveProperty("freqRange");
    expect(result).toHaveProperty("sampleRateRange");

    // Check types
    expect(typeof result.serial).toBe("string");
    expect(typeof result.name).toBe("string");
    expect(typeof result.product).toBe("string");
    expect(typeof result.firmwareVersion).toBe("string");
    expect(typeof result.fpgaVersion).toBe("string");
    expect(typeof result.gpsdo).toBe("string");
    expect(typeof result.usbSpeed).toBe("string");
    expect(typeof result.freqRange.min).toBe("number");
    expect(typeof result.freqRange.max).toBe("number");
    expect(typeof result.sampleRateRange.min).toBe("number");
    expect(typeof result.sampleRateRange.max).toBe("number");
  });

  it("should return fallback data in production mode when probe fails", async () => {
    // Set production mode (uhd_usrp_probe will fail in sandbox)
    process.env.SDR_MODE = "production";

    const result = await caller.device.getInfo();

    // Should return fallback data, not throw error
    expect(result).toBeDefined();
    expect(result.serial).toBeDefined();
    expect(result.name).toBeDefined();
    expect(result.product).toBeDefined();
    
    // Fallback values when probe fails
    expect(result.serial).toBe("unknown");
    expect(result.name).toBe("B210");
    expect(result.product).toBe("B210");
    expect(result.firmwareVersion).toBe("unknown");
    expect(result.fpgaVersion).toBe("unknown");
    expect(result.gpsdo).toBe("Probe failed");
    expect(result.usbSpeed).toBe("unknown");
  });

  afterAll(() => {
    // Reset to demo mode
    process.env.SDR_MODE = "demo";
  });
});

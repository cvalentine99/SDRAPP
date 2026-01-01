import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
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

describe("Device Selection Persistence", () => {
  describe("deviceList.listDevices", () => {
    it("should return demo devices in demo mode", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.deviceList.listDevices();
      
      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
      expect(result.devices.length).toBeGreaterThan(0);
      
      // Check first device has expected properties
      const firstDevice = result.devices[0];
      expect(firstDevice.backend).toBeDefined();
      expect(firstDevice.driver).toBeDefined();
      expect(firstDevice.hardware).toBeDefined();
      expect(firstDevice.serial).toBeDefined();
      expect(firstDevice.args).toBeDefined();
    });
  });

  describe("deviceList.getSelectedDevice", () => {
    it("should return default device when no selection exists", async () => {
      const ctx = createMockContext(999); // Use unique userId to avoid conflicts
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.deviceList.getSelectedDevice();
      
      expect(result).toBeDefined();
      expect(result.backend).toBe("uhd");
      expect(result.driver).toBe("b200");
      expect(result.hardware).toBe("Ettus B210");
    });
  });

  describe("deviceList.setSelectedDevice", () => {
    it("should successfully set device selection", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.deviceList.setSelectedDevice({
        backend: "uhd",
        args: "type=b200,serial=TEST123",
        driver: "b200",
        hardware: "Ettus B210 Test",
        serial: "TEST123",
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should persist and retrieve device selection", async () => {
      const ctx = createMockContext(2);
      const caller = appRouter.createCaller(ctx);
      
      // Set device selection
      await caller.deviceList.setSelectedDevice({
        backend: "soapysdr",
        args: "driver=rtlsdr,serial=RTLTEST",
        driver: "rtlsdr",
        hardware: "RTL-SDR Test",
        serial: "RTLTEST",
      });
      
      // Retrieve and verify
      const selected = await caller.deviceList.getSelectedDevice();
      
      expect(selected.backend).toBe("soapysdr");
      expect(selected.serial).toBe("RTLTEST");
      expect(selected.driver).toBe("rtlsdr");
      expect(selected.hardware).toBe("RTL-SDR Test");
    });

    it("should update existing selection", async () => {
      const ctx = createMockContext(3);
      const caller = appRouter.createCaller(ctx);
      
      // Initial selection
      await caller.deviceList.setSelectedDevice({
        backend: "uhd",
        args: "type=b200,serial=FIRST",
        serial: "FIRST",
      });
      
      // Update selection
      await caller.deviceList.setSelectedDevice({
        backend: "soapysdr",
        args: "driver=hackrf,serial=SECOND",
        serial: "SECOND",
      });
      
      // Verify update
      const selected = await caller.deviceList.getSelectedDevice();
      
      expect(selected.backend).toBe("soapysdr");
      expect(selected.serial).toBe("SECOND");
    });
  });
});

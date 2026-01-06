/**
 * Production SDR Control Plane Tests
 * 
 * Tests the hardened control plane implementation:
 * - Capability/Policy separation
 * - Atomic configuration application
 * - State machine transitions
 * - Audit logging
 * - Simulator parity
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ProductionSDRControlPlane,
  getProductionControlPlane,
  resetControlPlane,
} from "./sdr-control-plane-v2";
import {
  type SDRConfig,
  type HardwareCapabilities,
  type OperationalPolicy,
  DEVICE_CAPABILITIES,
  DEFAULT_POLICY,
  validateConfig,
  validateStateTransition,
} from "../shared/sdr-capabilities";

describe("Production SDR Control Plane", () => {
  let controlPlane: ProductionSDRControlPlane;

  beforeEach(() => {
    resetControlPlane();
    controlPlane = new ProductionSDRControlPlane();
  });

  afterEach(() => {
    resetControlPlane();
  });

  describe("Initialization", () => {
    it("should start in Idle state", () => {
      expect(controlPlane.getState()).toBe("Idle");
    });

    it("should have no device selected initially", () => {
      const context = controlPlane.getContext();
      expect(context.deviceType).toBeNull();
      expect(context.capability).toBeNull();
    });

    it("should load policy from environment", () => {
      const policy = controlPlane.getPolicy();
      expect(policy).toBeDefined();
      expect(policy.mode).toBeDefined();
    });

    it("should have empty audit log initially", () => {
      expect(controlPlane.getAuditLog()).toHaveLength(0);
    });
  });

  describe("Device Selection", () => {
    it("should set device type and load capabilities", async () => {
      await controlPlane.setDeviceType("b210");
      
      const context = controlPlane.getContext();
      expect(context.deviceType).toBe("b210");
      expect(context.capability).toBeDefined();
      expect(context.capability?.frequencyRange.max).toBe(6e9);
    });

    it("should reject unknown device type", async () => {
      await expect(controlPlane.setDeviceType("unknown_device"))
        .rejects.toThrow("Unknown device type");
    });

    it("should clear config when device type changes", async () => {
      await controlPlane.setDeviceType("b210");
      await controlPlane.connect();
      
      const validConfig: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "TX/RX",
        channel: 0,
      };
      await controlPlane.applyConfig(validConfig);
      
      await controlPlane.disconnect();
      await controlPlane.setDeviceType("rtlsdr");
      
      expect(controlPlane.getConfig()).toBeNull();
    });

    it("should audit device type changes", async () => {
      await controlPlane.setDeviceType("b210");
      
      const log = controlPlane.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].eventType).toBe("state_transition");
    });
  });

  describe("Connection", () => {
    beforeEach(async () => {
      await controlPlane.setDeviceType("simulator");
    });

    it("should transition to Configured state on connect", async () => {
      await controlPlane.connect();
      expect(controlPlane.getState()).toBe("Configured");
    });

    it("should reject connect without device type", async () => {
      resetControlPlane();
      const freshPlane = new ProductionSDRControlPlane();
      
      await expect(freshPlane.connect())
        .rejects.toThrow("Device type must be set");
    });

    it("should generate serial for simulator", async () => {
      await controlPlane.connect();
      
      const context = controlPlane.getContext();
      expect(context.serial).toBeDefined();
      expect(context.serial).toMatch(/^SIM-/);
    });
  });

  describe("Atomic Configuration", () => {
    beforeEach(async () => {
      await controlPlane.setDeviceType("simulator");
      await controlPlane.connect();
    });

    it("should accept valid configuration", async () => {
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };

      const result = await controlPlane.applyConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(controlPlane.getConfig()).toEqual(config);
    });

    it("should REJECT ENTIRELY on capability violation", async () => {
      const config: SDRConfig = {
        frequency: 20e9, // Above simulator max (10 GHz)
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };

      const result = await controlPlane.applyConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === "CAPABILITY_VIOLATION")).toBe(true);
      expect(controlPlane.getConfig()).toBeNull(); // Config NOT applied
    });

    it("should REJECT ENTIRELY on policy violation", async () => {
      // Policy maxSampleRate is 56e6 by default
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 80e6, // Above policy max
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };

      const result = await controlPlane.applyConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === "POLICY_VIOLATION")).toBe(true);
    });

    it("should NOT apply partial configuration", async () => {
      // First apply valid config
      const validConfig: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(validConfig);

      // Try to apply invalid config
      const invalidConfig: SDRConfig = {
        frequency: 20e9, // Invalid
        sampleRate: 20e6,
        gain: 60,
        bandwidth: 20e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(invalidConfig);

      // Original config should be preserved
      const currentConfig = controlPlane.getConfig();
      expect(currentConfig?.frequency).toBe(915e6);
      expect(currentConfig?.sampleRate).toBe(10e6);
    });

    it("should reject configuration while streaming", async () => {
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(config);
      await controlPlane.startStream();

      const newConfig: SDRConfig = {
        ...config,
        frequency: 1e9,
      };
      const result = await controlPlane.applyConfig(newConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === "STATE_VIOLATION")).toBe(true);
    });

    it("should audit rejected configurations", async () => {
      const invalidConfig: SDRConfig = {
        frequency: 20e9,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(invalidConfig);

      const log = controlPlane.getAuditLog();
      const rejectionEntry = log.find(e => e.eventType === "config_rejected");
      
      expect(rejectionEntry).toBeDefined();
      expect(rejectionEntry?.success).toBe(false);
      expect(rejectionEntry?.details.errors).toBeDefined();
    });
  });

  describe("State Machine", () => {
    beforeEach(async () => {
      await controlPlane.setDeviceType("simulator");
      await controlPlane.connect();
    });

    it("should follow valid transitions: Configured → Running", async () => {
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(config);
      
      await controlPlane.startStream();
      expect(controlPlane.getState()).toBe("Running");
    });

    it("should follow valid transitions: Running → Configured", async () => {
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(config);
      await controlPlane.startStream();
      
      await controlPlane.stopStream();
      expect(controlPlane.getState()).toBe("Configured");
    });

    it("should reject starting stream without config", async () => {
      await expect(controlPlane.startStream())
        .rejects.toThrow("no configuration applied");
    });

    it("should audit state transitions", async () => {
      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };
      await controlPlane.applyConfig(config);
      await controlPlane.startStream();

      const log = controlPlane.getAuditLog();
      const streamStart = log.find(
        e => e.eventType === "state_transition" && e.details.to === "Running"
      );
      
      expect(streamStart).toBeDefined();
      expect(streamStart?.success).toBe(true);
    });
  });

  describe("Simulator Parity", () => {
    it("should use same validation for simulator as hardware", async () => {
      // Test with simulator
      await controlPlane.setDeviceType("simulator");
      await controlPlane.connect();

      const config: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "SIM_RX",
        channel: 0,
      };

      const simResult = await controlPlane.applyConfig(config);

      // Reset and test with B210 capabilities
      resetControlPlane();
      const hardwarePlane = new ProductionSDRControlPlane();
      await hardwarePlane.setDeviceType("b210");
      await hardwarePlane.connect();

      const hwConfig: SDRConfig = {
        frequency: 915e6,
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "TX/RX",
        channel: 0,
      };

      const hwResult = await hardwarePlane.applyConfig(hwConfig);

      // Both should follow same validation path
      expect(simResult.valid).toBe(true);
      expect(hwResult.valid).toBe(true);
    });

    it("should reject invalid config in both simulator and hardware mode", async () => {
      // Invalid frequency for both
      const invalidConfig: SDRConfig = {
        frequency: -100, // Negative frequency
        sampleRate: 10e6,
        gain: 50,
        bandwidth: 10e6,
        antenna: "TX/RX",
        channel: 0,
      };

      // Test simulator
      await controlPlane.setDeviceType("simulator");
      await controlPlane.connect();
      const simResult = await controlPlane.applyConfig(invalidConfig);
      expect(simResult.valid).toBe(false);

      // Test B210
      resetControlPlane();
      const hardwarePlane = new ProductionSDRControlPlane();
      await hardwarePlane.setDeviceType("b210");
      await hardwarePlane.connect();
      const hwResult = await hardwarePlane.applyConfig(invalidConfig);
      expect(hwResult.valid).toBe(false);
    });
  });
});

describe("Capability Validation", () => {
  describe("B210 Capabilities", () => {
    const b210 = DEVICE_CAPABILITIES.b210;

    it("should have correct frequency range", () => {
      expect(b210.frequencyRange.min).toBe(50e6);
      expect(b210.frequencyRange.max).toBe(6e9);
    });

    it("should have correct sample rate range", () => {
      expect(b210.sampleRateRange.min).toBe(200e3);
      expect(b210.sampleRateRange.max).toBe(61.44e6);
    });

    it("should have TX capability", () => {
      expect(b210.hasTx).toBe(true);
    });

    it("should require USB 3.0", () => {
      expect(b210.minUsbSpeed).toBe("usb3");
    });
  });

  describe("RTL-SDR Capabilities", () => {
    const rtlsdr = DEVICE_CAPABILITIES.rtlsdr;

    it("should have correct frequency range", () => {
      expect(rtlsdr.frequencyRange.min).toBe(24e6);
      expect(rtlsdr.frequencyRange.max).toBe(1.766e9);
    });

    it("should NOT have TX capability", () => {
      expect(rtlsdr.hasTx).toBe(false);
    });

    it("should have only RX antenna", () => {
      expect(rtlsdr.antennas).toContain("RX");
      expect(rtlsdr.txChannels).toBe(0);
    });
  });
});

describe("Policy Validation", () => {
  it("should enforce frequency policy restrictions", () => {
    const capability = DEVICE_CAPABILITIES.simulator;
    const policy: OperationalPolicy = {
      ...DEFAULT_POLICY,
      allowedFrequencyRange: { min: 100e6, max: 1e9 }, // Restricted
    };

    const config: SDRConfig = {
      frequency: 50e6, // Below policy min
      sampleRate: 10e6,
      gain: 50,
      bandwidth: 10e6,
      antenna: "SIM_RX",
      channel: 0,
    };

    const result = validateConfig(config, "Configured", capability, policy);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === "POLICY_VIOLATION")).toBe(true);
  });

  it("should enforce sample rate policy restrictions", () => {
    const capability = DEVICE_CAPABILITIES.simulator;
    const policy: OperationalPolicy = {
      ...DEFAULT_POLICY,
      maxSampleRate: 20e6, // Restricted
    };

    const config: SDRConfig = {
      frequency: 915e6,
      sampleRate: 30e6, // Above policy max
      gain: 50,
      bandwidth: 10e6,
      antenna: "SIM_RX",
      channel: 0,
    };

    const result = validateConfig(config, "Configured", capability, policy);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => 
      e.type === "POLICY_VIOLATION" && e.field === "sampleRate"
    )).toBe(true);
  });
});

describe("State Transition Validation", () => {
  it("should allow Idle → Configured", () => {
    const result = validateStateTransition("Idle", "Configured");
    expect(result.valid).toBe(true);
  });

  it("should allow Configured → Running", () => {
    const result = validateStateTransition("Configured", "Running");
    expect(result.valid).toBe(true);
  });

  it("should allow Running → Configured", () => {
    const result = validateStateTransition("Running", "Configured");
    expect(result.valid).toBe(true);
  });

  it("should reject Idle → Running (must configure first)", () => {
    const result = validateStateTransition("Idle", "Running");
    expect(result.valid).toBe(false);
  });

  it("should reject Running → Reconfiguring (must stop first)", () => {
    const result = validateStateTransition("Running", "Reconfiguring");
    expect(result.valid).toBe(false);
  });
});

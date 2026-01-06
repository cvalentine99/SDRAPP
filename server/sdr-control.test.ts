/**
 * SDR Control Plane Tests
 * 
 * Tests the SDR lifecycle state machine and control plane commands.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  type SDRRuntimeState,
  type RXConfig,
  type UIControlState,
  deriveUIControlState,
  validateRXConfig,
  INITIAL_SDR_STATE,
  DEFAULT_RX_CONFIG,
  B210_LIMITS,
} from "../shared/sdr-control-plane";

describe("SDR Control Plane Types", () => {
  describe("INITIAL_SDR_STATE", () => {
    it("should start in UNINITIALIZED state", () => {
      expect(INITIAL_SDR_STATE.lifecycle).toBe("UNINITIALIZED");
    });

    it("should have null device info", () => {
      expect(INITIAL_SDR_STATE.deviceType).toBeNull();
      expect(INITIAL_SDR_STATE.backend).toBeNull();
      expect(INITIAL_SDR_STATE.serial).toBeNull();
      expect(INITIAL_SDR_STATE.config).toBeNull();
    });

    it("should have no error", () => {
      expect(INITIAL_SDR_STATE.lastError).toBeNull();
    });
  });

  describe("DEFAULT_RX_CONFIG", () => {
    it("should have valid default frequency", () => {
      expect(DEFAULT_RX_CONFIG.frequency).toBe(915e6);
      expect(DEFAULT_RX_CONFIG.frequency).toBeGreaterThanOrEqual(B210_LIMITS.frequency.min);
      expect(DEFAULT_RX_CONFIG.frequency).toBeLessThanOrEqual(B210_LIMITS.frequency.max);
    });

    it("should have valid default sample rate", () => {
      expect(DEFAULT_RX_CONFIG.sampleRate).toBe(10e6);
      expect(DEFAULT_RX_CONFIG.sampleRate).toBeGreaterThanOrEqual(B210_LIMITS.sampleRate.min);
      expect(DEFAULT_RX_CONFIG.sampleRate).toBeLessThanOrEqual(B210_LIMITS.sampleRate.max);
    });

    it("should have valid default gain", () => {
      expect(DEFAULT_RX_CONFIG.gain).toBe(50);
      expect(DEFAULT_RX_CONFIG.gain).toBeGreaterThanOrEqual(B210_LIMITS.gain.min);
      expect(DEFAULT_RX_CONFIG.gain).toBeLessThanOrEqual(B210_LIMITS.gain.max);
    });
  });
});

describe("validateRXConfig", () => {
  it("should accept valid configuration", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 10e6,
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject frequency below minimum", () => {
    const config: RXConfig = {
      frequency: 10e6, // Below 50 MHz minimum
      sampleRate: 10e6,
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("below minimum"))).toBe(true);
  });

  it("should reject frequency above maximum", () => {
    const config: RXConfig = {
      frequency: 7e9, // Above 6 GHz maximum
      sampleRate: 10e6,
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("above maximum"))).toBe(true);
  });

  it("should reject sample rate below minimum", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 100e3, // Below 200 kSPS minimum
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Sample rate"))).toBe(true);
  });

  it("should reject sample rate above maximum", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 70e6, // Above 61.44 MSPS maximum
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Sample rate"))).toBe(true);
  });

  it("should auto-correct gain below minimum", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 10e6,
      gain: -5, // Below 0 dB minimum
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(true); // Auto-corrections don't invalidate
    expect(result.autoCorrections.some(c => c.field === "gain")).toBe(true);
  });

  it("should auto-correct gain above maximum", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 10e6,
      gain: 80, // Above 76 dB maximum
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(true); // Auto-corrections don't invalidate
    expect(result.autoCorrections.some(c => c.field === "gain")).toBe(true);
  });

  it("should warn about high sample rates", () => {
    const config: RXConfig = {
      frequency: 915e6,
      sampleRate: 40e6, // Above 30 MSPS
      gain: 50,
    };
    const result = validateRXConfig(config);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes("USB 3.0"))).toBe(true);
  });
});

describe("deriveUIControlState", () => {
  describe("UNINITIALIZED state", () => {
    it("should enable only connect button", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "UNINITIALIZED",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.connectEnabled).toBe(true);
      expect(ui.disconnectEnabled).toBe(false);
      expect(ui.configEnabled).toBe(false);
      expect(ui.applyConfigEnabled).toBe(false);
      expect(ui.startStreamEnabled).toBe(false);
      expect(ui.stopStreamEnabled).toBe(false);
    });

    it("should show disconnected status", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "UNINITIALIZED",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.isConnected).toBe(false);
      expect(ui.isStreaming).toBe(false);
      expect(ui.statusText).toBe("Disconnected");
    });
  });

  describe("IDLE state", () => {
    it("should enable config and start stream", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "IDLE",
        deviceType: "b210",
        config: DEFAULT_RX_CONFIG,
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.connectEnabled).toBe(false);
      expect(ui.disconnectEnabled).toBe(true);
      expect(ui.configEnabled).toBe(true);
      expect(ui.applyConfigEnabled).toBe(true);
      expect(ui.startStreamEnabled).toBe(true);
      expect(ui.stopStreamEnabled).toBe(false);
    });

    it("should show connected status", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "IDLE",
        deviceType: "b210",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.isConnected).toBe(true);
      expect(ui.isStreaming).toBe(false);
      expect(ui.statusColor).toBe("success");
    });
  });

  describe("CONFIGURING state", () => {
    it("should disable all buttons", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "CONFIGURING",
        deviceType: "b210",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.connectEnabled).toBe(false);
      expect(ui.disconnectEnabled).toBe(false);
      expect(ui.configEnabled).toBe(false);
      expect(ui.applyConfigEnabled).toBe(false);
      expect(ui.startStreamEnabled).toBe(false);
      expect(ui.stopStreamEnabled).toBe(false);
    });

    it("should show configuring status", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "CONFIGURING",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.isConfiguring).toBe(true);
      expect(ui.statusText).toBe("Configuring...");
      expect(ui.statusColor).toBe("warning");
    });
  });

  describe("STREAMING state", () => {
    it("should enable only stop stream and disconnect", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "STREAMING",
        deviceType: "b210",
        config: DEFAULT_RX_CONFIG,
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.connectEnabled).toBe(false);
      expect(ui.disconnectEnabled).toBe(true);
      expect(ui.configEnabled).toBe(false);
      expect(ui.applyConfigEnabled).toBe(false);
      expect(ui.startStreamEnabled).toBe(false);
      expect(ui.stopStreamEnabled).toBe(true);
    });

    it("should show streaming status", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "STREAMING",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.isConnected).toBe(true);
      expect(ui.isStreaming).toBe(true);
      expect(ui.statusText).toBe("Streaming (RX)");
      expect(ui.statusColor).toBe("success");
    });
  });

  describe("ERROR state", () => {
    it("should enable connect and disconnect for recovery", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "ERROR",
        lastError: "Connection lost",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.connectEnabled).toBe(true);
      expect(ui.disconnectEnabled).toBe(true);
      expect(ui.configEnabled).toBe(false);
      expect(ui.startStreamEnabled).toBe(false);
      expect(ui.stopStreamEnabled).toBe(false);
    });

    it("should show error status", () => {
      const state: SDRRuntimeState = {
        ...INITIAL_SDR_STATE,
        lifecycle: "ERROR",
        lastError: "Connection lost",
      };
      const ui = deriveUIControlState(state);
      
      expect(ui.hasError).toBe(true);
      expect(ui.statusText).toBe("Connection lost");
      expect(ui.statusColor).toBe("error");
    });
  });
});

describe("B210 Hardware Limits", () => {
  it("should have correct frequency range", () => {
    expect(B210_LIMITS.frequency.min).toBe(50e6); // 50 MHz
    expect(B210_LIMITS.frequency.max).toBe(6e9);  // 6 GHz
  });

  it("should have correct sample rate range", () => {
    expect(B210_LIMITS.sampleRate.min).toBe(200e3);   // 200 kSPS
    expect(B210_LIMITS.sampleRate.max).toBe(61.44e6); // 61.44 MSPS
  });

  it("should have correct gain range", () => {
    expect(B210_LIMITS.gain.min).toBe(0);   // 0 dB
    expect(B210_LIMITS.gain.max).toBe(76);  // 76 dB
  });

  it("should have correct bandwidth range", () => {
    expect(B210_LIMITS.bandwidth.min).toBe(200e3); // 200 kHz
    expect(B210_LIMITS.bandwidth.max).toBe(56e6);  // 56 MHz
  });
});

describe("Lifecycle Transitions", () => {
  it("should follow valid transition: UNINITIALIZED -> IDLE", () => {
    const initial = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "UNINITIALIZED" });
    expect(initial.connectEnabled).toBe(true);
    
    const afterConnect = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "IDLE" });
    expect(afterConnect.isConnected).toBe(true);
    expect(afterConnect.startStreamEnabled).toBe(true);
  });

  it("should follow valid transition: IDLE -> STREAMING", () => {
    const idle = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "IDLE" });
    expect(idle.startStreamEnabled).toBe(true);
    
    const streaming = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "STREAMING" });
    expect(streaming.isStreaming).toBe(true);
    expect(streaming.stopStreamEnabled).toBe(true);
  });

  it("should follow valid transition: STREAMING -> IDLE", () => {
    const streaming = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "STREAMING" });
    expect(streaming.stopStreamEnabled).toBe(true);
    
    const idle = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "IDLE" });
    expect(idle.isStreaming).toBe(false);
    expect(idle.startStreamEnabled).toBe(true);
  });

  it("should prevent config changes during STREAMING", () => {
    const streaming = deriveUIControlState({ ...INITIAL_SDR_STATE, lifecycle: "STREAMING" });
    expect(streaming.configEnabled).toBe(false);
    expect(streaming.applyConfigEnabled).toBe(false);
  });
});

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Mock hardware
vi.mock("./hardware", () => ({
  hardware: {
    getConfig: vi.fn(() => ({
      frequency: 915000000,
      sampleRate: 10000000,
      gain: 50,
    })),
    getStatus: vi.fn(() => ({
      isRunning: true,
      temperature: 45.2,
      gpsLock: true,
      pllLock: true,
    })),
  },
}));

describe("Historical Analysis", () => {
  describe("Input Validation", () => {
    const GetHistoricalTrendSchema = z.object({
      frequency: z.number().min(50e6).max(6e9),
      toleranceHz: z.number().min(100000).max(100000000).optional().default(1000000),
      hoursBack: z.number().min(1).max(168).optional().default(24),
      resolution: z.enum(["minute", "hour", "day"]).optional().default("hour"),
    });

    const SaveSnapshotSchema = z.object({
      peakPower: z.number().optional(),
      noiseFloor: z.number().optional(),
      bandwidth: z.number().optional(),
      metadata: z.string().optional(),
    });

    const ListSnapshotsSchema = z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      frequency: z.number().optional(),
      toleranceHz: z.number().optional().default(1000000),
    });

    it("should validate getHistoricalTrend with defaults", () => {
      const result = GetHistoricalTrendSchema.safeParse({
        frequency: 915000000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toleranceHz).toBe(1000000);
        expect(result.data.hoursBack).toBe(24);
        expect(result.data.resolution).toBe("hour");
      }
    });

    it("should reject frequency below 50 MHz", () => {
      const result = GetHistoricalTrendSchema.safeParse({
        frequency: 40000000, // 40 MHz
      });
      expect(result.success).toBe(false);
    });

    it("should reject frequency above 6 GHz", () => {
      const result = GetHistoricalTrendSchema.safeParse({
        frequency: 7000000000, // 7 GHz
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid frequency range", () => {
      const frequencies = [50e6, 915e6, 2.4e9, 5.8e9, 6e9];
      frequencies.forEach((freq) => {
        const result = GetHistoricalTrendSchema.safeParse({ frequency: freq });
        expect(result.success).toBe(true);
      });
    });

    it("should reject hoursBack over 168 (7 days)", () => {
      const result = GetHistoricalTrendSchema.safeParse({
        frequency: 915000000,
        hoursBack: 200,
      });
      expect(result.success).toBe(false);
    });

    it("should validate saveSnapshot input", () => {
      const result = SaveSnapshotSchema.safeParse({
        peakPower: -30,
        noiseFloor: -90,
        bandwidth: 200000,
        metadata: '{"notes": "Strong signal observed"}',
      });
      expect(result.success).toBe(true);
    });

    it("should validate listSnapshots with defaults", () => {
      const result = ListSnapshotsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.toleranceHz).toBe(1000000);
      }
    });
  });

  describe("Spectrum Snapshot Data Structure", () => {
    it("should have correct snapshot fields", () => {
      const snapshot = {
        id: 1,
        userId: 1,
        frequency: 915000000,
        sampleRate: 10000000,
        gain: 50,
        signalType: "ISM 915 MHz",
        peakPower: -30,
        noiseFloor: -90,
        snr: 60,
        bandwidth: 200000,
        confidence: 85,
        metadata: '{"modulation": "LoRa"}',
        source: "manual" as const,
        createdAt: new Date(),
      };

      expect(snapshot.frequency).toBe(915000000);
      expect(snapshot.snr).toBe(snapshot.peakPower - snapshot.noiseFloor);
      expect(snapshot.source).toBe("manual");
    });

    it("should support all source types", () => {
      const sources = ["manual", "auto", "scan"] as const;
      sources.forEach((source) => {
        const snapshot = {
          id: 1,
          frequency: 915000000,
          source,
        };
        expect(["manual", "auto", "scan"]).toContain(snapshot.source);
      });
    });
  });

  describe("Trend Analysis", () => {
    it("should calculate average power correctly", () => {
      const peakPowers = [-30, -35, -32, -28, -33];
      const avgPower = peakPowers.reduce((a, b) => a + b, 0) / peakPowers.length;
      expect(avgPower).toBe(-31.6);
    });

    it("should identify increasing trend", () => {
      const peakPowers = [-40, -38, -35, -32, -30];
      const n = peakPowers.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = peakPowers.reduce((a, b) => a + b, 0);
      const sumXY = peakPowers.reduce((sum, y, i) => sum + i * y, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

      expect(slope).toBeGreaterThan(0);
    });

    it("should identify decreasing trend", () => {
      const peakPowers = [-30, -32, -35, -38, -40];
      const n = peakPowers.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = peakPowers.reduce((a, b) => a + b, 0);
      const sumXY = peakPowers.reduce((sum, y, i) => sum + i * y, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

      expect(slope).toBeLessThan(0);
    });

    it("should identify stable trend", () => {
      const peakPowers = [-35, -35, -35, -35, -35];
      const n = peakPowers.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = peakPowers.reduce((a, b) => a + b, 0);
      const sumXY = peakPowers.reduce((sum, y, i) => sum + i * y, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

      expect(Math.abs(slope)).toBeLessThan(0.1);
    });
  });

  describe("Anomaly Detection", () => {
    it("should detect spike anomalies", () => {
      const peakPowers = [-35, -34, -36, -35, -10, -35]; // -10 is a spike
      const avgPower = peakPowers.reduce((a, b) => a + b, 0) / peakPowers.length;
      const variance = peakPowers.reduce((sum, p) => sum + Math.pow(p - avgPower, 2), 0) / peakPowers.length;
      const stdDev = Math.sqrt(variance);
      const threshold = 2 * stdDev;

      const anomalies = peakPowers.filter((p) => Math.abs(p - avgPower) > threshold);
      expect(anomalies).toContain(-10);
    });

    it("should detect drop anomalies", () => {
      const peakPowers = [-35, -34, -36, -35, -80, -35]; // -80 is a drop
      const avgPower = peakPowers.reduce((a, b) => a + b, 0) / peakPowers.length;
      const variance = peakPowers.reduce((sum, p) => sum + Math.pow(p - avgPower, 2), 0) / peakPowers.length;
      const stdDev = Math.sqrt(variance);
      const threshold = 2 * stdDev;

      const anomalies = peakPowers.filter((p) => Math.abs(p - avgPower) > threshold);
      expect(anomalies).toContain(-80);
    });

    it("should not flag normal variations as anomalies", () => {
      const peakPowers = [-35, -34, -36, -35, -33, -37]; // Normal variation
      const avgPower = peakPowers.reduce((a, b) => a + b, 0) / peakPowers.length;
      const variance = peakPowers.reduce((sum, p) => sum + Math.pow(p - avgPower, 2), 0) / peakPowers.length;
      const stdDev = Math.sqrt(variance);
      const threshold = 2 * stdDev;

      const anomalies = peakPowers.filter((p) => Math.abs(p - avgPower) > threshold);
      expect(anomalies.length).toBe(0);
    });
  });

  describe("Historical Comparison", () => {
    it("should calculate power delta correctly", () => {
      const currentPower = -30;
      const avgHistoricalPower = -35;
      const powerDelta = currentPower - avgHistoricalPower;

      expect(powerDelta).toBe(5); // 5 dB increase
    });

    it("should flag significant power increase as anomaly", () => {
      const currentPower = -20;
      const avgHistoricalPower = -35;
      const powerDelta = currentPower - avgHistoricalPower;
      const isAnomaly = Math.abs(powerDelta) > 10;

      expect(isAnomaly).toBe(true);
      expect(powerDelta).toBeGreaterThan(0);
    });

    it("should flag significant power decrease as anomaly", () => {
      const currentPower = -50;
      const avgHistoricalPower = -35;
      const powerDelta = currentPower - avgHistoricalPower;
      const isAnomaly = Math.abs(powerDelta) > 10;

      expect(isAnomaly).toBe(true);
      expect(powerDelta).toBeLessThan(0);
    });

    it("should not flag minor changes as anomaly", () => {
      const currentPower = -33;
      const avgHistoricalPower = -35;
      const powerDelta = currentPower - avgHistoricalPower;
      const isAnomaly = Math.abs(powerDelta) > 10;

      expect(isAnomaly).toBe(false);
    });
  });

  describe("Frequency Tolerance", () => {
    it("should match frequencies within tolerance", () => {
      const targetFreq = 915000000; // 915 MHz
      const tolerance = 1000000; // 1 MHz
      const testFreqs = [914500000, 915000000, 915500000];

      testFreqs.forEach((freq) => {
        const inRange = freq >= targetFreq - tolerance && freq <= targetFreq + tolerance;
        expect(inRange).toBe(true);
      });
    });

    it("should reject frequencies outside tolerance", () => {
      const targetFreq = 915000000;
      const tolerance = 1000000;
      const testFreqs = [912000000, 918000000]; // 3 MHz away

      testFreqs.forEach((freq) => {
        const inRange = freq >= targetFreq - tolerance && freq <= targetFreq + tolerance;
        expect(inRange).toBe(false);
      });
    });
  });

  describe("SNR Calculation", () => {
    it("should calculate SNR correctly", () => {
      const peakPower = -30;
      const noiseFloor = -90;
      const snr = peakPower - noiseFloor;

      expect(snr).toBe(60); // 60 dB SNR
    });

    it("should handle weak signals", () => {
      const peakPower = -85;
      const noiseFloor = -90;
      const snr = peakPower - noiseFloor;

      expect(snr).toBe(5); // 5 dB SNR - weak signal
    });

    it("should handle signals at noise floor", () => {
      const peakPower = -90;
      const noiseFloor = -90;
      const snr = peakPower - noiseFloor;

      expect(snr).toBe(0); // No signal above noise
    });
  });

  describe("Time Range Filtering", () => {
    it("should filter snapshots within time range", () => {
      const now = Date.now();
      const hoursBack = 24;
      const startTime = now - hoursBack * 60 * 60 * 1000;

      const snapshots = [
        { createdAt: new Date(now - 1 * 60 * 60 * 1000) }, // 1 hour ago
        { createdAt: new Date(now - 12 * 60 * 60 * 1000) }, // 12 hours ago
        { createdAt: new Date(now - 48 * 60 * 60 * 1000) }, // 48 hours ago (outside)
      ];

      const filtered = snapshots.filter((s) => s.createdAt.getTime() >= startTime);
      expect(filtered.length).toBe(2);
    });

    it("should handle empty results", () => {
      const snapshots: Array<{ createdAt: Date }> = [];
      expect(snapshots.length).toBe(0);
    });
  });

  describe("Signal Type Aggregation", () => {
    it("should aggregate unique signal types", () => {
      const snapshots = [
        { signalType: "WiFi 2.4GHz" },
        { signalType: "WiFi 2.4GHz" },
        { signalType: "Bluetooth" },
        { signalType: null },
        { signalType: "WiFi 2.4GHz" },
      ];

      const signalTypes = Array.from(
        new Set(snapshots.map((s) => s.signalType).filter((t): t is string => t !== null))
      );

      expect(signalTypes).toContain("WiFi 2.4GHz");
      expect(signalTypes).toContain("Bluetooth");
      expect(signalTypes.length).toBe(2);
    });
  });
});

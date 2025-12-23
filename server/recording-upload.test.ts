import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { User } from "../drizzle/schema";

describe("Recording S3 Upload", () => {
  it("should upload IQ data to S3 and return valid URLs", async () => {
    // Create test user context
    const testUser: User = {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const caller = appRouter.createCaller({
      user: testUser,
      req: {} as any,
      res: {} as any,
    });

    // Generate small test IQ data (100 samples = 800 bytes)
    const numSamples = 100;
    const iqData = new Float32Array(numSamples * 2);
    
    // Fill with simple test pattern
    for (let i = 0; i < numSamples; i++) {
      iqData[i * 2] = Math.cos(i * 0.1); // I
      iqData[i * 2 + 1] = Math.sin(i * 0.1); // Q
    }

    // Convert to base64
    const buffer = Buffer.from(iqData.buffer);
    const base64Data = buffer.toString("base64");

    // Upload IQ data
    const result = await caller.recording.uploadIQData({
      filename: "test_capture.sigmf-data",
      data: base64Data,
    });

    // Verify result structure
    expect(result).toHaveProperty("s3Url");
    expect(result).toHaveProperty("s3Key");
    
    // Verify S3 URL is valid
    expect(result.s3Url).toMatch(/^https?:\/\//);
    expect(result.s3Url).toContain("test_capture.sigmf-data");
    
    // Verify S3 key includes user ID for isolation
    expect(result.s3Key).toContain("recordings/1/");
    expect(result.s3Key).toContain("test_capture.sigmf-data");

    console.log("✓ IQ data uploaded successfully");
    console.log(`  S3 URL: ${result.s3Url}`);
    console.log(`  S3 Key: ${result.s3Key}`);
  });

  it("should handle large IQ data files", async () => {
    const testUser: User = {
      id: 2,
      openId: "test-user-2",
      name: "Test User 2",
      email: "test2@example.com",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const caller = appRouter.createCaller({
      user: testUser,
      req: {} as any,
      res: {} as any,
    });

    // Generate larger test data (10,000 samples = 80 KB)
    const numSamples = 10000;
    const iqData = new Float32Array(numSamples * 2);
    
    for (let i = 0; i < numSamples; i++) {
      iqData[i * 2] = Math.random() - 0.5;
      iqData[i * 2 + 1] = Math.random() - 0.5;
    }

    const buffer = Buffer.from(iqData.buffer);
    const base64Data = buffer.toString("base64");

    const result = await caller.recording.uploadIQData({
      filename: "large_capture.sigmf-data",
      data: base64Data,
    });

    expect(result.s3Url).toBeTruthy();
    expect(result.s3Key).toContain("recordings/2/");
    
    console.log("✓ Large IQ data file uploaded successfully");
    console.log(`  File size: ${(buffer.length / 1024).toFixed(2)} KB`);
  });
});

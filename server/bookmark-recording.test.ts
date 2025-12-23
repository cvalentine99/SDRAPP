import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Bookmark Management", () => {
  it("creates a frequency bookmark successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const bookmark = await caller.bookmarks.create({
      name: "ISM 915 MHz",
      frequency: "915.0",
      description: "Industrial, Scientific and Medical band",
      category: "ISM",
    });

    expect(bookmark).toBeDefined();
    expect(bookmark.name).toBe("ISM 915 MHz");
    expect(bookmark.frequency).toBe("915.0");
    expect(bookmark.category).toBe("ISM");
  });

  it("lists user bookmarks", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a bookmark first
    await caller.bookmarks.create({
      name: "Test Frequency",
      frequency: "2400.0",
      category: "General",
    });

    const bookmarks = await caller.bookmarks.list();

    expect(Array.isArray(bookmarks)).toBe(true);
    expect(bookmarks.length).toBeGreaterThan(0);
    expect(bookmarks.some((b) => b.name === "Test Frequency")).toBe(true);
  });

  it("deletes a bookmark", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a bookmark
    const created = await caller.bookmarks.create({
      name: "Temporary Bookmark",
      frequency: "1000.0",
      category: "General",
    });

    // Delete it
    await caller.bookmarks.delete({ id: created.id });

    // Verify it's gone
    const bookmarks = await caller.bookmarks.list();
    expect(bookmarks.some((b) => b.id === created.id)).toBe(false);
  });
});

describe("Recording Management", () => {
  it("creates a recording entry successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const recording = await caller.recording.create({
      filename: "capture_915MHz_test.sigmf",
      s3Key: "recordings/test.sigmf-data",
      s3Url: "https://test.s3.amazonaws.com/test.sigmf-data",
      centerFrequency: "915.0",
      sampleRate: "10.0",
      gain: 30,
      duration: 60,
      fileSize: "1.2 GB",
      author: "Test User",
      description: "Test recording",
      hardware: "Ettus B210",
    });

    expect(recording).toBeDefined();
    expect(recording.filename).toBe("capture_915MHz_test.sigmf");
    expect(recording.centerFrequency).toBe("915.0");
    expect(recording.sampleRate).toBe("10.0");
  });

  it("lists user recordings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a recording first
    await caller.recording.create({
      filename: "test_recording.sigmf",
      s3Key: "recordings/test.sigmf-data",
      s3Url: "https://test.s3.amazonaws.com/test.sigmf-data",
      centerFrequency: "2400.0",
      sampleRate: "20.0",
      gain: 40,
      duration: 120,
      fileSize: "2.4 GB",
      author: "Test User",
      description: "Test recording",
      hardware: "Ettus B210",
    });

    const recordings = await caller.recording.list();

    expect(Array.isArray(recordings)).toBe(true);
    expect(recordings.length).toBeGreaterThan(0);
    expect(recordings.some((r) => r.filename === "test_recording.sigmf")).toBe(true);
  });

  it("deletes a recording", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a recording
    const created = await caller.recording.create({
      filename: "temp_recording.sigmf",
      s3Key: "recordings/temp.sigmf-data",
      s3Url: "https://test.s3.amazonaws.com/temp.sigmf-data",
      centerFrequency: "1000.0",
      sampleRate: "10.0",
      gain: 25,
      duration: 30,
      fileSize: "600 MB",
      author: "Test User",
      description: "Temporary recording",
      hardware: "Ettus B210",
    });

    // Delete it
    await caller.recording.delete({ id: created.id });

    // Verify it's gone
    const recordings = await caller.recording.list();
    expect(recordings.some((r) => r.id === created.id)).toBe(false);
  });
});

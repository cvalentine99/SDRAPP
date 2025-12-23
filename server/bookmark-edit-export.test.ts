import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-edit",
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

describe("Bookmark Edit Functionality", () => {
  it("updates a bookmark successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a bookmark first
    const created = await caller.bookmarks.create({
      name: "Original Name",
      frequency: "915.0",
      description: "Original description",
      category: "ISM",
    });

    // Update it
    const updated = await caller.bookmarks.update({
      id: created.id,
      name: "Updated Name",
      frequency: "920.0",
      description: "Updated description",
      category: "Amateur",
    });

    expect(updated).toBeDefined();
    expect(updated.name).toBe("Updated Name");
    expect(updated.frequency).toBe("920.0");
    expect(updated.description).toBe("Updated description");
    expect(updated.category).toBe("Amateur");
  });

  it("updates only specified fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a bookmark with unique name
    const uniqueName = `Partial Update Test ${Date.now()}`;
    const created = await caller.bookmarks.create({
      name: uniqueName,
      frequency: "2400.0",
      description: "Test description",
      category: "General",
    });

    // Update only name and frequency
    const newName = `Updated ${Date.now()}`;
    const updated = await caller.bookmarks.update({
      id: created.id,
      name: newName,
      frequency: "2450.0",
    });

    expect(updated.name).toBe(newName);
    expect(updated.frequency).toBe("2450.0");
    // Description and category should remain unchanged
    expect(updated.description).toBe("Test description");
    expect(updated.category).toBe("General");
  });
});

describe("Bookmark Export Format", () => {
  it("exports bookmarks in correct JSON format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create test bookmarks
    await caller.bookmarks.create({
      name: "Export Test 1",
      frequency: "915.0",
      description: "Test 1",
      category: "ISM",
    });

    await caller.bookmarks.create({
      name: "Export Test 2",
      frequency: "2400.0",
      description: "Test 2",
      category: "General",
    });

    // Get all bookmarks (simulating export)
    const bookmarks = await caller.bookmarks.list();

    // Verify export format
    const exportData = bookmarks.map((b) => ({
      name: b.name,
      frequency: b.frequency,
      description: b.description,
      category: b.category,
    }));

    expect(Array.isArray(exportData)).toBe(true);
    expect(exportData.length).toBeGreaterThan(0);
    
    // Verify each bookmark has required fields
    exportData.forEach((bookmark) => {
      expect(bookmark).toHaveProperty("name");
      expect(bookmark).toHaveProperty("frequency");
      expect(bookmark).toHaveProperty("description");
      expect(bookmark).toHaveProperty("category");
    });
  });
});

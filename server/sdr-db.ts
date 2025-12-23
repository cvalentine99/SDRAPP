import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  deviceConfigs,
  recordings,
  aiConversations,
  type InsertDeviceConfig,
  type InsertRecording,
  type InsertAIConversation,
} from "../drizzle/schema";

// ============================================================================
// Device Configuration Helpers
// ============================================================================

export async function getDeviceConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(deviceConfigs)
    .where(eq(deviceConfigs.userId, userId))
    .orderBy(desc(deviceConfigs.updatedAt))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

export async function upsertDeviceConfig(config: InsertDeviceConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if config exists for this user
  const existing = await getDeviceConfig(config.userId);

  if (existing) {
    // Update existing config
    await db
      .update(deviceConfigs)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(deviceConfigs.id, existing.id));

    return { ...existing, ...config };
  } else {
    // Insert new config
    await db.insert(deviceConfigs).values(config);
    const newConfig = await getDeviceConfig(config.userId);
    return newConfig!;
  }
}

// ============================================================================
// Recording Helpers
// ============================================================================

export async function getRecordings(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(recordings)
    .where(eq(recordings.userId, userId))
    .orderBy(desc(recordings.createdAt));
}

export async function createRecording(recording: InsertRecording) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(recordings).values(recording);
  const recs = await getRecordings(recording.userId);
  return recs[0]!;
}

export async function deleteRecording(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get recording to delete S3 file
  const results = await db
    .select()
    .from(recordings)
    .where(eq(recordings.id, id))
    .limit(1);

  if (results.length === 0) {
    throw new Error("Recording not found");
  }

  const recording = results[0];

  // Verify ownership
  if (recording.userId !== userId) {
    throw new Error("Unauthorized");
  }

  // Delete from database
  await db.delete(recordings).where(eq(recordings.id, id));

  return { success: true, s3Key: recording.s3Key };
}

// ============================================================================
// AI Conversation Helpers
// ============================================================================

export async function getAIConversations(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.createdAt))
    .limit(limit);
}

export async function createAIConversation(conversation: InsertAIConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(aiConversations).values(conversation);
  const convs = await getAIConversations(conversation.userId, 1);
  return convs[0]!;
}

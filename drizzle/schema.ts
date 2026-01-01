import { int, bigint, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  frequency: bigint("frequency", { mode: "number" }).notNull(), // Hz - can be up to 6 GHz
  sampleRate: bigint("sampleRate", { mode: "number" }).notNull(), // SPS - can be up to 61.44 MSPS
  duration: int("duration").notNull(), // seconds
  filePath: text("filePath").notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(), // bytes - can be very large
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

/**
 * Frequency bookmarks for quick access to commonly used frequencies
 * Users can save their favorite frequencies with custom names and settings
 */
export const frequencyBookmarks = mysqlTable("frequencyBookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** User-defined name for the bookmark (e.g., "FM Radio", "WiFi 2.4GHz") */
  name: varchar("name", { length: 100 }).notNull(),
  /** Center frequency in Hz */
  frequency: bigint("frequency", { mode: "number" }).notNull(),
  /** Sample rate in SPS */
  sampleRate: bigint("sampleRate", { mode: "number" }).notNull(),
  /** Gain in dB (0-76) */
  gain: int("gain").notNull(),
  /** Optional description or notes */
  description: text("description"),
  /** Color for UI display (hex code) */
  color: varchar("color", { length: 7 }).default("#00d4ff"),
  /** Display order for sorting */
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FrequencyBookmark = typeof frequencyBookmarks.$inferSelect;
export type InsertFrequencyBookmark = typeof frequencyBookmarks.$inferInsert;

/**
 * AI Conversations - stores chat sessions for spectrum analysis
 * Each conversation can contain multiple messages and captures SDR context
 */
export const aiConversations = mysqlTable("aiConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Auto-generated or user-defined title for the conversation */
  title: varchar("title", { length: 200 }).notNull(),
  /** Summary of the conversation topic (auto-generated from first message) */
  summary: text("summary"),
  /** SDR frequency at conversation start (Hz) */
  frequency: bigint("frequency", { mode: "number" }),
  /** SDR sample rate at conversation start */
  sampleRate: bigint("sampleRate", { mode: "number" }),
  /** Number of messages in conversation (denormalized for performance) */
  messageCount: int("messageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;

/**
 * AI Messages - individual messages within a conversation
 * Stores both user queries and AI responses
 */
export const aiMessages = mysqlTable("aiMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  /** Message role: user, assistant, or system */
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  /** Message content (can be long for AI responses) */
  content: text("content").notNull(),
  /** SDR state snapshot at message time (JSON) */
  sdrContext: text("sdrContext"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIMessage = typeof aiMessages.$inferSelect;
export type InsertAIMessage = typeof aiMessages.$inferInsert;

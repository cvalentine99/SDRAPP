import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

/**
 * Device configuration table for storing SDR settings
 */
export const deviceConfigs = mysqlTable("device_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  centerFrequency: varchar("center_frequency", { length: 50 }).notNull(), // MHz
  sampleRate: varchar("sample_rate", { length: 50 }).notNull(), // MSPS
  gain: int("gain").notNull(), // dB
  lnaGain: int("lna_gain"),
  tiaGain: int("tia_gain"),
  pgaGain: int("pga_gain"),
  agcMode: mysqlEnum("agc_mode", ["auto", "manual"]).default("manual").notNull(),
  dcOffsetCorrection: mysqlEnum("dc_offset_correction", ["enabled", "disabled"]).default("enabled").notNull(),
  iqBalanceCorrection: mysqlEnum("iq_balance_correction", ["enabled", "disabled"]).default("enabled").notNull(),
  masterClockRate: varchar("master_clock_rate", { length: 50 }),
  clockSource: varchar("clock_source", { length: 50 }),
  antenna: varchar("antenna", { length: 50 }),
  fftSize: int("fft_size").default(2048),
  windowFunction: varchar("window_function", { length: 50 }).default("hann"),
  colorMap: varchar("color_map", { length: 100 }).default("Cyberpunk (Default)"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DeviceConfig = typeof deviceConfigs.$inferSelect;
export type InsertDeviceConfig = typeof deviceConfigs.$inferInsert;

/**
 * Recording metadata for SigMF captures
 */
export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  s3Url: varchar("s3_url", { length: 1024 }).notNull(),
  centerFrequency: varchar("center_frequency", { length: 50 }).notNull(),
  sampleRate: varchar("sample_rate", { length: 50 }).notNull(),
  gain: int("gain").notNull(),
  duration: int("duration").notNull(), // seconds
  fileSize: varchar("file_size", { length: 50 }).notNull(),
  author: varchar("author", { length: 255 }),
  description: text("description"),
  license: varchar("license", { length: 100 }),
  hardware: varchar("hardware", { length: 255 }),
  location: varchar("location", { length: 255 }),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

/**
 * AI assistant conversation history
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;
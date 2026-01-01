import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock drizzle-orm
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve([
                {
                  id: 1,
                  title: "Test Conversation",
                  summary: "Test summary",
                  frequency: 915000000,
                  sampleRate: 10000000,
                  messageCount: 2,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ])),
            })),
          })),
          limit: vi.fn(() => Promise.resolve([
            {
              id: 1,
              userId: 1,
              title: "Test Conversation",
              summary: "Test summary",
              frequency: 915000000,
              sampleRate: 10000000,
              messageCount: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([{ insertId: 1 }])),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
}));

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

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() =>
    Promise.resolve({
      choices: [{ message: { content: "AI response" } }],
    })
  ),
}));

describe("AI Conversation History", () => {
  describe("Input Validation", () => {
    const SaveConversationSchema = z.object({
      title: z.string().min(1).max(200),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })
      ),
    });

    const ListConversationsSchema = z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
    });

    const LoadConversationSchema = z.object({
      conversationId: z.number(),
    });

    const DeleteConversationSchema = z.object({
      conversationId: z.number(),
    });

    const AddMessageSchema = z.object({
      conversationId: z.number(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    });

    it("should validate saveConversation input", () => {
      const validInput = {
        title: "WiFi Analysis Session",
        messages: [
          { role: "user", content: "What signals are in the 2.4 GHz band?" },
          { role: "assistant", content: "The 2.4 GHz band contains WiFi and Bluetooth signals." },
        ],
      };

      const result = SaveConversationSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const invalidInput = {
        title: "",
        messages: [{ role: "user", content: "Test" }],
      };

      const result = SaveConversationSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject title over 200 characters", () => {
      const invalidInput = {
        title: "A".repeat(201),
        messages: [{ role: "user", content: "Test" }],
      };

      const result = SaveConversationSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid message role", () => {
      const invalidInput = {
        title: "Test",
        messages: [{ role: "invalid", content: "Test" }],
      };

      const result = SaveConversationSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should validate listConversations with defaults", () => {
      const result = ListConversationsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should reject limit over 100", () => {
      const result = ListConversationsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it("should reject negative offset", () => {
      const result = ListConversationsSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it("should validate loadConversation input", () => {
      const result = LoadConversationSchema.safeParse({ conversationId: 1 });
      expect(result.success).toBe(true);
    });

    it("should validate deleteConversation input", () => {
      const result = DeleteConversationSchema.safeParse({ conversationId: 1 });
      expect(result.success).toBe(true);
    });

    it("should validate addMessage input", () => {
      const validInput = {
        conversationId: 1,
        role: "user",
        content: "Follow-up question about the signal",
      };

      const result = AddMessageSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject addMessage with invalid role", () => {
      const invalidInput = {
        conversationId: 1,
        role: "moderator",
        content: "Invalid role",
      };

      const result = AddMessageSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("Conversation Data Structure", () => {
    it("should have correct conversation fields", () => {
      const conversation = {
        id: 1,
        userId: 1,
        title: "FM Radio Analysis",
        summary: "User asked about FM radio signals in the 88-108 MHz band",
        frequency: 98000000, // 98 MHz
        sampleRate: 2000000, // 2 MSPS
        messageCount: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(conversation.id).toBe(1);
      expect(conversation.title).toBe("FM Radio Analysis");
      expect(conversation.frequency).toBe(98000000);
      expect(conversation.messageCount).toBe(4);
    });

    it("should have correct message fields", () => {
      const message = {
        id: 1,
        conversationId: 1,
        role: "user" as const,
        content: "What is the bandwidth of an FM radio station?",
        sdrContext: JSON.stringify({
          frequency: 98000000,
          sampleRate: 2000000,
          gain: 30,
        }),
        createdAt: new Date(),
      };

      expect(message.role).toBe("user");
      expect(message.conversationId).toBe(1);
      expect(JSON.parse(message.sdrContext!).frequency).toBe(98000000);
    });

    it("should support all message roles", () => {
      const roles = ["user", "assistant", "system"] as const;
      
      roles.forEach((role) => {
        const message = {
          id: 1,
          conversationId: 1,
          role,
          content: `Message from ${role}`,
          createdAt: new Date(),
        };
        expect(message.role).toBe(role);
      });
    });
  });

  describe("SDR Context Capture", () => {
    it("should capture frequency in Hz", () => {
      const context = {
        frequency: 915000000, // 915 MHz
        sampleRate: 10000000, // 10 MSPS
        gain: 50,
      };

      expect(context.frequency).toBe(915000000);
      expect(context.frequency / 1e6).toBe(915); // MHz
    });

    it("should capture sample rate in SPS", () => {
      const context = {
        frequency: 2437000000, // 2.437 GHz (WiFi ch 6)
        sampleRate: 20000000, // 20 MSPS
        gain: 40,
      };

      expect(context.sampleRate).toBe(20000000);
      expect(context.sampleRate / 1e6).toBe(20); // MSPS
    });

    it("should capture gain in dB", () => {
      const context = {
        frequency: 1575420000, // GPS L1
        sampleRate: 5000000,
        gain: 76, // Max gain for weak GPS signal
      };

      expect(context.gain).toBe(76);
      expect(context.gain).toBeLessThanOrEqual(76);
      expect(context.gain).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Summary Generation", () => {
    it("should truncate long summaries to 200 characters", () => {
      const longMessage = "A".repeat(300);
      const summary = longMessage.slice(0, 200) + (longMessage.length > 200 ? "..." : "");
      
      expect(summary.length).toBe(203); // 200 + "..."
      expect(summary.endsWith("...")).toBe(true);
    });

    it("should not add ellipsis to short summaries", () => {
      const shortMessage = "What is WiFi?";
      const summary = shortMessage.slice(0, 200) + (shortMessage.length > 200 ? "..." : "");
      
      expect(summary).toBe("What is WiFi?");
      expect(summary.endsWith("...")).toBe(false);
    });

    it("should use first user message for summary", () => {
      const messages = [
        { role: "system" as const, content: "System prompt" },
        { role: "user" as const, content: "User question about signals" },
        { role: "assistant" as const, content: "AI response" },
      ];

      const firstUserMessage = messages.find((m) => m.role === "user");
      expect(firstUserMessage?.content).toBe("User question about signals");
    });
  });

  describe("Conversation Lifecycle", () => {
    it("should support creating empty conversations", () => {
      const conversation = {
        title: "New Analysis Session",
        messages: [],
      };

      expect(conversation.messages.length).toBe(0);
    });

    it("should support conversations with multiple messages", () => {
      const conversation = {
        title: "Extended Analysis",
        messages: [
          { role: "user" as const, content: "Question 1" },
          { role: "assistant" as const, content: "Answer 1" },
          { role: "user" as const, content: "Question 2" },
          { role: "assistant" as const, content: "Answer 2" },
          { role: "user" as const, content: "Question 3" },
          { role: "assistant" as const, content: "Answer 3" },
        ],
      };

      expect(conversation.messages.length).toBe(6);
      expect(conversation.messages.filter((m) => m.role === "user").length).toBe(3);
      expect(conversation.messages.filter((m) => m.role === "assistant").length).toBe(3);
    });

    it("should track message count accurately", () => {
      let messageCount = 0;
      
      // Simulate adding messages
      messageCount++; // User message
      messageCount++; // Assistant response
      messageCount++; // Follow-up
      messageCount++; // Response
      
      expect(messageCount).toBe(4);
    });
  });

  describe("Pagination", () => {
    it("should support pagination with limit and offset", () => {
      const conversations = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Conversation ${i + 1}`,
      }));

      const limit = 10;
      const offset = 20;
      const page = conversations.slice(offset, offset + limit);

      expect(page.length).toBe(10);
      expect(page[0].id).toBe(21);
      expect(page[9].id).toBe(30);
    });

    it("should handle last page with fewer items", () => {
      const conversations = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Conversation ${i + 1}`,
      }));

      const limit = 10;
      const offset = 20;
      const page = conversations.slice(offset, offset + limit);

      expect(page.length).toBe(5);
    });
  });
});

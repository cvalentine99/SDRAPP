import { describe, it, expect } from "vitest";

describe("Sentry Configuration", () => {
  it("should have SENTRY_DSN environment variable set", () => {
    const dsn = process.env.SENTRY_DSN;
    expect(dsn).toBeDefined();
    expect(dsn).not.toBe("");
  });

  it("should have VITE_SENTRY_DSN environment variable set for frontend", () => {
    const dsn = process.env.VITE_SENTRY_DSN;
    expect(dsn).toBeDefined();
    expect(dsn).not.toBe("");
  });

  it("should have valid Sentry DSN format", () => {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      // Sentry DSN format: https://<key>@<org>.ingest.sentry.io/<project-id>
      // or https://<key>@<host>/<project-id>
      const dsnPattern = /^https:\/\/[a-f0-9]+@[a-z0-9.-]+\/\d+$/i;
      expect(dsn).toMatch(dsnPattern);
    }
  });

  it("should extract Sentry DSN components", () => {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      const url = new URL(dsn);
      expect(url.protocol).toBe("https:");
      expect(url.username).toBeTruthy(); // The public key
      expect(url.hostname).toContain("sentry.io");
      expect(url.pathname).toMatch(/^\/\d+$/); // Project ID
    }
  });
});

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Context creation - Standalone deployment mode
 * OAuth authentication is disabled for local/self-hosted deployments.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Return mock user for standalone mode - no OAuth required
  const standaloneUser: User = {
    id: "local-user",
    name: "Local User",
    email: "local@localhost",
    createdAt: new Date(),
  };

  return {
    req: opts.req,
    res: opts.res,
    user: standaloneUser,
  };
}

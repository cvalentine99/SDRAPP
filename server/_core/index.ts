// Initialize Sentry first, before any other imports
import { initSentry, setupSentryErrorHandler, setUser } from "../sentry";
initSentry();

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupWebSocket } from "../websocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // tRPC API with Sentry user context
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: async (opts) => {
        const ctx = await createContext(opts);
        // Set Sentry user context for error tracking
        if (ctx.user) {
          setUser({
            id: String(ctx.user.id),
            email: ctx.user.email || undefined,
            username: ctx.user.name || undefined,
          });
        } else {
          setUser(null);
        }
        return ctx;
      },
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Setup Sentry error handler after all routes
  setupSentryErrorHandler(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Initialize WebSocket server
  setupWebSocket(server);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

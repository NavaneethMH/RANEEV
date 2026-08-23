/* RANEEV server entry — runs the managed application backend and seeds fake development accounts only outside production. */
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ensureDevelopmentDemoAccounts } from "../demoAccounts";
import { processAiQueueScheduled } from "../ai/scheduled";
import { processNotificationEscalationsScheduled } from "../notifications/scheduled";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> { return new Promise(resolve => { const server = net.createServer(); server.listen(port, () => server.close(() => resolve(true))); server.on("error", () => resolve(false)); }); }
async function findAvailablePort(startPort = 3000): Promise<number> { for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port; throw new Error(`No available port found starting from ${startPort}`); }

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.post("/api/scheduled/process-ai-queue", processAiQueueScheduled);
  app.post("/api/scheduled/process-notification-escalations", processNotificationEscalationsScheduled);
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  await ensureDevelopmentDemoAccounts().catch(error => console.warn("[Demo accounts] Skipped until database migration is ready:", error instanceof Error ? error.message : error));
  const port = await findAvailablePort(parseInt(process.env.PORT || "3000"));
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}
startServer().catch(console.error);

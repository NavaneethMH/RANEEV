import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { processNotificationEscalations } from "./service";

export async function processNotificationEscalationsScheduled(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await processNotificationEscalations();
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification escalation processor failed.";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
